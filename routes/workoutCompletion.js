import { Router } from "express";
import {
  getWorkoutCompletionById,
  getWorkoutCompletionByItemId,
  getWorkoutCompletionsByWorkoutId,
  removeWorkoutCompletionById,
  updateWorkoutCompletionById,
  upsertWorkoutCompletion,
} from "../controllers/workoutCompletion.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  upsertWorkoutCompletion,
);

router.get(
  "/getById/:completionId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutCompletionById,
);

router.get(
  "/getByItemId/:itemId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutCompletionByItemId,
);

router.get(
  "/getByWorkoutId/:workoutId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutCompletionsByWorkoutId,
);

router.patch(
  "/update/:completionId",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutCompletionById,
);

router.delete(
  "/delete/:completionId",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  removeWorkoutCompletionById,
);

export default router;
