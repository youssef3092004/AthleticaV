import { Router } from "express";
import {
  createProgressMetric,
  getProgressMetrics,
} from "../controllers/progress.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-PROGRESS"),
  createProgressMetric,
);
router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-PROGRESS"),
  getProgressMetrics,
);

export default router;
