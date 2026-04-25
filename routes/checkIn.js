import { Router } from "express";
import {
  createCheckIn,
  deleteCheckInById,
  getCheckInById,
  getCheckIns,
  submitCheckInAnswers,
  updateCheckInById,
} from "../controllers/checkIn.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-TRAINER-QUESTIONS"),
  createCheckIn,
);

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-TRAINER-QUESTIONS"),
  getCheckIns,
);

router.get(
  "/:id",
  verifyToken,
  checkPermission("VIEW-TRAINER-QUESTIONS"),
  getCheckInById,
);

router.patch(
  "/:id",
  verifyToken,
  checkPermission("UPDATE-TRAINER-QUESTIONS"),
  updateCheckInById,
);

router.post("/:id/submit", verifyToken, submitCheckInAnswers);

router.delete(
  "/:id",
  verifyToken,
  checkPermission("DELETE-TRAINER-QUESTIONS"),
  deleteCheckInById,
);

export default router;
