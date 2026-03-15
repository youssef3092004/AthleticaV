import { Router } from "express";
import {
  createRolePermission,
  getAllRolePermissions,
  getRolePermissionById,
  deleteRolePermissionById,
  deleteAllRolePermissions,
  updateRolePermissionById,
} from "../controllers/rolePermission.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-ROLE-PERMISSIONS"),
  createRolePermission,
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-ROLE-PERMISSIONS"),
  getAllRolePermissions,
);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-ROLE-PERMISSIONS"),
  getRolePermissionById,
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission("UPDATE-ROLE-PERMISSIONS"),
  updateRolePermissionById,
);
router.delete(
  "/deleteById/:id",
  verifyToken,
  checkPermission("DELETE-ROLE-PERMISSIONS"),
  deleteRolePermissionById,
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("DELETE-ROLE-PERMISSIONS"),
  deleteAllRolePermissions,
);

export default router;
