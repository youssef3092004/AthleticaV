import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { recalcMealPlanDayAndSummary } from "../utils/mealPlanProgress.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_MEAL_TIMES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "EVENING_SNACK",
];

const parsePositiveNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
  }
  return parsed;
};

const parseNonNegativeInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
};

const normalizeMealTime = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!ALLOWED_MEAL_TIMES.includes(normalized)) {
    throw new AppError("Invalid mealTime", 400);
  }

  return normalized;
};

const sanitizeOptionalString = (value, fieldName, maxLength = 1000) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const parsed = String(value).trim();
  if (parsed.length > maxLength) {
    throw new AppError(
      `${fieldName} must be at most ${maxLength} characters`,
      400,
    );
  }

  return parsed;
};

const resolveMealPlanDay = async (req, access) => {
  const directDayId = req.body.mealPlanDayId || req.params.dayId;
  if (directDayId) {
    return ensurePlanAccessFromDay(directDayId, access, true);
  }

  const mealPlanId = req.body.mealPlanId;
  const dayIndexRaw = req.body.dayIndex;

  if (mealPlanId === undefined || dayIndexRaw === undefined) {
    throw new AppError(
      "Provide mealPlanDayId or both mealPlanId and dayIndex",
      400,
    );
  }

  const dayIndex = parseNonNegativeInteger(dayIndexRaw, "dayIndex");

  const day = await prisma.mealPlanDay.findUnique({
    where: {
      mealPlanId_dayIndex: {
        mealPlanId: String(mealPlanId),
        dayIndex,
      },
    },
    select: {
      id: true,
      mealPlanId: true,
      mealPlan: {
        select: {
          trainerId: true,
        },
      },
    },
  });

  if (!day) {
    throw new AppError("Meal plan day not found", 404);
  }

  ensureSameUserOrPrivileged(
    access,
    day.mealPlan.trainerId,
    "Forbidden: meal plan does not belong to this trainer",
  );

  return day;
};

const ensurePlanAccessFromDay = async (
  mealPlanDayId,
  access,
  enforceOwnership = false,
) => {
  const day = await prisma.mealPlanDay.findUnique({
    where: { id: String(mealPlanDayId) },
    select: {
      id: true,
      mealPlanId: true,
      mealPlan: {
        select: {
          trainerId: true,
          clientProfile: {
            select: {
              clientId: true,
            },
          },
        },
      },
    },
  });

  if (!day) {
    throw new AppError("Meal plan day not found", 404);
  }

  if (enforceOwnership) {
    ensureSameUserOrPrivileged(
      access,
      day.mealPlan.trainerId,
      "Forbidden: meal plan does not belong to this trainer",
    );

    return day;
  }

  if (!access.isPrivileged) {
    const isTrainerOwner =
      String(access.userId) === String(day.mealPlan.trainerId);
    const isClientOwner =
      String(access.userId) === String(day.mealPlan.clientProfile?.clientId);

    if (!isTrainerOwner && !isClientOwner) {
      throw new AppError("Forbidden", 403);
    }
  }

  return day;
};

const ensureFoodAndPortion = async (foodId, portionId) => {
  const food = await prisma.food.findUnique({
    where: { id: String(foodId) },
    select: {
      id: true,
      name: true,
      baseGrams: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
      isArchived: true,
    },
  });

  if (!food || food.isArchived) {
    throw new AppError("Food not found or archived", 400);
  }

  const portion = await prisma.foodPortion.findUnique({
    where: {
      id_foodId: {
        id: String(portionId),
        foodId: String(foodId),
      },
    },
    select: {
      id: true,
      label: true,
      grams: true,
    },
  });

  if (!portion) {
    throw new AppError(
      "Invalid portion: portion does not belong to the food",
      400,
    );
  }

  return { food, portion };
};

const buildSnapshot = (food, portion, quantity) => {
  const qty = Number(quantity);
  const perPortionFactor = portion.grams / Number(food.baseGrams || 100);
  const totalFactor = perPortionFactor * qty;

  return {
    foodNameSnapshot: food.name,
    portionLabelSnapshot: portion.label,
    gramsPerPortion: portion.grams,
    caloriesSnapshot: Number(food.calories) * totalFactor,
    proteinSnapshot: Number(food.protein) * totalFactor,
    carbsSnapshot: Number(food.carbs) * totalFactor,
    fatSnapshot: Number(food.fat) * totalFactor,
    quantity: qty,
  };
};

