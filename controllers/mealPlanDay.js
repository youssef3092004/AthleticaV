import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { recalcMealPlanSummary } from "../utils/mealPlanProgress.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const parseNonNegativeInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
};

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const ensurePlanOwnership = async (mealPlanId, access) => {
  const plan = await prisma.mealPlan.findUnique({
    where: { id: String(mealPlanId) },
    select: {
      id: true,
      trainerId: true,
    },
  });

  if (!plan) {
    throw new AppError("Meal plan not found", 404);
  }

  ensureSameUserOrPrivileged(
    access,
    plan.trainerId,
    "Forbidden: meal plan does not belong to this trainer",
  );

  return plan;
};

export const addMealPlanDay = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const mealPlanId =
      req.params.planId || req.params.id || req.body.mealPlanId;
    if (!mealPlanId) {
      return next(new AppError("Meal plan ID is required", 400));
    }

    await ensurePlanOwnership(mealPlanId, access);

    const dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    const date = parseDateOnly(req.body.date, "date");

    const created = await prisma.mealPlanDay.create({
      data: {
        mealPlanId: String(mealPlanId),
        dayIndex,
        date,
      },
      select: {
        id: true,
        mealPlanId: true,
        dayIndex: true,
        date: true,
        completedCount: true,
        totalCount: true,
        percentage: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFats: true,
        createdAt: true,
      },
    });

    await recalcMealPlanSummary(created.mealPlanId);

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex or date already exists for this meal plan", 409),
      );
    }
    return next(error);
  }
};

export const getMealPlanDayById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER", "CLIENT"],
      "Forbidden",
    );

    const dayId = req.params.dayId;
    const planId = req.params.planId || req.query.planId;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    const day = await prisma.mealPlanDay.findFirst({
      where: {
        id: String(dayId),
        ...(planId ? { mealPlanId: String(planId) } : {}),
      },
      select: {
        id: true,
        mealPlanId: true,
        dayIndex: true,
        date: true,
        completedCount: true,
        totalCount: true,
        percentage: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFats: true,
        createdAt: true,
        items: {
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
        },
      },
    });

    if (!day) {
      return next(new AppError("Meal plan day not found", 404));
    }

    const plan = await prisma.mealPlan.findUnique({
      where: { id: day.mealPlanId },
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

    return res.status(200).json({
      success: true,
      data: day,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealPlanDaysByPlanId = async (req, res, next) => {
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

    const days = await prisma.mealPlanDay.findMany({
      where: {
        mealPlanId: String(mealPlanId),
      },
      orderBy: {
        dayIndex: "asc",
      },
      select: {
        id: true,
        mealPlanId: true,
        dayIndex: true,
        date: true,
        completedCount: true,
        totalCount: true,
        percentage: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFats: true,
        createdAt: true,
        items: {
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
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: days,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMealPlanDayById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    const existing = await prisma.mealPlanDay.findUnique({
      where: { id: String(dayId) },
      select: {
        id: true,
        mealPlanId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Meal plan day not found", 404));
    }

    await ensurePlanOwnership(existing.mealPlanId, access);

    const data = {};

    if (req.body.dayIndex !== undefined) {
      data.dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    }

    if (req.body.date !== undefined) {
      data.date = parseDateOnly(req.body.date, "date");
    }

    const updated = await prisma.mealPlanDay.update({
      where: { id: existing.id },
      data,
      select: {
        id: true,
        mealPlanId: true,
        dayIndex: true,
        date: true,
        completedCount: true,
        totalCount: true,
        percentage: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFats: true,
        createdAt: true,
      },
    });

    await recalcMealPlanSummary(updated.mealPlanId);

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex or date already exists for this meal plan", 409),
      );
    }
    return next(error);
  }
};

export const removeMealPlanDayById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    const existing = await prisma.mealPlanDay.findUnique({
      where: { id: String(dayId) },
      select: {
        id: true,
        mealPlanId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Meal plan day not found", 404));
    }

    await ensurePlanOwnership(existing.mealPlanId, access);

    await prisma.mealPlanDay.delete({
      where: { id: existing.id },
    });

    await recalcMealPlanSummary(existing.mealPlanId);

    return res.status(200).json({
      success: true,
      message: "Meal plan day removed",
    });
  } catch (error) {
    return next(error);
  }
};
