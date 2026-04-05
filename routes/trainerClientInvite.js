import { Router } from "express";
import {
  approveTrainerClientInviteByClientId,
  getTrainerClientInvites,
  verifyTrainerClientInvite,
} from "../controllers/trainerClientInvite.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-TRAINER-CLIENTS"),
  getTrainerClientInvites,
);

router.post(
  "/approve/:clientId",
  verifyToken,
  checkPermission("CREATE-TRAINER-CLIENTS"),
  approveTrainerClientInviteByClientId,
);

router.get("/verify/:code", verifyTrainerClientInvite);

export default router;
