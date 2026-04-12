import { Router } from "express";
import {
  listPayouts,
  markPayoutPaid,
  requestPayout,
} from "../controllers/payout.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post("/", verifyToken, checkPermission("CREATE-PAYOUTS"), requestPayout);

router.get("/", verifyToken, checkPermission("VIEW-PAYOUTS"), listPayouts);

router.patch(
  "/:payoutId/mark-paid",
  verifyToken,
  checkPermission("UPDATE-PAYOUTS"),
  markPayoutPaid,
);

export default router;
