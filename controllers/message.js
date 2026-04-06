import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { getUserIdFromRequest } from "../utils/authz.js";

// Validation helpers
const validateMessageBody = (body) => {
  if (!body || typeof body !== "string") {
    throw new AppError("Message body is required and must be a string", 400);
  }
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    throw new AppError("Message body cannot be empty", 400);
  }
  if (trimmed.length > 5000) {
    throw new AppError("Message body cannot exceed 5000 characters", 400);
  }
  return trimmed;
};

const validateConversationId = (conversationId) => {
  if (!conversationId || typeof conversationId !== "string") {
    throw new AppError("Conversation ID is required and must be a UUID", 400);
  }
  return conversationId;
};

// Ensure sender has access to conversation
const ensureSenderAccessToConversation = async (conversationId, senderId) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, trainerId: true, clientId: true },
  });

  if (!conversation) {
    throw new AppError("Conversation not found", 404);
  }

  const isParticipant =
    conversation.trainerId === senderId || conversation.clientId === senderId;
  if (!isParticipant) {
    throw new AppError("You don't have access to this conversation", 403);
  }

  return conversation;
};

// Send a message - optimized for WebSocket + REST fallback
export const sendMessage = async (req, res, next) => {
  try {
    const senderId = getUserIdFromRequest(req);
    const { conversationId, body } = req.body;

    validateConversationId(conversationId);
    const bodyText = validateMessageBody(body);

    // Verify access and get conversation
    await ensureSenderAccessToConversation(conversationId, senderId);

    // Create message (minimal select for real-time delivery)
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        body: bodyText,
        type: "TEXT",
      },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        body: true,
        type: true,
        isRead: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

// Get messages in conversation with pagination (for load history)
export const getMessages = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { conversationId } = req.params;

    validateConversationId(conversationId);

    // Verify access
    await ensureSenderAccessToConversation(conversationId, userId);

    const paginationParams = pagination(req, { limit: 50, page: 1 });

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          body: true,
          type: true,
          isRead: true,
          createdAt: true,
          sender: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
      prisma.message.count({
        where: { conversationId },
      }),
    ]);

    res.json({
      data: messages.reverse(), // Reverse to show oldest first
      pagination: {
        total,
        page: paginationParams.page,
        limit: paginationParams.limit,
        pages: Math.ceil(total / paginationParams.limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Mark message as read
export const markMessageAsRead = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { messageId } = req.params;

    // Get message and verify access
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
      },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Verify user is part of the message conversation (recipient)
    await ensureSenderAccessToConversation(message.conversationId, userId);

    // Only mark as read if user is the recipient (not sender)
    if (message.senderId === userId) {
      throw new AppError("Cannot mark your own message as read", 400);
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        isRead: true,
        createdAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Mark all messages in conversation as read (batch operation for performance)
export const markConversationAsRead = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { conversationId } = req.params;

    // Verify access
    await ensureSenderAccessToConversation(conversationId, userId);

    // Update all unread messages from other party
    const result = await prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId }, // Don't mark own messages
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({
      updated: result.count,
      conversationId,
    });
  } catch (error) {
    next(error);
  }
};

// Delete message (soft delete via update + only own messages)
export const deleteMessage = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { messageId } = req.params;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        createdAt: true,
      },
    });

    if (!message) {
      throw new AppError("Message not found", 404);
    }

    // Only allow deletion within 5 minutes of creation
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (message.createdAt < fiveMinutesAgo) {
      throw new AppError(
        "Messages can only be deleted within 5 minutes of creation",
        400,
      );
    }

    // Only sender can delete their own message
    if (message.senderId !== userId) {
      throw new AppError("You can only delete your own messages", 403);
    }

    // For MVP: hard delete (can implement soft delete with flag later)
    await prisma.message.delete({
      where: { id: messageId },
    });

    res.json({
      success: true,
      messageId,
      conversationId: message.conversationId,
    });
  } catch (error) {
    next(error);
  }
};
