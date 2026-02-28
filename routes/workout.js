import { Router } from "express";
import {
  createWorkout,
  deleteAllWorkouts,
  deleteWorkoutById,
  getAllWorkouts,
  getWorkoutById,
  updateWorkoutByIdPatch,
} from "../controllers/workout.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/", verifyToken, createWorkout);
router.get("/", verifyToken, getAllWorkouts);
router.get("/:id", verifyToken, getWorkoutById);
router.patch("/:id", verifyToken, updateWorkoutByIdPatch);
router.delete("/:id", verifyToken, deleteWorkoutById);
router.delete("/", verifyToken, deleteAllWorkouts);

export default router;
