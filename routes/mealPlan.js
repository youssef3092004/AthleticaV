import { Router } from "express";
import {
  createMealPlan,
  createMealPlanFromTemplate,
  getClientMealPlans,
  getMealPlanById,
} from "../controllers/mealPlan.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/meal-plans",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  createMealPlan,
);
router.post(
  "/meal-plans/from-template",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  createMealPlanFromTemplate,
);
router.get(
  "/meal-plans/:id",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanById,
);
router.get(
  "/clients/:id/meal-plans",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getClientMealPlans,
);

export default router;
