import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  getOrCreateConversation,
  getConversationDetails,
  getUserConversations,
  getConversationWithUser,
  getLatestMessage,
} from "../controllers/conversation.js";

const router = express.Router();

// GET /api/v1/conversations - Get all conversations for current user (paginated)
router.get("/", verifyToken, getUserConversations);

// POST /api/v1/conversations - Get or create conversation with another user
router.post("/", verifyToken, getOrCreateConversation);

// More specific routes BEFORE generic /:conversationId
router.get("/with/:otherUserId", verifyToken, getConversationWithUser);

// GET /api/v1/conversations/:conversationId/latest - Get latest message in conversation
router.get("/:conversationId/latest", verifyToken, getLatestMessage);

// GET /api/v1/conversations/:conversationId - Get conversation details
router.get("/:conversationId", verifyToken, getConversationDetails);

export default router;
