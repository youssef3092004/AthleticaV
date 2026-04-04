import { Router } from "express";
import {
  createMealTemplate,
  deleteMealTemplateByTemplateId,
  getMealTemplateByTemplateId,
  getMealTemplates,
} from "../controllers/mealTemplate.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-MEAL-TEMPLATES"),
  createMealTemplate,
);

router.get(
  "/",
  verifyToken,
  checkPermission("VIEW-MEAL-TEMPLATES"),
  getMealTemplates,
);

router.get(
  "/getById/:templateId",
  verifyToken,
  checkPermission("VIEW-MEAL-TEMPLATES"),
  getMealTemplateByTemplateId,
);

router.delete(
  "/delete/:templateId",
  verifyToken,
  checkPermission("DELETE-MEAL-TEMPLATES"),
  deleteMealTemplateByTemplateId,
);

export default router;
