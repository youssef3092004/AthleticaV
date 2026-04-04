import { Router } from "express";
import {
  addMealTemplateItem,
  getMealTemplateItemById,
  updateMealTemplateItemById,
  removeMealTemplateItemById,
} from "../controllers/mealTemplateItem.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get(
  "/getById/:itemId",
  verifyToken,
  checkPermission("VIEW-MEAL-TEMPLATES"),
  getMealTemplateItemById,
);

router.patch(
  "/update/:itemId",
  verifyToken,
  checkPermission("UPDATE-MEAL-TEMPLATES"),
  updateMealTemplateItemById,
);

router.delete(
  "/delete/:itemId",
  verifyToken,
  checkPermission("DELETE-MEAL-TEMPLATES"),
  removeMealTemplateItemById,
);

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-MEAL-TEMPLATES"),
  addMealTemplateItem,
);

export default router;
