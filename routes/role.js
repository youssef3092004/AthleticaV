import { Router } from "express";
import {
  createRole,
  getRoleById,
  getRoles,
  deleteRoleById,
  updateRole,
} from "../controllers/role.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-ROLES"),
  createRole,
);
router.get("/getAll", verifyToken, checkPermission("VIEW-ROLES"), getRoles);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-ROLES"),
  getRoleById,
);
router.put(
  "/update/:id",
  verifyToken,
  checkPermission("UPDATE-ROLES"),
  updateRole,
);
router.delete(
  "/deleteById/:id",
  verifyToken,
  checkPermission("DELETE-ROLES"),
  deleteRoleById,
);
export default router;
