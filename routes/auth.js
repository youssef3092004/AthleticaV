import { Router } from "express";
import {
  clientRegister,
  trainerRegister,
  developerRegister,
  supportRegister,
  adminRegister,
  login,
  logout,
  resetPassword,
} from "../controllers/auth.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

// Registration endpoints (no authentication required)
router.post("/register/client", clientRegister);
router.post("/register/trainer", trainerRegister);
router.post("/register/developer", verifyToken, developerRegister);
router.post("/register/support", verifyToken, supportRegister);

// Admin-only registration (creates users with custom roles)
router.post(
  "/register/admin",
  verifyToken,
  checkPermission("CREATE-USERS"),
  adminRegister,
);

// Legacy endpoint - maps to client registration for backwards compatibility
router.post("/register", clientRegister);

// Authentication endpoints
router.post("/login", login);
router.post("/logout", verifyToken, logout);
router.patch("/resetPassword", verifyToken, resetPassword);

export default router;
