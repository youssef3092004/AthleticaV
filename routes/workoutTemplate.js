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
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-WORKOUT-TEMPLATES"),
  createWorkoutTemplate,
);
router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-WORKOUT-TEMPLATES"),
  getAllWorkoutTemplates,
);
router.get(
  "/:id",
  verifyToken,
  checkPermission("VIEW-WORKOUT-TEMPLATES"),
  getWorkoutTemplateById,
);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("UPDATE-WORKOUT-TEMPLATES"),
  updateWorkoutTemplateByIdPatch,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("DELETE-WORKOUT-TEMPLATES"),
  deleteWorkoutTemplateById,
);
router.delete(
  "/",
  verifyToken,
  checkPermission("DELETE-WORKOUT-TEMPLATES"),
  deleteAllWorkoutTemplates,
);

export default router;
