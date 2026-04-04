import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { recalcMealPlanDayAndSummary } from "../utils/mealPlanProgress.js";
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

const parseOptionalDateTime = (value, fieldName) => {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return parsed;
};

const getItemOwnershipContext = async (mealPlanItemId) => {
  const item = await prisma.mealPlanItem.findUnique({
    where: { id: String(mealPlanItemId) },
    select: {
      id: true,
      mealPlanDayId: true,
      day: {
        select: {
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
      },
    },
  });

  if (!item) {
    throw new AppError("Meal plan item not found", 404);
  }

  return {
    mealPlanItemId: item.id,
    mealPlanDayId: item.mealPlanDayId,
    mealPlanId: item.day.mealPlanId,
    trainerId: item.day.mealPlan.trainerId,
    clientId: item.day.mealPlan.clientProfile?.clientId,
  };
};

const getCompletionOwnershipContext = async (completionId) => {
  const completion = await prisma.mealCompletion.findUnique({
    where: { id: String(completionId) },
    select: {
      id: true,
      mealPlanItemId: true,
      clientId: true,
      mealPlanItem: {
        select: {
          mealPlanDayId: true,
          day: {
            select: {
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
          },
        },
      },
    },
  });

  if (!completion) {
    throw new AppError("Meal completion not found", 404);
  }

  return {
    id: completion.id,
    mealPlanItemId: completion.mealPlanItemId,
    mealPlanDayId: completion.mealPlanItem.mealPlanDayId,
    mealPlanId: completion.mealPlanItem.day.mealPlanId,
    trainerId: completion.mealPlanItem.day.mealPlan.trainerId,
    clientId: completion.mealPlanItem.day.mealPlan.clientProfile?.clientId,
    recordedClientId: completion.clientId,
  };
};

const ensureCanViewCompletion = (access, context) => {
  if (access.isPrivileged) return;

  const isTrainerOwner = String(access.userId) === String(context.trainerId);
  const isClientOwner = String(access.userId) === String(context.clientId);

  if (!isTrainerOwner && !isClientOwner) {
    throw new AppError("Forbidden", 403);
  }
};

const ensureClientOwnsCompletion = (access, context) => {
  ensureSameUserOrPrivileged(
    access,
    context.clientId,
    "Forbidden: completion does not belong to this client",
  );
};

const recalcDayCounters = async (mealPlanDayId) => {
  await recalcMealPlanDayAndSummary(mealPlanDayId);
};

const COMPLETION_SELECT = {
  id: true,
  mealPlanItemId: true,
  clientId: true,
  completedAt: true,
  note: true,
  mealPlanItem: {
    select: {
      id: true,
      mealPlanDayId: true,
      mealTime: true,
      sortOrder: true,
      day: {
        select: {
          mealPlanId: true,
          dayIndex: true,
          date: true,
        },
      },
    },
  },
};

export const upsertMealCompletion = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden: client role required",
    );

    const mealPlanItemId = String(req.body.mealPlanItemId || "").trim();
    if (!mealPlanItemId) {
      return next(new AppError("mealPlanItemId is required", 400));
    }

    const context = await getItemOwnershipContext(mealPlanItemId);
    ensureClientOwnsCompletion(access, context);

    const completedAt = parseOptionalDateTime(
      req.body.completedAt,
      "completedAt",
    );
    const note = sanitizeOptionalString(req.body.note, "note", 1000);

    const existing = await prisma.mealCompletion.findUnique({
      where: { mealPlanItemId },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (existing && String(existing.clientId) !== String(context.clientId)) {
      return next(
        new AppError("Completion record is linked to a different client", 409),
      );
    }

    const data = {
      clientId: String(context.clientId),
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(note !== undefined ? { note } : {}),
    };

    const completion = existing
      ? await prisma.mealCompletion.update({
          where: { id: existing.id },
          data,
          select: COMPLETION_SELECT,
        })
      : await prisma.mealCompletion.create({
          data: {
            mealPlanItemId,
            ...data,
          },
          select: COMPLETION_SELECT,
        });

    await recalcDayCounters(context.mealPlanDayId);

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing ? "Meal completion updated" : "Meal completion created",
      data: completion,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealCompletionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const completionId = req.params.completionId;
    if (!completionId) {
      return next(new AppError("Completion ID is required", 400));
    }

    const context = await getCompletionOwnershipContext(completionId);
    ensureCanViewCompletion(access, context);

    const completion = await prisma.mealCompletion.findUnique({
      where: { id: String(completionId) },
      select: COMPLETION_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: completion,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealCompletionByItemId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const mealPlanItemId = req.params.itemId || req.query.itemId;
    if (!mealPlanItemId) {
      return next(new AppError("Meal plan item ID is required", 400));
    }

    const context = await getItemOwnershipContext(mealPlanItemId);
    ensureCanViewCompletion(access, context);

    const completion = await prisma.mealCompletion.findUnique({
      where: { mealPlanItemId: String(mealPlanItemId) },
      select: COMPLETION_SELECT,
    });

    if (!completion) {
      return next(new AppError("Meal completion not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: completion,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMealCompletionsByMealPlanId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
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

    ensureCanViewCompletion(access, {
      trainerId: plan.trainerId,
      clientId: plan.clientProfile?.clientId,
    });

    const completions = await prisma.mealCompletion.findMany({
      where: {
        mealPlanItem: {
          day: {
            mealPlanId: String(mealPlanId),
          },
        },
      },
      orderBy: [
        { mealPlanItem: { day: { dayIndex: "asc" } } },
        { mealPlanItem: { mealTime: "asc" } },
        { mealPlanItem: { sortOrder: "asc" } },
      ],
      select: COMPLETION_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: completions,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMealCompletionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden: client role required",
    );

    const completionId = req.params.completionId;
    if (!completionId) {
      return next(new AppError("Completion ID is required", 400));
    }

    const context = await getCompletionOwnershipContext(completionId);
    ensureClientOwnsCompletion(access, context);

    const data = {};

    if (req.body.completedAt !== undefined) {
      data.completedAt = parseOptionalDateTime(
        req.body.completedAt,
        "completedAt",
      );
    }

    if (req.body.note !== undefined) {
      data.note = sanitizeOptionalString(req.body.note, "note", 1000);
    }

    if (Object.keys(data).length === 0) {
      return next(new AppError("No valid fields to update", 400));
    }

    const updated = await prisma.mealCompletion.update({
      where: { id: String(completionId) },
      data,
      select: COMPLETION_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

export const removeMealCompletionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden: client role required",
    );

    const completionId = req.params.completionId;
    if (!completionId) {
      return next(new AppError("Completion ID is required", 400));
    }

    const context = await getCompletionOwnershipContext(completionId);
    ensureClientOwnsCompletion(access, context);

    await prisma.mealCompletion.delete({
      where: { id: String(completionId) },
    });

    await recalcDayCounters(context.mealPlanDayId);

    return res.status(200).json({
      success: true,
      message: "Meal completion removed",
    });
  } catch (error) {
    return next(error);
  }
};
