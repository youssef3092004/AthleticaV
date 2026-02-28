import { Router } from "express";
import {
  createTrainerProfile,
  deleteAllTrainerProfiles,
  deleteTrainerProfileById,
  getAllTrainerProfiles,
  getTrainerProfileById,
  updateTrainerProfileByIdPatch,
} from "../controllers/trainerProfile.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/", verifyToken, createTrainerProfile);
router.get("/", verifyToken, getAllTrainerProfiles);
router.get("/:id", verifyToken, getTrainerProfileById);
router.patch("/:id", verifyToken, updateTrainerProfileByIdPatch);
router.delete("/:id", verifyToken, deleteTrainerProfileById);
router.delete("/", verifyToken, deleteAllTrainerProfiles);

export default router;
