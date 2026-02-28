import { Router } from "express";
import {
  createPermission,
  deleteAllPermissions,
  deletePermissionById,
  getAllPermissions,
  getPermissionById,
  updatePermissionById,
} from "../controllers/userPermission.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/", verifyToken, createPermission);
router.get("/", verifyToken, getAllPermissions);
router.get("/:id", verifyToken, getPermissionById);
router.put("/:id", verifyToken, updatePermissionById);
router.delete("/:id", verifyToken, deletePermissionById);
router.delete("/", verifyToken, deleteAllPermissions);

export default router;
