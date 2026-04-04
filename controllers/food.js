import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const ALLOWED_SORT_FIELDS = ["name", "createdAt", "updatedAt", "id"];

const parsePositiveNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
  }
  return parsed;
};

const parseNonNegativeNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative number`, 400);
  }
  return parsed;
};

const parseOptionalBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1";
};

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

const sanitizePortions = (portions) => {
  if (portions === undefined) return undefined;
  if (!Array.isArray(portions)) {
    throw new AppError("portions must be an array", 400);
  }

  const seenLabels = new Set();

  return portions.map((portion, index) => {
    if (!portion || typeof portion !== "object") {
      throw new AppError(`portions[${index}] must be an object`, 400);
    }

    const label = sanitizeRequiredString(
      portion.label,
      `portions[${index}].label`,
      100,
    );
    const normalizedLabel = label.toLowerCase();
    if (seenLabels.has(normalizedLabel)) {
      throw new AppError("portion labels must be unique per food", 400);
    }
    seenLabels.add(normalizedLabel);

    return {
      label,
      grams: parsePositiveNumber(portion.grams, `portions[${index}].grams`),
    };
  });
};

export const createFoodCategory = async (req, res, next) => {
  try {
    const name = sanitizeRequiredString(req.body.name, "name", 100);

    const created = await prisma.foodCategory.create({
      data: { name },
      select: { id: true, name: true },
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Food category already exists", 409));
    }
    return next(error);
  }
};

export const getFoodCategories = async (req, res, next) => {
  try {
    const categories = await prisma.foodCategory.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    return next(error);
  }
};

export const getFoods = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "name",
      defaultOrder: "asc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = {};

    if (req.query.search) {
      where.name = {
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

    const [total, foods] = await prisma.$transaction([
      prisma.food.count({ where }),
      prisma.food.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          name: true,
          baseGrams: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: foods,
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

export const createFood = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["ADMIN", "DEVELOPER", "OWNER"],
      "Forbidden: only admins can create food items",
    );

    const categoryId = sanitizeRequiredString(
      req.body.categoryId,
      "categoryId",
      100,
    );
    const name = sanitizeRequiredString(req.body.name, "name", 200);
    const baseGrams =
      req.body.baseGrams === undefined ? 100 : Number(req.body.baseGrams);
    if (baseGrams !== 100) {
      return next(new AppError("baseGrams must always be 100", 400));
    }
    const calories = parseNonNegativeNumber(req.body.calories, "calories");
    const protein = parseNonNegativeNumber(req.body.protein, "protein");
    const carbs = parseNonNegativeNumber(req.body.carbs, "carbs");
    const fat = parseNonNegativeNumber(req.body.fat, "fat");
    const portions = sanitizePortions(req.body.portions);

    const created = await prisma.$transaction(async (tx) => {
      const category = await tx.foodCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new AppError("Food category not found", 404);
      }

      const food = await tx.food.create({
        data: {
          categoryId,
          name,
          baseGrams,
          calories,
          protein,
          carbs,
          fat,
        },
        select: {
          id: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          name: true,
          baseGrams: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (portions && portions.length > 0) {
        await tx.foodPortion.createMany({
          data: portions.map((portion) => ({
            foodId: food.id,
            label: portion.label,
            grams: portion.grams,
          })),
        });
      }

      const foodWithPortions = await tx.food.findUnique({
        where: { id: food.id },
        select: {
          id: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          name: true,
          baseGrams: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          portions: {
            select: {
              id: true,
              label: true,
              grams: true,
            },
            orderBy: {
              label: "asc",
            },
          },
        },
      });

      return foodWithPortions;
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Food or portion uniqueness conflict", 409));
    }
    return next(error);
  }
};

export const getFoodPortions = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Food ID is required", 400));
    }

    const food = await prisma.food.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        name: true,
        baseGrams: true,
        isArchived: true,
        portions: {
          select: {
            id: true,
            label: true,
            grams: true,
          },
          orderBy: {
            label: "asc",
          },
        },
      },
    });

    if (!food) {
      return next(new AppError("Food not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: food,
    });
  } catch (error) {
    return next(error);
  }
};

export const getFoodByCategoryId = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Food category ID is required", 400));
    }

    const foods = await prisma.food.findMany({
      where: { categoryId: id, isArchived: false },
      select: {
        id: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        name: true,
        baseGrams: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      data: foods,
    });
  } catch (error) {
    return next(error);
  }
};