const recalcDayCounters = async (mealPlanDayId) => {
  await recalcMealPlanDayAndSummary(mealPlanDayId);
};

export const addMealPlanItem = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const day = await resolveMealPlanDay(req, access);
    const mealPlanDayId = day.id;

    const foodId = String(req.body.foodId || "").trim();
    const portionId = String(req.body.portionId || "").trim();
    const quantity = parsePositiveNumber(req.body.quantity ?? 1, "quantity");
    const mealTime = normalizeMealTime(req.body.mealTime);
    const sortOrder = parseNonNegativeInteger(
      req.body.sortOrder ?? 0,
      "sortOrder",
    );
    const note = sanitizeOptionalString(req.body.note, "note", 1000);

    if (!foodId || !portionId) {
      return next(new AppError("foodId and portionId are required", 400));
    }

    const { food, portion } = await ensureFoodAndPortion(foodId, portionId);
    const snapshot = buildSnapshot(food, portion, quantity);

    const created = await prisma.mealPlanItem.create({
      data: {
        mealPlanDayId: String(mealPlanDayId),
        foodId,
        portionId,
        mealTime,
        sortOrder,
        note,
        ...snapshot,
      },
      select: {
        id: true,
        mealPlanDayId: true,
        foodId: true,
        food: {
          select: {
            id: true,
            name: true,
          },
        },
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        note: true,
        foodNameSnapshot: true,
        portionLabelSnapshot: true,
        gramsPerPortion: true,
        caloriesSnapshot: true,
        proteinSnapshot: true,
        carbsSnapshot: true,
        fatSnapshot: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await recalcDayCounters(mealPlanDayId);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("mealTime and sortOrder already exist in this day", 409),
      );
    }
    return next(error);
  }
};

