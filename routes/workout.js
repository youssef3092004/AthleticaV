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
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  createWorkout,
);
router.get("/", verifyToken, checkPermission("VIEW-WORKOUTS"), getAllWorkouts);
router.get(
  "/:id",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutById,
);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutByIdPatch,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  deleteWorkoutById,
);
router.delete(
  "/",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  deleteAllWorkouts,
);

export default router;
