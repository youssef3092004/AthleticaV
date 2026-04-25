import { Router } from "express";
import {
  createTrainerQuestion,
  deleteTrainerQuestionById,
  getAllTrainerQuestions,
  getTrainerQuestionById,
  getTrainerQuestionsByClientId,
  getTrainerQuestionsByPair,
  getTrainerQuestionsByTrainerId,
  updateTrainerQuestionById,
} from "../controllers/trainerQuestion.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/", verifyToken, createTrainerQuestion);
router.get("/", verifyToken, getAllTrainerQuestions);
router.get("/trainer/:trainerId", verifyToken, getTrainerQuestionsByTrainerId);
router.get("/client/:clientId", verifyToken, getTrainerQuestionsByClientId);
router.get(
  "/pair/:trainerId/:clientId",
  verifyToken,
  getTrainerQuestionsByPair,
);
router.get("/:id", verifyToken, getTrainerQuestionById);
router.patch("/:id", verifyToken, updateTrainerQuestionById);
router.delete("/:id", verifyToken, deleteTrainerQuestionById);

export default router;
