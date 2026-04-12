import { Router } from "express";
import {
  createProgressMetric,
  getCoachWowMoment,
  getProgressMetrics,
} from "../controllers/progress.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-PROGRESS"),
  checkOwnership({ paramKey: "clientId" }),
  createProgressMetric,
);
router.get(
  "/wow-moment/:clientId",
  verifyToken,
  checkPermission("VIEW-PROGRESS"),
  checkOwnership({ paramKey: "clientId" }),
  getCoachWowMoment,
);

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-PROGRESS"),
  getProgressMetrics,
);

export default router;
