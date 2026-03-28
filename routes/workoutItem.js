import { Router } from "express";
import {
  createWorkoutItem,
  deleteAllWorkoutItems,
  deleteWorkoutItemById,
  getAllWorkoutItems,
  getAllWorkoutItemsByWorkoutId,
  getWorkoutItemById,
  updateWorkoutItemByIdPatch,
} from "../controllers/workoutItem.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  createWorkoutItem,
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getAllWorkoutItems,
);
router.get(
  "/getAllByWorkoutId/:workoutId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getAllWorkoutItemsByWorkoutId,
);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutItemById,
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutItemByIdPatch,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  deleteWorkoutItemById,
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  deleteAllWorkoutItems,
);

export default router;
