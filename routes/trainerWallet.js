import { Router } from "express";
import {
  adjustTrainerWalletBalance,
  getTrainerWallet,
  listTrainerWallets,
} from "../controllers/trainerWallet.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.get(
  "/me",
  verifyToken,
  checkPermission("VIEW-TRAINER-WALLETS"),
  getTrainerWallet,
);

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-TRAINER-WALLETS"),
  listTrainerWallets,
);

router.patch(
  "/:trainerId/adjust",
  verifyToken,
  checkPermission("UPDATE-TRAINER-WALLETS"),
  checkOwnership({ paramKey: "trainerId" }),
  adjustTrainerWalletBalance,
);

export default router;
