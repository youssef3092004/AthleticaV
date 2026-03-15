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
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-PERMISSIONS"),
  createPermission,
);
router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-PERMISSIONS"),
  getAllPermissions,
);
router.get(
  "/:id",
  verifyToken,
  checkPermission("VIEW-PERMISSIONS"),
  getPermissionById,
);
router.put(
  "/:id",
  verifyToken,
  checkPermission("UPDATE-PERMISSIONS"),
  updatePermissionById,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("DELETE-PERMISSIONS"),
  deletePermissionById,
);
router.delete(
  "/",
  verifyToken,
  checkPermission("DELETE-PERMISSIONS"),
  deleteAllPermissions,
);

export default router;
