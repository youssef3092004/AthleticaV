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
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-TRAINER-CLIENTS"),
  createTrainerClient,
);
router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-TRAINER-CLIENTS"),
  getAllTrainerClients,
);
router.get(
  "/:id",
  verifyToken,
  checkPermission("VIEW-TRAINER-CLIENTS"),
  getTrainerClientById,
);
router.patch(
  "/:id",
  verifyToken,
  checkPermission("UPDATE-TRAINER-CLIENTS"),
  updateTrainerClientByIdPatch,
);
router.delete(
  "/:id",
  verifyToken,
  checkPermission("DELETE-TRAINER-CLIENTS"),
  deleteTrainerClientById,
);
router.delete(
  "/",
  verifyToken,
  checkPermission("DELETE-TRAINER-CLIENTS"),
  deleteAllTrainerClients,
);

export default router;
