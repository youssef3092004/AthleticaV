import { Router } from "express";
import {
  createExercise,
  deleteAllExercises,
  deleteExerciseById,
  getAllExercises,
  getExerciseById,
  updateExerciseByIdPatch,
} from "../controllers/exercise.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-EXERCISES"),
  createExercise,
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-EXERCISES"),
  getAllExercises,
);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-EXERCISES"),
  getExerciseById,
);
router.patch(
  "/update/:id",
  verifyToken,
  checkPermission("UPDATE-EXERCISES"),
  updateExerciseByIdPatch,
);
router.delete(
  "/delete/:id",
  verifyToken,
  checkPermission("DELETE-EXERCISES"),
  deleteExerciseById,
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("DELETE-EXERCISES"),
  deleteAllExercises,
);

export default router;
