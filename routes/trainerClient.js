import { Router } from "express";
import {
  createTrainerClient,
  deleteAllTrainerClients,
  deleteTrainerClientById,
  getAllTrainerClients,
  getTrainerClientById,
  updateTrainerClientByIdPatch,
} from "../controllers/trainerClient.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/", verifyToken, createTrainerClient);
router.get("/", verifyToken, getAllTrainerClients);
router.get("/:id", verifyToken, getTrainerClientById);
router.patch("/:id", verifyToken, updateTrainerClientByIdPatch);
router.delete("/:id", verifyToken, deleteTrainerClientById);
router.delete("/", verifyToken, deleteAllTrainerClients);

export default router;
