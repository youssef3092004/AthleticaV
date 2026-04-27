import { Router } from "express";
import { getCurrentStreak } from "../controllers/streak.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get(
  "/current",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getCurrentStreak,
);

export default router;
