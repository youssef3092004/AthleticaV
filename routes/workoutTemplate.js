import { Router } from "express";
import {
  createWorkoutTemplate,
  deleteAllWorkoutTemplates,
  deleteWorkoutTemplateById,
  getAllWorkoutTemplates,
  getWorkoutTemplateById,
  updateWorkoutTemplateByIdPatch,
} from "../controllers/workoutTemplate.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/", verifyToken, createWorkoutTemplate);
router.get("/", verifyToken, getAllWorkoutTemplates);
router.get("/:id", verifyToken, getWorkoutTemplateById);
router.patch("/:id", verifyToken, updateWorkoutTemplateByIdPatch);
router.delete("/:id", verifyToken, deleteWorkoutTemplateById);
router.delete("/", verifyToken, deleteAllWorkoutTemplates);

export default router;
