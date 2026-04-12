import { Router } from "express";
import {
  createTrainerProfile,
  deleteAllTrainerProfiles,
  deleteTrainerProfileById,
  getAllTrainerProfiles,
  getTrainerProfileByUserId,
  updateTrainerProfileByIdPatch,
} from "../controllers/trainerProfile.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-TRAINER-PROFILES"),
  checkOwnership({ paramKey: "trainerId" }),
  createTrainerProfile,
);
router.get(
  "/getAll",
  verifyToken,
  checkPermission("VIEW-TRAINER-PROFILES"),
  getAllTrainerProfiles,
);
router.get(
  "/getById/:userId",
  verifyToken,
  checkPermission("VIEW-TRAINER-PROFILES"),
  checkOwnership({ paramKey: "userId" }),
  getTrainerProfileByUserId,
);
router.patch(
  "/update/:userId",
  verifyToken,
  checkPermission("UPDATE-TRAINER-PROFILES"),
  checkOwnership({ paramKey: "userId" }),
  updateTrainerProfileByIdPatch,
);
router.delete(
  "/delete/:userId",
  verifyToken,
  checkPermission("DELETE-TRAINER-PROFILES"),
  checkOwnership({ paramKey: "userId" }),
  deleteTrainerProfileById,
);
router.delete(
  "/deleteAll",
  verifyToken,
  checkPermission("DELETE-TRAINER-PROFILES"),
  deleteAllTrainerProfiles,
);

export default router;
