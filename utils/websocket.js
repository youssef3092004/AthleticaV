import jwt from "jsonwebtoken";
import { prisma } from "../configs/db.js";
import process from "process";

// Map to track active socket connections per user
const userSockets = new Map(); // userId -> Set of socket ids

// High-performance WebSocket initialization and event handlers
export const initializeWebSocket = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if token is blacklisted
      const blacklisted = await prisma.blacklistedToken.findUnique({
        where: { token },
      });

      if (blacklisted) {
        return next(new Error("Authentication error: Token is expired"));
      }

      // Attach user info to socket
      socket.userId = decoded.id || decoded.userId || decoded.sub;
      next();
    } catch (error) {
      next(new Error(`Authentication error: ${error.message}`));
    }
  });

  // Handle new connections
  io.on("connection", (socket) => {
    const userId = socket.userId;

    // Track socket for this user
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    console.log(`[WS] User ${userId} connected via socket ${socket.id}`);

    /**
     * JOIN_CONVERSATION: User joins a conversation room
     * Payload: { conversationId }
     */
    socket.on("JOIN_CONVERSATION", async (data) => {
      try {
        const { conversationId } = data;

        if (!conversationId) {
          socket.emit("ERROR", {
            event: "JOIN_CONVERSATION",
            message: "conversationId is required",
          });
          return;
        }

        // Verify user has access to this conversation
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { trainerId: true, clientId: true },
        });

        if (!conversation) {
          socket.emit("ERROR", {
            event: "JOIN_CONVERSATION",
            message: "Conversation not found",
          });
          return;
        }

        const isParticipant =
          conversation.trainerId === userId || conversation.clientId === userId;

        if (!isParticipant) {
          socket.emit("ERROR", {
            event: "JOIN_CONVERSATION",
            message: "You don't have access to this conversation",
          });
          return;
        }

        // Join room named after conversationId
        socket.join(`conversation:${conversationId}`);
        console.log(
          `[WS] User ${userId} joined conversation ${conversationId}`,
        );

        // Notify others in the room
        socket.to(`conversation:${conversationId}`).emit("USER_JOINED", {
          conversationId,
          userId,
          timestamp: new Date().toISOString(),
        });

        socket.emit("JOINED_CONVERSATION", {
          conversationId,
          success: true,
        });
      } catch (error) {
        socket.emit("ERROR", {
          event: "JOIN_CONVERSATION",
          message: error.message,
        });
      }
    });

    /**
     * SEND_MESSAGE: User sends a message (via WebSocket)
     * Payload: { conversationId, body }
     */
    socket.on("SEND_MESSAGE", async (data) => {
      try {
        const { conversationId, body } = data;

        if (!conversationId || !body) {
          socket.emit("ERROR", {
            event: "SEND_MESSAGE",
            message: "conversationId and body are required",
          });
          return;
        }

        // Validate body
        const trimmedBody = String(body).trim();
        if (trimmedBody.length === 0 || trimmedBody.length > 5000) {
          socket.emit("ERROR", {
            event: "SEND_MESSAGE",
            message: "Message body must be 1-5000 characters",
          });
          return;
        }

        // Verify access
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { trainerId: true, clientId: true },
        });

        if (!conversation) {
          socket.emit("ERROR", {
            event: "SEND_MESSAGE",
            message: "Conversation not found",
          });
          return;
        }

        const isParticipant =
          conversation.trainerId === userId || conversation.clientId === userId;
        if (!isParticipant) {
          socket.emit("ERROR", {
            event: "SEND_MESSAGE",
            message: "You don't have access to this conversation",
          });
          return;
        }

        // Create message in database
        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            body: trimmedBody,
            type: "TEXT",
          },
          select: {
            id: true,
            conversationId: true,
            senderId: true,
            body: true,
            type: true,
            isRead: false,
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

        // Broadcast to all users in conversation room (including sender)
        io.to(`conversation:${conversationId}`).emit("MESSAGE_RECEIVED", {
          ...message,
          isRead: false,
        });

        // Emit success acknowledgement to sender
        socket.emit("MESSAGE_SENT", {
          messageId: message.id,
          conversationId,
          success: true,
        });
      } catch (error) {
        socket.emit("ERROR", {
          event: "SEND_MESSAGE",
          message: error.message,
        });
      }
    });

    /**
     * MARK_AS_READ: Mark message or conversation as read
     * Payload: { conversationId, messageId? }
     */
    socket.on("MARK_AS_READ", async (data) => {
      try {
        const { conversationId, messageId } = data;

        if (!conversationId) {
          socket.emit("ERROR", {
            event: "MARK_AS_READ",
            message: "conversationId is required",
          });
          return;
        }

        // Verify access
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { trainerId: true, clientId: true },
        });

        if (!conversation) {
          socket.emit("ERROR", {
            event: "MARK_AS_READ",
            message: "Conversation not found",
          });
          return;
        }

        const isParticipant =
          conversation.trainerId === userId || conversation.clientId === userId;
        if (!isParticipant) {
          socket.emit("ERROR", {
            event: "MARK_AS_READ",
            message: "You don't have access to this conversation",
          });
          return;
        }

        if (messageId) {
          // Mark specific message as read
          const updated = await prisma.message.update({
            where: { id: messageId },
            data: { isRead: true },
            select: { id: true, conversationId: true },
          });

          io.to(`conversation:${conversationId}`).emit("MESSAGE_READ", {
            messageId: updated.id,
            conversationId: updated.conversationId,
          });
        } else {
          // Mark all unread messages in conversation as read
          const result = await prisma.message.updateMany({
            where: {
              conversationId,
              senderId: { not: userId },
              isRead: false,
            },
            data: { isRead: true },
          });

          io.to(`conversation:${conversationId}`).emit("CONVERSATION_READ", {
            conversationId,
            updatedCount: result.count,
          });
        }
      } catch (error) {
        socket.emit("ERROR", {
          event: "MARK_AS_READ",
          message: error.message,
        });
      }
    });

    /**
     * TYPING: User is typing notification
     * Payload: { conversationId, isTyping }
     */
    socket.on("TYPING", async (data) => {
      try {
        const { conversationId, isTyping } = data;

        if (!conversationId) {
          return;
        }

        // Broadcast typing indicator to others in room
        socket.to(`conversation:${conversationId}`).emit("USER_TYPING", {
          conversationId,
          userId,
          isTyping: Boolean(isTyping),
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        // Silently ignore typing errors
        console.error(
          `[WS] Error occurred while handling typing notification for user ${userId}:`,
          error,
        );
      }
    });

    /**
     * LEAVE_CONVERSATION: User leaves a conversation room
     * Payload: { conversationId }
     */
    socket.on("LEAVE_CONVERSATION", (data) => {
      try {
        const { conversationId } = data;

        if (!conversationId) {
          return;
        }

        socket.leave(`conversation:${conversationId}`);

        socket.to(`conversation:${conversationId}`).emit("USER_LEFT", {
          conversationId,
          userId,
          timestamp: new Date().toISOString(),
        });

        console.log(`[WS] User ${userId} left conversation ${conversationId}`);
      } catch (error) {
        // Silently ignore leave errors
        console.error(
          `[WS] Error occurred while handling leave conversation for user ${userId}:`,
          error,
        );
      }
    });

    /**
     * Handle disconnect
     */
    socket.on("disconnect", () => {
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          console.log(`[WS] User ${userId} fully disconnected (no sockets)`);
        }
      }
      console.log(`[WS] Socket ${socket.id} for user ${userId} disconnected`);
    });

    /**
     * Handle errors
     */
    socket.on("error", (error) => {
      console.error(`[WS] Socket error for user ${userId}:`, error);
    });
  });

  return io;
};

// Utility: Check if user is online (has active socket)
export const isUserOnline = (userId) => {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
};

// Utility: Get active socket count for a user
export const getUserSocketCount = (userId) => {
  return userSockets.has(userId) ? userSockets.get(userId).size : 0;
};

// Utility: Emit event to a specific conversation room
export const emitToConversation = (io, conversationId, event, data) => {
  io.to(`conversation:${conversationId}`).emit(event, data);
};

// Utility: Emit event to a specific user (all their sockets)
// eslint-disable-next-line no-unused-vars
export const emitToUser = (io, userId, event, data) => {
  // Would need to create a mapping of userId to room or use socket.io's user-based emit
  // For now, events are room-based
};
