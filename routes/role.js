import { Router } from "express";
import {
  createRole,
  getRoleById,
  getRoles,
  deleteRoleById,
  updateRole,
} from "../controllers/role.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/create", verifyToken, createRole);
router.get("/getAll", verifyToken, getRoles);
router.get("/getById/:id", verifyToken, getRoleById);
router.put("/update/:id", verifyToken, updateRole);
router.delete("/deleteById/:id", verifyToken, deleteRoleById);
export default router;
