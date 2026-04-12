import { Router } from "express";
import {
  createTrainerClientInvite,
  searchTrainersByEmailNameOrCode,
} from "../controllers/trainerClientInvite.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-TRAINER-CLIENTS"),
  createTrainerClientInvite,
);

router.get("/search/trainers", searchTrainersByEmailNameOrCode);

export default router;
