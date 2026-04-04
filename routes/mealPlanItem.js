import { Router } from "express";
import {
  addMealPlanItem,
  getMealPlanItemById,
  getMealPlanItemsByDayId,
  getMealPlanItemsByMealPlanId,
  removeMealPlanItemById,
  updateMealPlanItemById,
} from "../controllers/mealPlanItem.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();


router.get(
  "/getByDayId/:dayId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanItemsByDayId,
);

router.get(
  "/getByMealPlanId/:planId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanItemsByMealPlanId,
);

router.get(
  "/getById/:itemId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanItemById,
);

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  addMealPlanItem,
);

router.patch(
  "/update/:itemId",
  verifyToken,
  checkPermission("UPDATE-MEAL-PLANS"),
  updateMealPlanItemById,
);

router.delete(
  "/delete/:itemId",
  verifyToken,
  checkPermission("DELETE-MEAL-PLANS"),
  removeMealPlanItemById,
);

export default router;
