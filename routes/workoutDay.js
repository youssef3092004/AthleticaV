import { Router } from "express";
import {
  addWorkoutDay,
  getWorkoutDayById,
  getWorkoutDaysByWorkoutId,
  removeWorkoutDayById,
  updateWorkoutDayById,
} from "../controllers/workoutDay.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  addWorkoutDay,
);

router.get(
  "/getById/:dayId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutDayById,
);

router.get(
  "/getByWorkoutId/:workoutId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutDaysByWorkoutId,
);

router.patch(
  "/update/:dayId",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutDayById,
);

router.delete(
  "/delete/:dayId",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  removeWorkoutDayById,
);

export default router;
