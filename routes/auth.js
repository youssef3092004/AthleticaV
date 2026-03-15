import { Router } from "express";
import { register, login, logout, resetPassword } from "../controllers/auth.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", verifyToken, logout);
router.patch("/resetPassword", verifyToken, resetPassword);

export default router;
