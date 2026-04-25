import { Router } from "express";
import {
  createQuotation,
  deleteAllQuotations,
  deleteQuotationById,
  getAllQuotations,
  getQuotationById,
  getQuotationsByClientId,
  getQuotationsByTrainerId,
  updateQuotationById,
} from "../controllers/quotation.js";
import { verifyToken } from "../middleware/auth.js";

const router = Router();

router.post("/create", verifyToken, createQuotation);
router.get("/getAll", verifyToken, getAllQuotations);
router.get("/getById/:id", verifyToken, getQuotationById);
router.get("/getByTrainerId/:trainerId", verifyToken, getQuotationsByTrainerId);
router.get("/getByClientId/:clientId", verifyToken, getQuotationsByClientId);
router.patch("/updateById/:id", verifyToken, updateQuotationById);
router.delete("/deleteById/:id", verifyToken, deleteQuotationById);
router.delete("/deleteAll", verifyToken, deleteAllQuotations);

export default router;
