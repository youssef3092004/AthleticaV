import { Router } from "express";
import {
  upsertClientProfile,
  getClientProfile,
  getMyClientProfile,
  deleteClientProfile,
  getAllClientProfiles,
  batchUpdateClientProfiles,
} from "../controllers/clientProfile.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

/**
 * Get current user's own client profile
 * Any authenticated user can view their own profile
 */
router.get("/me", verifyToken, getMyClientProfile);

/**
 * Create or update a client profile
 * Clients can update their own profile; admins can update any profile
 */
router.put(
  "/:userId",
  verifyToken,
  checkPermission("UPDATE-CLIENT-PROFILES"),
  upsertClientProfile,
);

/**
 * Get a specific client profile by user ID
 * Clients can view their own; admins can view any
 */
router.get("/:userId", verifyToken, getClientProfile);

/**
 * Get all client profiles (admin/developer only)
 * Supports pagination and sorting
 */
router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-CLIENT-PROFILES"),
  getAllClientProfiles,
);

/**
 * Delete a client profile (admin/developer only)
 */
router.delete(
  "/:userId",
  verifyToken,
  checkPermission("DELETE-CLIENT-PROFILES"),
  deleteClientProfile,
);

/**
 * Batch update multiple client profiles (admin/developer only)
 * Request body: { updates: [{userId, age, heightCm, ...}, ...] }
 */
router.post(
  "/batch/update",
  verifyToken,
  checkPermission("UPDATE-CLIENT-PROFILES"),
  batchUpdateClientProfiles,
);

export default router;
