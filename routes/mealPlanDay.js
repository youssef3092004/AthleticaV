import { Router } from "express";
import {
  addMealPlanDay,
  getMealPlanDayById,
  getMealPlanDaysByPlanId,
  removeMealPlanDayById,
  updateMealPlanDayById,
} from "../controllers/mealPlanDay.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.get(
  "/getByPlanId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanDaysByPlanId,
);

router.get(
  "/getByPlanId/:planId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanDaysByPlanId,
);

router.get(
  "/getById/:dayId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanDayById,
);

router.post(
  "/:planId",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  addMealPlanDay,
);

router.delete(
  "/delete/:dayId",
  verifyToken,
  checkPermission("DELETE-MEAL-PLANS"),
  removeMealPlanDayById,
);

router.patch(
  "/update/:dayId",
  verifyToken,
  checkPermission("UPDATE-MEAL-PLANS"),
  updateMealPlanDayById,
);

export default router;
