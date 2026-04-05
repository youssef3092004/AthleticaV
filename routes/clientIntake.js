import { Router } from "express";
import {
  getClientIntakeAnswers,
  getClientIntakeAnswersByClientId,
  getClientIntakeAnswersByTrainerId,
  getIntakeQuestionBank,
  upsertClientIntakeAnswers,
} from "../controllers/clientIntake.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.get("/questions", verifyToken, getIntakeQuestionBank);
router.post("/answers", verifyToken, upsertClientIntakeAnswers);
router.get(
  "/answers/trainer/:trainerId",
  verifyToken,
  getClientIntakeAnswersByTrainerId,
);
router.get(
  "/answers/client/:clientId",
  verifyToken,
  getClientIntakeAnswersByClientId,
);
router.get(
  "/answers/trainer/:trainerId/client/:clientId",
  verifyToken,
  getClientIntakeAnswers,
);

export default router;
