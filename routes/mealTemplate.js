import { Router } from "express";
import {
  addMealTemplateDay,
  addMealTemplateItem,
  createMealTemplate,
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
router.post(
  "/:id/days",
  verifyToken,
  checkPermission("CREATE-MEAL-TEMPLATES"),
  addMealTemplateDay,
);
router.post(
  "/:id/items",
  verifyToken,
  checkPermission("CREATE-MEAL-TEMPLATES"),
  addMealTemplateItem,
);

export default router;
