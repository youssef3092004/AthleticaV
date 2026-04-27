import { Router } from "express";
import { getDailySummary } from "../controllers/nutrition.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get(
  "/daily-summary",
  verifyToken,
  checkPermission("VIEW-MEALS"),
  getDailySummary,
);

export default router;
