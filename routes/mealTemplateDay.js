import { Router } from "express";
import {
  addMealTemplateDay,
  getMealTemplateDayById,
  getMealTemplateDaysByTemplateId,
  removeMealTemplateDayById,
  updateMealTemplateDayById,
} from "../controllers/mealTemplateDay.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get(
  "/getByTemplateId",
  verifyToken,
  checkPermission("VIEW-MEAL-TEMPLATES"),
  getMealTemplateDaysByTemplateId,
);

router.get(
  "/getByTemplateId/:templateId",
  verifyToken,
  checkPermission("VIEW-MEAL-TEMPLATES"),
  getMealTemplateDaysByTemplateId,
);

router.get(
  "/getById/:dayId",
  verifyToken,
  checkPermission("VIEW-MEAL-TEMPLATES"),
  getMealTemplateDayById,
);

router.post(
  "/:templateId",
  verifyToken,
  checkPermission("CREATE-MEAL-TEMPLATES"),
  addMealTemplateDay,
);

router.delete(
  "/remove/:dayId",
  verifyToken,
  checkPermission("DELETE-MEAL-TEMPLATES"),
  removeMealTemplateDayById,
);

router.patch(
  "/update/:dayId",
  verifyToken,
  checkPermission("UPDATE-MEAL-TEMPLATES"),
  updateMealTemplateDayById,
);

export default router;
