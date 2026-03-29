import { Router } from "express";
import { createFood, getFoodPortions, getFoods } from "../controllers/food.js";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";

const router = Router();

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
