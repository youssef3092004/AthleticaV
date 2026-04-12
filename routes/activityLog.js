import { Router } from "express";
import {
  createActivityLogEntry,
  getActivityLogById,
  listActivityLogs,
} from "../controllers/activityLog.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-ACTIVITY-LOGS"),
  createActivityLogEntry,
);

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-ACTIVITY-LOGS"),
  listActivityLogs,
);

router.get(
  "/:logId",
  verifyToken,
  checkPermission("VIEW-ACTIVITY-LOGS"),
  getActivityLogById,
);

export default router;
