import { Router } from "express";
import { getMe } from "../controllers/user.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get("/me", verifyToken, checkPermission("users:read"), getMe);

export default router;
