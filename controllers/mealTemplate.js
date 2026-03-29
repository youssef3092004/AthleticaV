import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt", "title", "id"];
const ALLOWED_MEAL_TIMES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

const sanitizeRequiredString = (value, fieldName, maxLength = 200) => {
  const parsed = String(value || "").trim();
  if (!parsed) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (parsed.length > maxLength) {
    throw new AppError(
      `${fieldName} must be at most ${maxLength} characters`,
      400,
    );
  }

  return parsed;
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

const parseOptionalBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1";
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

  return template;
};

export const createMealTemplate = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const trainerId = req.body.trainerId || access.userId;
    ensureSameUserOrPrivileged(
      access,
      trainerId,
      "Forbidden: trainerId must match authenticated trainer",
    );

    const title = sanitizeRequiredString(req.body.title, "title", 200);
    const description = sanitizeOptionalString(
      req.body.description,
      "description",
      2000,
    );

    const created = await prisma.mealTemplate.create({
      data: {
        trainerId,
        title,
        description,
      },
      select: {
        id: true,
        trainerId: true,
        title: true,
        description: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealTemplates = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "updatedAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = {};

    if (!access.isPrivileged) {
      where.trainerId = access.userId;
    } else if (req.query.trainerId) {
      where.trainerId = String(req.query.trainerId);
    }

    if (req.query.search) {
      where.title = {
        contains: String(req.query.search).trim(),
        mode: "insensitive",
      };
    }

    const includeArchived = parseOptionalBoolean(
      req.query.includeArchived,
      false,
    );
    if (!includeArchived) {
      where.isArchived = false;
    }

    const [total, templates] = await prisma.$transaction([
      prisma.mealTemplate.count({ where }),
      prisma.mealTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          trainerId: true,
          title: true,
          description: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          days: {
            orderBy: {
              dayIndex: "asc",
            },
            select: {
              id: true,
              dayIndex: true,
              items: {
                orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
                select: {
                  id: true,
                  foodId: true,
                  portionId: true,
                  quantity: true,
                  mealTime: true,
                  sortOrder: true,
                  notes: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: templates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        sort,
        order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const addMealTemplateDay = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const { id: templateId } = req.params;
    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    await ensureTemplateOwnership(templateId, access);

    const dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");

    const created = await prisma.mealTemplateDay.create({
      data: {
        mealTemplateId: templateId,
        dayIndex,
      },
      select: {
        id: true,
        mealTemplateId: true,
        dayIndex: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex already exists for this template", 409),
      );
    }
    return next(error);
  }
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
