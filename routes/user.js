import { Router } from "express";
import {
  getMe,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.get("/me", verifyToken, checkPermission("VIEW-ME"), getMe);
router.get("/getAll", verifyToken, checkPermission("VIEW-USERS"), getAllUsers);
router.get(
  "/getById/:userId",
  verifyToken,
  checkPermission("VIEW-USERS"),
  getUserById,
);
router.patch(
  "/update/:userId",
  verifyToken,
  checkPermission("UPDATE-USERS"),
  checkOwnership({ paramKey: "userId" }),
  updateUser,
);
router.delete(
  "/deleteById/:userId",
  verifyToken,
  checkPermission("DELETE-USERS"),
  checkOwnership({ paramKey: "userId" }),
  deleteUser,
);
export default router;
