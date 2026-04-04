import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt", "title", "id"];

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

const parseOptionalBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1";
};

const ensureTemplateAccess = (access, trainerId) => {
  if (!access.isPrivileged) {
    ensureSameUserOrPrivileged(
      access,
      trainerId,
      "Forbidden: template does not belong to this trainer",
    );
  }
};

const ensureTemplateOwnership = (access, trainerId) => {
  ensureSameUserOrPrivileged(
    access,
    trainerId,
    "Forbidden: template does not belong to this trainer",
  );
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
    const isPublic = parseOptionalBoolean(req.body.isPublic, false);

    const created = await prisma.mealTemplate.create({
      data: {
        trainerId,
        title,
        description,
        isPublic,
      },
      select: {
        id: true,
        trainerId: true,
        title: true,
        description: true,
        isPublic: true,
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
          isPublic: true,
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
              label: true,
              items: {
                orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
                select: {
                  id: true,
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

export const getMealTemplateByTemplateId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const templateId = req.params.templateId || req.params.id;
    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    const template = await prisma.mealTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        trainerId: true,
        title: true,
        description: true,
        isPublic: true,
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
            label: true,
            createdAt: true,
            items: {
              orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
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
              },
            },
          },
        },
      },
    });

    if (!template) {
      return next(new AppError("Meal template not found", 404));
    }

    ensureTemplateAccess(access, template.trainerId);

    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMealTemplateByTemplateId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const templateId = req.params.templateId || req.params.id;
    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    const existing = await prisma.mealTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        trainerId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Meal template not found", 404));
    }

    ensureTemplateOwnership(access, existing.trainerId);

    await prisma.mealTemplate.delete({
      where: { id: templateId },
      select: { id: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: templateId,
      },
    });
  } catch (error) {
    return next(error);
  }
};
