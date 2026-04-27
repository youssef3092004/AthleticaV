import { Router } from "express";
import {
  createWorkout,
  deleteAllWorkouts,
  deleteWorkoutById,
  getAllWorkouts,
  getWorkoutById,
  updateWorkoutByIdPatch,
  getWorkoutWeekSummary,
  updateWorkoutDayTrainerNote,
} from "../controllers/workout.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  createWorkout,
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getAllWorkouts,
);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  checkOwnership({
    model: "workout",
    idField: "id",
    ownerFields: ["trainerId"],
    paramKey: "id",
  }),
  getWorkoutById,
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  checkOwnership({
    model: "workout",
    idField: "id",
    ownerFields: ["trainerId"],
    paramKey: "id",
  }),
  updateWorkoutByIdPatch,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  checkOwnership({
    model: "workout",
    idField: "id",
    ownerFields: ["trainerId"],
    paramKey: "id",
  }),
  deleteWorkoutById,
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  deleteAllWorkouts,
);

// New endpoints for mobile app
router.get(
  "/:id/week-summary",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutWeekSummary,
);

router.patch(
  "/:id/days/:dayId",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutDayTrainerNote,
);

export default router;
