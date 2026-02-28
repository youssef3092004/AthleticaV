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

const router = Router();

router.post("/create", verifyToken, createPermission);
router.get("/getAll", verifyToken, getAllPermissions);
router.get("/getById/:id", verifyToken, getPermissionById);
router.put("/updateById/:id", verifyToken, updatePermissionById);
router.delete("/deleteById/:id", verifyToken, deletePermissionById);
router.delete("/deleteAll", verifyToken, deleteAllPermissions);

export default router;