export const getMealPlanItemById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER", "CLIENT"],
      "Forbidden",
    );

    const itemId = req.params.itemId;
    if (!itemId) {
      return next(new AppError("Item ID is required", 400));
    }

    const item = await prisma.mealPlanItem.findUnique({
      where: { id: String(itemId) },
      select: {
        id: true,
        mealPlanDayId: true,
        foodId: true,
        food: {
          select: {
            id: true,
            name: true,
          },
        },
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        note: true,
        foodNameSnapshot: true,
        portionLabelSnapshot: true,
        gramsPerPortion: true,
        caloriesSnapshot: true,
        proteinSnapshot: true,
        carbsSnapshot: true,
        fatSnapshot: true,
        createdAt: true,
        updatedAt: true,
        completion: {
          select: {
            id: true,
            completedAt: true,
            note: true,
            clientId: true,
          },
        },
      },
    });

    if (!item) {
      return next(new AppError("Meal plan item not found", 404));
    }

    await ensurePlanAccessFromDay(item.mealPlanDayId, access, false);

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealPlanItemsByDayId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER", "CLIENT"],
      "Forbidden",
    );

    const dayId = req.params.dayId || req.query.dayId;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    await ensurePlanAccessFromDay(dayId, access, false);

    const items = await prisma.mealPlanItem.findMany({
      where: {
        mealPlanDayId: String(dayId),
      },
      orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        mealPlanDayId: true,
        foodId: true,
        food: {
          select: {
            id: true,
            name: true,
          },
        },
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        note: true,
        foodNameSnapshot: true,
        portionLabelSnapshot: true,
        gramsPerPortion: true,
        caloriesSnapshot: true,
        proteinSnapshot: true,
        carbsSnapshot: true,
        fatSnapshot: true,
        createdAt: true,
        updatedAt: true,
        completion: {
          select: {
            id: true,
            completedAt: true,
            note: true,
            clientId: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealPlanItemsByMealPlanId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER", "CLIENT"],
      "Forbidden",
    );

    const mealPlanId = req.params.planId || req.query.planId;
    if (!mealPlanId) {
      return next(new AppError("Meal plan ID is required", 400));
    }

    const plan = await prisma.mealPlan.findUnique({
      where: { id: String(mealPlanId) },
      select: {
        trainerId: true,
        clientProfile: {
          select: {
            clientId: true,
          },
        },
      },
    });

    if (!plan) {
      return next(new AppError("Meal plan not found", 404));
    }

    if (!access.isPrivileged) {
      const isTrainerOwner = String(access.userId) === String(plan.trainerId);
      const isClientOwner =
        String(access.userId) === String(plan.clientProfile?.clientId);

      if (!isTrainerOwner && !isClientOwner) {
        return next(new AppError("Forbidden", 403));
      }
    }

    const items = await prisma.mealPlanItem.findMany({
      where: {
        day: {
          mealPlanId: String(mealPlanId),
        },
      },
      orderBy: [
        { day: { dayIndex: "asc" } },
        { mealTime: "asc" },
        { sortOrder: "asc" },
      ],
      select: {
        id: true,
        mealPlanDayId: true,
        day: {
          select: {
            id: true,
            mealPlanId: true,
            dayIndex: true,
            date: true,
          },
        },
        foodId: true,
        food: {
          select: {
            id: true,
            name: true,
          },
        },
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        note: true,
        foodNameSnapshot: true,
        portionLabelSnapshot: true,
        gramsPerPortion: true,
        caloriesSnapshot: true,
        proteinSnapshot: true,
        carbsSnapshot: true,
        fatSnapshot: true,
        createdAt: true,
        updatedAt: true,
        completion: {
          select: {
            id: true,
            completedAt: true,
            note: true,
            clientId: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMealPlanItemById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const itemId = req.params.itemId;
    if (!itemId) {
      return next(new AppError("Item ID is required", 400));
    }

    const existing = await prisma.mealPlanItem.findUnique({
      where: { id: String(itemId) },
      select: {
        id: true,
        mealPlanDayId: true,
        foodId: true,
        portionId: true,
        quantity: true,
      },
    });

    if (!existing) {
      return next(new AppError("Meal plan item not found", 404));
    }

    await ensurePlanAccessFromDay(existing.mealPlanDayId, access, true);

    const data = {};

    if (req.body.mealTime !== undefined) {
      data.mealTime = normalizeMealTime(req.body.mealTime);
    }

    if (req.body.sortOrder !== undefined) {
      data.sortOrder = parseNonNegativeInteger(req.body.sortOrder, "sortOrder");
    }

    if (req.body.quantity !== undefined) {
      data.quantity = parsePositiveNumber(req.body.quantity, "quantity");
    }

    if (req.body.note !== undefined) {
      data.note = sanitizeOptionalString(req.body.note, "note", 1000);
    }

    const willChangeFood =
      req.body.foodId !== undefined || req.body.portionId !== undefined;
    const willChangeQuantity = req.body.quantity !== undefined;

    if (willChangeFood || willChangeQuantity) {
      const nextFoodId = String(req.body.foodId || existing.foodId);
      const nextPortionId = String(req.body.portionId || existing.portionId);
      const nextQuantity =
        req.body.quantity !== undefined ? data.quantity : existing.quantity;

      const { food, portion } = await ensureFoodAndPortion(
        nextFoodId,
        nextPortionId,
      );
      const snapshot = buildSnapshot(food, portion, nextQuantity);

      data.foodId = nextFoodId;
      data.portionId = nextPortionId;
      data.quantity = snapshot.quantity;
      data.foodNameSnapshot = snapshot.foodNameSnapshot;
      data.portionLabelSnapshot = snapshot.portionLabelSnapshot;
      data.gramsPerPortion = snapshot.gramsPerPortion;
      data.caloriesSnapshot = snapshot.caloriesSnapshot;
      data.proteinSnapshot = snapshot.proteinSnapshot;
      data.carbsSnapshot = snapshot.carbsSnapshot;
      data.fatSnapshot = snapshot.fatSnapshot;
    }

    const updated = await prisma.mealPlanItem.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        mealPlanDayId: true,
        foodId: true,
        food: {
          select: {
            id: true,
            name: true,
          },
        },
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        note: true,
        foodNameSnapshot: true,
        portionLabelSnapshot: true,
        gramsPerPortion: true,
        caloriesSnapshot: true,
        proteinSnapshot: true,
        carbsSnapshot: true,
        fatSnapshot: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("mealTime and sortOrder already exist in this day", 409),
      );
    }
    return next(error);
  }
};

export const removeMealPlanItemById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const itemId = req.params.itemId;
    if (!itemId) {
      return next(new AppError("Item ID is required", 400));
    }

    const existing = await prisma.mealPlanItem.findUnique({
      where: { id: String(itemId) },
      select: {
        id: true,
        mealPlanDayId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Meal plan item not found", 404));
    }

    await ensurePlanAccessFromDay(existing.mealPlanDayId, access, true);

    await prisma.mealPlanItem.delete({
      where: { id: existing.id },
    });

    await recalcDayCounters(existing.mealPlanDayId);

    return res.status(200).json({
      success: true,
      message: "Meal plan item removed",
    });
  } catch (error) {
    return next(error);
  }
};
