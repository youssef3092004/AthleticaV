import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
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

const parseNonNegativeInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
};

const parsePositiveNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
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

const ensureFoodAndPortion = async (foodId, portionId) => {
  const food = await prisma.food.findUnique({
    where: { id: foodId },
    select: { id: true, isArchived: true },
  });

  if (!food || food.isArchived) {
    throw new AppError("Food not found or archived", 400);
  }

  const portion = await prisma.foodPortion.findUnique({
    where: {
      id_foodId: {
        id: portionId,
        foodId,
      },
    },
    select: { id: true, foodId: true },
  });

  if (!portion) {
    throw new AppError(
      "Invalid portion: portion does not belong to the food",
      400,
    );
  }
};

const ensureTemplateOwnership = async (templateId, access) => {
  const template = await prisma.mealTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      trainerId: true,
      isArchived: true,
    },
  });

  if (!template) {
    throw new AppError("Meal template not found", 404);
  }

  if (template.isArchived) {
    throw new AppError("Meal template is archived", 409);
  }

  ensureSameUserOrPrivileged(
    access,
    template.trainerId,
    "Forbidden: template does not belong to this trainer",
  );
};

const ensureTemplateAccess = async (templateId, access) => {
  const template = await prisma.mealTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      trainerId: true,
    },
  });

  if (!template) {
    throw new AppError("Meal template not found", 404);
  }

  if (!access.isPrivileged) {
    ensureSameUserOrPrivileged(
      access,
      template.trainerId,
      "Forbidden: template does not belong to this trainer",
    );
  }

  return template;
};

export const addMealTemplateItem = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const { id: templateId } = req.params;
    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    await ensureTemplateOwnership(templateId, access);

    const {
      dayId,
      dayIndex,
      foodId,
      portionId,
      quantity,
      mealTime,
      sortOrder,
      notes,
    } = req.body;

    if (!foodId || !portionId) {
      return next(new AppError("foodId and portionId are required", 400));
    }

    await ensureFoodAndPortion(foodId, portionId);

    let resolvedDayId = dayId;
    if (!resolvedDayId) {
      if (dayIndex === undefined) {
        return next(new AppError("Provide either dayId or dayIndex", 400));
      }

      const day = await prisma.mealTemplateDay.findUnique({
        where: {
          mealTemplateId_dayIndex: {
            mealTemplateId: templateId,
            dayIndex: parseNonNegativeInteger(dayIndex, "dayIndex"),
          },
        },
        select: { id: true },
      });

      if (!day) {
        return next(new AppError("Template day not found", 404));
      }

      resolvedDayId = day.id;
    } else {
      const day = await prisma.mealTemplateDay.findUnique({
        where: { id: resolvedDayId },
        select: { id: true, mealTemplateId: true },
      });

      if (!day || day.mealTemplateId !== templateId) {
        return next(new AppError("dayId does not belong to the template", 400));
      }
    }

    const created = await prisma.mealTemplateItem.create({
      data: {
        dayId: resolvedDayId,
        foodId,
        portionId,
        quantity: parsePositiveNumber(quantity, "quantity"),
        mealTime: normalizeMealTime(mealTime),
        sortOrder: parseNonNegativeInteger(sortOrder ?? 0, "sortOrder"),
        notes: sanitizeOptionalString(notes, "notes", 1000),
      },
      select: {
        id: true,
        dayId: true,
        foodId: true,
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        notes: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Duplicate sortOrder for this meal slot", 409));
    }
    return next(error);
  }
};

export const getMealTemplateItemById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { itemId } = req.params;
    if (!itemId) {
      return next(new AppError("Item ID is required", 400));
    }

    const item = await prisma.mealTemplateItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        dayId: true,
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
        notes: true,
        createdAt: true,
        day: {
          select: {
            mealTemplateId: true,
          },
        },
      },
    });

    if (!item) {
      return next(new AppError("Meal template item not found", 404));
    }

    await ensureTemplateAccess(item.day.mealTemplateId, access);

    return res.status(200).json({
      success: true,
      data: {
        id: item.id,
        dayId: item.dayId,
        foodId: item.foodId,
        food: item.food,
        portionId: item.portionId,
        quantity: item.quantity,
        mealTime: item.mealTime,
        sortOrder: item.sortOrder,
        notes: item.notes,
        createdAt: item.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMealTemplateItemById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { itemId } = req.params;
    if (!itemId) {
      return next(new AppError("Item ID is required", 400));
    }

    const existing = await prisma.mealTemplateItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        foodId: true,
        portionId: true,
        day: {
          select: {
            mealTemplateId: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Meal template item not found", 404));
    }

    await ensureTemplateOwnership(existing.day.mealTemplateId, access);

    const hasFoodId = req.body.foodId !== undefined;
    const hasPortionId = req.body.portionId !== undefined;
    const resolvedFoodId = hasFoodId ? req.body.foodId : existing.foodId;
    const resolvedPortionId = hasPortionId
      ? req.body.portionId
      : existing.portionId;

    if (hasFoodId || hasPortionId) {
      await ensureFoodAndPortion(resolvedFoodId, resolvedPortionId);
    }

    const data = {};
    if (hasFoodId) data.foodId = resolvedFoodId;
    if (hasPortionId) data.portionId = resolvedPortionId;
    if (req.body.quantity !== undefined) {
      data.quantity = parsePositiveNumber(req.body.quantity, "quantity");
    }
    if (req.body.mealTime !== undefined) {
      data.mealTime = normalizeMealTime(req.body.mealTime);
    }
    if (req.body.sortOrder !== undefined) {
      data.sortOrder = parseNonNegativeInteger(req.body.sortOrder, "sortOrder");
    }
    if (req.body.notes !== undefined) {
      data.notes = sanitizeOptionalString(req.body.notes, "notes", 1000);
    }

    if (Object.keys(data).length === 0) {
      return next(
        new AppError("At least one field is required to update", 400),
      );
    }

    const updated = await prisma.mealTemplateItem.update({
      where: { id: itemId },
      data,
      select: {
        id: true,
        dayId: true,
        foodId: true,
        portionId: true,
        quantity: true,
        mealTime: true,
        sortOrder: true,
        notes: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Duplicate sortOrder for this meal slot", 409));
    }
    return next(error);
  }
};

export const removeMealTemplateItemById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { itemId } = req.params;
    if (!itemId) {
      return next(new AppError("Item ID is required", 400));
    }

    const existing = await prisma.mealTemplateItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        day: {
          select: {
            mealTemplateId: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Meal template item not found", 404));
    }

    await ensureTemplateOwnership(existing.day.mealTemplateId, access);

    await prisma.mealTemplateItem.delete({
      where: { id: itemId },
      select: { id: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: itemId,
      },
    });
  } catch (error) {
    return next(error);
  }
};
