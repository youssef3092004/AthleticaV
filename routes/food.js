import { Router } from "express";
import {
  createFood,
  createFoodCategory,
  getFoodCategories,
  getFoodPortions,
  getFoods,
  getFoodByCategoryId,
} from "../controllers/food.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

router.post(
  "/categories",
  verifyToken,
  checkPermission("CREATE-FOODS"),
  createFoodCategory,
);
router.get(
  "/categories",
  verifyToken,
  checkPermission("VIEW-FOODS"),
  getFoodCategories,
);
router.get(
  "/category/:id/foods",
  verifyToken,
  checkPermission("VIEW-FOODS"),
  getFoodByCategoryId,
);

router.post(
  "/create",
  verifyToken,
  checkPermission("CREATE-FOODS"),
  createFood,
);
router.get("/getAll", verifyToken, checkPermission("VIEW-FOODS"), getFoods);
router.get(
  "/getById/:id/portions",
  verifyToken,
  checkPermission("VIEW-FOODS"),
  getFoodPortions,
);

export default router;
