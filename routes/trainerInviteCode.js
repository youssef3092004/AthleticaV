import { Router } from "express";
import { createTrainerClientInvite } from "../controllers/trainerClientInvite.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-TRAINER-CLIENTS"),
  createTrainerClientInvite,
);

export default router;
