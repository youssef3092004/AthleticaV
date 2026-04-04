import { Router } from "express";
import {
  addWorkoutTemplateDay,
  getWorkoutTemplateDayById,
  getWorkoutTemplateDaysByTemplateId,
  removeWorkoutTemplateDayById,
  updateWorkoutTemplateDayById,
} from "../controllers/workoutTemplateDay.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-WORKOUTS"),
  addWorkoutTemplateDay,
);

router.get(
  "/getById/:dayId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutTemplateDayById,
);

router.get(
  "/getByTemplateId/:templateId",
  verifyToken,
  checkPermission("VIEW-WORKOUTS"),
  getWorkoutTemplateDaysByTemplateId,
);

router.patch(
  "/update/:dayId",
  verifyToken,
  checkPermission("UPDATE-WORKOUTS"),
  updateWorkoutTemplateDayById,
);

router.delete(
  "/delete/:dayId",
  verifyToken,
  checkPermission("DELETE-WORKOUTS"),
  removeWorkoutTemplateDayById,
);

export default router;
