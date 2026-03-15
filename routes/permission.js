import { Router } from "express";
import {
  createPermission,
  getPermissionById,
  getAllPermissions,
  deletePermissionById,
  deleteAllPermissions,
  updatePermissionById,
} from "../controllers/permission.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-PERMISSIONS"),
  createPermission,
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-PERMISSIONS"),
  getAllPermissions,
);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-PERMISSIONS"),
  getPermissionById,
);
router.put(
  "/updateById/:id",
  verifyToken,
  checkPermission("UPDATE-PERMISSIONS"),
  updatePermissionById,
);
router.delete(
  "/deleteById/:id",
  verifyToken,
  checkPermission("DELETE-PERMISSIONS"),
  deletePermissionById,
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("DELETE-PERMISSIONS"),
  deleteAllPermissions,
);

export default router;
