import { Router } from "express";
import {
  createTransaction,
  getTransactionById,
  listTransactions,
  updateTransactionStatus,
} from "../controllers/transaction.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import { checkOwnership } from "../middleware/checkOwnership.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-TRANSACTIONS"),
  createTransaction,
);

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-TRANSACTIONS"),
  listTransactions,
);

router.get(
  "/:transactionId",
  verifyToken,
  checkPermission("VIEW-TRANSACTIONS"),
  checkOwnership({
    model: "transaction",
    idField: "id",
    ownerFields: ["clientId", "trainerId"],
    paramKey: "transactionId",
  }),
  getTransactionById,
);

router.patch(
  "/:transactionId/status",
  verifyToken,
  checkPermission("UPDATE-TRANSACTIONS"),
  checkOwnership({
    model: "transaction",
    idField: "id",
    ownerFields: ["clientId", "trainerId"],
    paramKey: "transactionId",
  }),
  updateTransactionStatus,
);

export default router;
