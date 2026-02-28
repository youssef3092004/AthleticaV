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

const router = Router();

router.post("/create", verifyToken, createRolePermission);
router.get("/getAll", verifyToken, getAllRolePermissions);
router.get("/getById/:id", verifyToken, getRolePermissionById);
router.put("/update/:id", verifyToken, updateRolePermissionById);
router.delete("/deleteById/:id", verifyToken, deleteRolePermissionById);
router.delete("/deleteAll", verifyToken, deleteAllRolePermissions);

export default router;
