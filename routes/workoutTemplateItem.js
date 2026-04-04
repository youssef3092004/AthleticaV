import { Router } from "express";
import {
  addWorkoutTemplateItem,
  getWorkoutTemplateItemById,
  getWorkoutTemplateItemsByDayId,
  removeWorkoutTemplateItemById,
  updateWorkoutTemplateItemById,
} from "../controllers/workoutTemplateItem.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  addWorkoutTemplateItem,
);

router.get(
  "/getById/:itemId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutTemplateItemById,
);

router.get(
  "/getByDayId/:dayId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutTemplateItemsByDayId,
);

router.patch(
  "/update/:itemId",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutTemplateItemById,
);

router.delete(
  "/delete/:itemId",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  removeWorkoutTemplateItemById,
);

export default router;
