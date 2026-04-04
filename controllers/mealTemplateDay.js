import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

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

export const addMealTemplateDay = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const templateId =
      req.params.id || req.params.templateId || req.body.templateId;
    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    await ensureTemplateOwnership(templateId, access);

    const dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    const label = sanitizeOptionalString(req.body.label, "label", 200);

    const created = await prisma.mealTemplateDay.create({
      data: {
        mealTemplateId: templateId,
        dayIndex,
        label,
      },
      select: {
        id: true,
        mealTemplateId: true,
        dayIndex: true,
        label: true,
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

export const getMealTemplateDayById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { dayId } = req.params;
    const templateId = req.params.id || req.params.templateId;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    const day = await prisma.mealTemplateDay.findFirst({
      where: {
        id: dayId,
        ...(templateId ? { mealTemplateId: templateId } : {}),
      },
      select: {
        id: true,
        mealTemplateId: true,
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
    });

    if (!day) {
      return next(new AppError("Meal template day not found", 404));
    }

    await ensureTemplateAccess(day.mealTemplateId, access);

    return res.status(200).json({
      success: true,
      data: day,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealTemplateDaysByTemplateId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const templateId =
      req.params.id || req.params.templateId || req.query.templateId;
    if (!templateId) {
      return next(new AppError("Template ID is required", 400));
    }

    await ensureTemplateAccess(templateId, access);

    const days = await prisma.mealTemplateDay.findMany({
      where: {
        mealTemplateId: templateId,
      },
      orderBy: {
        dayIndex: "asc",
      },
      select: {
        id: true,
        mealTemplateId: true,
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
    });

    return res.status(200).json({
      success: true,
      data: days,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeMealTemplateDayById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { dayId } = req.params;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    const day = await prisma.mealTemplateDay.findUnique({
      where: { id: dayId },
      select: {
        id: true,
        mealTemplateId: true,
      },
    });

    if (!day) {
      return next(new AppError("Meal template day not found", 404));
    }

    await ensureTemplateOwnership(day.mealTemplateId, access);

    await prisma.mealTemplateDay.delete({
      where: { id: dayId },
      select: { id: true },
    });

    return res.status(200).json({
      success: true,
      data: {
        id: dayId,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMealTemplateDayById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { dayId } = req.params;
    if (!dayId) {
      return next(new AppError("Day ID is required", 400));
    }

    const existingDay = await prisma.mealTemplateDay.findUnique({
      where: { id: dayId },
      select: {
        id: true,
        mealTemplateId: true,
      },
    });

    if (!existingDay) {
      return next(new AppError("Meal template day not found", 404));
    }

    await ensureTemplateOwnership(existingDay.mealTemplateId, access);

    const data = {};
    if (req.body.dayIndex !== undefined) {
      data.dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    }
    if (req.body.label !== undefined) {
      data.label = sanitizeOptionalString(req.body.label, "label", 200);
    }

    if (Object.keys(data).length === 0) {
      return next(
        new AppError("At least one field is required to update", 400),
      );
    }

    const updated = await prisma.mealTemplateDay.update({
      where: { id: dayId },
      data,
      select: {
        id: true,
        mealTemplateId: true,
        dayIndex: true,
        label: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      data: updated,
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
