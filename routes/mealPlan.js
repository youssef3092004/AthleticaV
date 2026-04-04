import { Router } from "express";
import {
  createMealPlan,
  createMealPlanFromTemplate,
  deleteMealPlanById,
  getMealPlanById,
  getMealPlans,
  updateMealPlanById,
} from "../controllers/mealPlan.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  createMealPlan,
);

router.post(
  "/from-template/:templateId",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  createMealPlanFromTemplate,
);

router.get("/", verifyToken, checkPermission("VIEW-MEAL-PLANS"), getMealPlans);

router.get(
  "/trainer/:trainerId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlans,
);

router.get(
  "/getById/:planId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanById,
);

router.get(
  "/trainer/:trainerId/getById/:planId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealPlanById,
);

router.patch(
  "/update/:planId",
  verifyToken,
  checkPermission("UPDATE-MEAL-PLANS"),
  updateMealPlanById,
);

router.delete(
  "/delete/:planId",
  verifyToken,
  checkPermission("DELETE-MEAL-PLANS"),
  deleteMealPlanById,
);

export default router;
