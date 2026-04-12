import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { getUserIdFromRequest } from "../utils/authz.js";

// Get or create a conversation between trainer and client
export const getOrCreateConversation = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { otherUserId } = req.body;

    if (!otherUserId || typeof otherUserId !== "string") {
      throw new AppError("otherUserId is required and must be a UUID", 400);
    }

    if (userId === otherUserId) {
      throw new AppError("Cannot create conversation with yourself", 400);
    }

    // Verify both users exist
    const [user1, user2] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { id: otherUserId },
        select: { id: true },
      }),
    ]);

    if (!user1 || !user2) {
      throw new AppError("One or both users not found", 404);
    }

    // Get or create conversation between any two users
    const conversation = await prisma.conversation.upsert({
      where: {
        trainerId_clientId: {
          trainerId: userId > otherUserId ? otherUserId : userId,
          clientId: userId > otherUserId ? userId : otherUserId,
        },
      },
      update: {},
      create: {
        trainerId: userId > otherUserId ? otherUserId : userId,
        clientId: userId > otherUserId ? userId : otherUserId,
      },
      select: {
        id: true,
        trainerId: true,
        clientId: true,
        createdAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    res.json({
      ...conversation,
      messageCount: conversation._count.messages,
      _count: undefined,
    });
  } catch (error) {
    next(error);
  }
};

// Get details of a conversation with unread count
export const getConversationDetails = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { conversationId } = req.params;

    if (!conversationId || typeof conversationId !== "string") {
      throw new AppError("Conversation ID is required", 400);
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        trainerId: true,
        clientId: true,
        createdAt: true,
        trainer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            body: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    // Verify access
    const isParticipant =
      conversation.trainerId === userId || conversation.clientId === userId;
    if (!isParticipant) {
      throw new AppError("You don't have access to this conversation", 403);
    }

    // Count unread messages for current user
    const unreadCount = await prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
    });

    res.json({
      ...conversation,
      lastMessage: conversation.messages[0] || null,
      unreadCount,
      messages: undefined,
    });
  } catch (error) {
    next(error);
  }
};

// List all conversations for current user with pagination
export const getUserConversations = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const paginationParams = pagination(req, { limit: 20, page: 1 });

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where: {
          OR: [{ trainerId: userId }, { clientId: userId }],
        },
        select: {
          id: true,
          trainerId: true,
          clientId: true,
          createdAt: true,
          trainer: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              profileImage: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              body: true,
              senderId: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          // Sort by last message time or creation time
          createdAt: "desc",
        },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
      prisma.conversation.count({
        where: {
          OR: [{ trainerId: userId }, { clientId: userId }],
        },
      }),
    ]);

    const conversationIds = conversations.map((conv) => conv.id);
    const unreadByConversationId = new Map();

    if (conversationIds.length > 0) {
      const unreadRows = await prisma.message.groupBy({
        by: ["conversationId"],
        where: {
          conversationId: {
            in: conversationIds,
          },
          senderId: {
            not: userId,
          },
          isRead: false,
        },
        _count: {
          _all: true,
        },
      });

      for (const row of unreadRows) {
        unreadByConversationId.set(row.conversationId, row._count._all || 0);
      }
    }

    const conversationsWithUnread = conversations.map((conv) => ({
      ...conv,
      lastMessage: conv.messages[0] || null,
      unreadCount: unreadByConversationId.get(conv.id) || 0,
      messages: undefined,
    }));

    res.json({
      data: conversationsWithUnread,
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

// Get conversation with a specific user (by userId instead of conversationId)
export const getConversationWithUser = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { otherUserId } = req.params;

    if (!otherUserId || typeof otherUserId !== "string") {
      throw new AppError("User ID is required", 400);
    }

    // Find conversation where user is trainer or client
    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { trainerId: userId, clientId: otherUserId },
          { trainerId: otherUserId, clientId: userId },
        ],
      },
      select: {
        id: true,
        trainerId: true,
        clientId: true,
        createdAt: true,
        trainer: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
            profileImage: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const unreadCount = await prisma.message.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: userId },
        isRead: false,
      },
    });

    res.json({
      ...conversation,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// Get latest message from a conversation (for feed/dashboard)
export const getLatestMessage = async (req, res, next) => {
  try {
    const userId = getUserIdFromRequest(req);
    const { conversationId } = req.params;

    if (!conversationId || typeof conversationId !== "string") {
      throw new AppError("Conversation ID is required", 400);
    }

    // Verify access
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { trainerId: true, clientId: true },
    });

    if (!conversation) {
      throw new AppError("Conversation not found", 404);
    }

    const isParticipant =
      conversation.trainerId === userId || conversation.clientId === userId;
    if (!isParticipant) {
      throw new AppError("You don't have access to this conversation", 403);
    }

    const latestMessage = await prisma.message.findFirst({
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
    });

    res.json(latestMessage || null);
  } catch (error) {
    next(error);
  }
};
