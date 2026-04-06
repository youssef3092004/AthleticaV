import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  sendMessage,
  getMessages,
  markMessageAsRead,
  markConversationAsRead,
  deleteMessage,
} from "../controllers/message.js";

const router = express.Router();

// POST /api/v1/messages - Send a message
router.post("/", verifyToken, sendMessage);

// PATCH /api/v1/messages/conversation/:conversationId/read-all - Must be before /:conversationId to avoid conflicts
router.patch(
  "/conversation/:conversationId/read-all",
  verifyToken,
  markConversationAsRead,
);

// GET /api/v1/messages/:conversationId - Get messages in a conversation (paginated)
router.get("/:conversationId", verifyToken, getMessages);

// PATCH /api/v1/messages/:messageId/read - Mark single message as read
router.patch("/:messageId/read", verifyToken, markMessageAsRead);

// DELETE /api/v1/messages/:messageId - Delete a message (with time limit)
router.delete("/:messageId", verifyToken, deleteMessage);

export default router;
