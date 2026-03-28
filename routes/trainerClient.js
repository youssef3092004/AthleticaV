import { Router } from "express";
import {
  createTrainerClient,
  deleteAllTrainerClients,
  deleteTrainerClientById,
  getAllTrainerClients,
  getTrainerClientById,
  updateStatusToActive,
  updateStatusToEnded,
  updateStatusToPaused,
  getAllTrainerClientsByTrainerId,
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
  "/getAll",
  verifyToken,
  checkPermission("VIEW-TRAINER-CLIENTS"),
  getAllTrainerClients,
);
router.get(
  "/getAllByTrainerId/:trainerId",
  verifyToken,
  checkPermission("VIEW-TRAINER-CLIENTS"),
  getAllTrainerClientsByTrainerId,
);
router.get(
  "/getById/:id",
  verifyToken,
  checkPermission("VIEW-TRAINER-CLIENTS"),
  getTrainerClientById,
);
router.patch(
  "/updateStatusToPaused/:id",
  verifyToken,
  checkPermission("UPDATE-TRAINER-CLIENTS"),
  updateStatusToPaused,
);
router.patch(
  "/updateStatusToEnded/:id",
  verifyToken,
  checkPermission("UPDATE-TRAINER-CLIENTS"),
  updateStatusToEnded,
);
router.patch(
  "/updateStatusToActive/:id",
  verifyToken,
  checkPermission("UPDATE-TRAINER-CLIENTS"),
  updateStatusToActive,
);
router.delete("/deleteById/:id", verifyToken, deleteTrainerClientById);
router.delete("/deleteAll", verifyToken, deleteAllTrainerClients);

export default router;
