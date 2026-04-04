import { Router } from "express";
import {
  getMealCompletionById,
  getMealCompletionByItemId,
  getMealCompletionsByMealPlanId,
  removeMealCompletionById,
  updateMealCompletionById,
  upsertMealCompletion,
} from "../controllers/mealCompletion.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkPermission("CREATE-MEAL-PLANS"),
  upsertMealCompletion,
);

router.get(
  "/getById/:completionId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealCompletionById,
);

router.get(
  "/getByItemId/:itemId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealCompletionByItemId,
);

router.get(
  "/getByMealPlanId/:planId",
  verifyToken,
  checkPermission("VIEW-MEAL-PLANS"),
  getMealCompletionsByMealPlanId,
);

router.patch(
  "/update/:completionId",
  verifyToken,
  checkPermission("UPDATE-MEAL-PLANS"),
  updateMealCompletionById,
);

router.delete(
  "/delete/:completionId",
  verifyToken,
  checkPermission("DELETE-MEAL-PLANS"),
  removeMealCompletionById,
);

export default router;
