import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { recalcWorkoutDayAndSummary } from "../utils/workoutProgress.js";

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyWorkoutCompletion = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
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

const parseOptionalDateTime = (value, fieldName) => {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return parsed;
};

const parseOptionalWeightKg = (value, fieldName = "loggedWeightKg") => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }

  if (parsed < 0) {
    throw new AppError(`${fieldName} must be greater than or equal to 0`, 400);
  }

  if (parsed > 1000) {
    throw new AppError(`${fieldName} must be less than or equal to 1000`, 400);
  }

  return Number(parsed.toFixed(2));
};

const ensureOwnOrPrivileged = (req, trainerId, clientId) => {
  if (canManageAnyWorkoutCompletion(req.user)) return true;

  const requesterId = getUserId(req);
  return (
    requesterId &&
    (String(requesterId) === String(trainerId) ||
      String(requesterId) === String(clientId))
  );
};

const ensureClientOrPrivileged = (req, clientId) => {
  if (canManageAnyWorkoutCompletion(req.user)) return true;
  const requesterId = getUserId(req);
  return requesterId && String(requesterId) === String(clientId);
};

const getItemOwnershipContext = async (workoutItemId) => {
  const item = await prisma.workoutItem.findUnique({
    where: { id: String(workoutItemId) },
    select: {
      id: true,
      workoutDayId: true,
      day: {
        select: {
          workoutId: true,
          workout: {
            select: {
              trainerId: true,
              clientId: true,
            },
          },
        },
      },
    },
  });

  if (!item) {
    throw new AppError("Workout item not found", 404);
  }

  return {
    workoutItemId: item.id,
    workoutDayId: item.workoutDayId,
    workoutId: item.day.workoutId,
    trainerId: item.day.workout.trainerId,
    clientId: item.day.workout.clientId,
  };
};

const getCompletionOwnershipContext = async (completionId) => {
  const completion = await prisma.workoutCompletion.findUnique({
    where: { id: String(completionId) },
    select: {
      id: true,
      workoutItemId: true,
      clientId: true,
      workoutItem: {
        select: {
          workoutDayId: true,
          day: {
            select: {
              workoutId: true,
              workout: {
                select: {
                  trainerId: true,
                  clientId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!completion) {
    throw new AppError("Workout completion not found", 404);
  }

  return {
    id: completion.id,
    workoutItemId: completion.workoutItemId,
    workoutDayId: completion.workoutItem.workoutDayId,
    workoutId: completion.workoutItem.day.workoutId,
    trainerId: completion.workoutItem.day.workout.trainerId,
    clientId: completion.workoutItem.day.workout.clientId,
    recordedClientId: completion.clientId,
  };
};

const COMPLETION_SELECT = {
  id: true,
  workoutItemId: true,
  clientId: true,
  completedAt: true,
  loggedWeightKg: true,
  note: true,
  workoutItem: {
    select: {
      id: true,
      workoutDayId: true,
      order: true,
      day: {
        select: {
          workoutId: true,
          dayIndex: true,
          date: true,
        },
      },
    },
  },
};

export const upsertWorkoutCompletion = async (req, res, next) => {
  try {
    const workoutItemId = String(req.body.workoutItemId || "").trim();
    if (!workoutItemId) {
      return next(new AppError("workoutItemId is required", 400));
    }

    const context = await getItemOwnershipContext(workoutItemId);

    if (!ensureClientOrPrivileged(req, context.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const completedAt = parseOptionalDateTime(
      req.body.completedAt,
      "completedAt",
    );
    const loggedWeightKg = parseOptionalWeightKg(req.body.loggedWeightKg);
    const note = sanitizeOptionalString(req.body.note, "note", 1000);

    const existing = await prisma.workoutCompletion.findUnique({
      where: { workoutItemId },
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
      ...(loggedWeightKg !== undefined ? { loggedWeightKg } : {}),
      ...(note !== undefined ? { note } : {}),
    };

    const completion = existing
      ? await prisma.workoutCompletion.update({
          where: { id: existing.id },
          data,
          select: COMPLETION_SELECT,
        })
      : await prisma.workoutCompletion.create({
          data: {
            workoutItemId,
            ...data,
          },
          select: COMPLETION_SELECT,
        });

    await recalcWorkoutDayAndSummary(context.workoutDayId);

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing
        ? "Workout completion updated"
        : "Workout completion created",
      data: completion,
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutCompletionById = async (req, res, next) => {
  try {
    const completionId = req.params.completionId;
    if (!completionId) {
      return next(new AppError("Completion ID is required", 400));
    }

    const context = await getCompletionOwnershipContext(completionId);
    if (!ensureOwnOrPrivileged(req, context.trainerId, context.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const completion = await prisma.workoutCompletion.findUnique({
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

export const getWorkoutCompletionByItemId = async (req, res, next) => {
  try {
    const workoutItemId = req.params.itemId || req.query.itemId;
    if (!workoutItemId) {
      return next(new AppError("Workout item ID is required", 400));
    }

    const context = await getItemOwnershipContext(workoutItemId);
    if (!ensureOwnOrPrivileged(req, context.trainerId, context.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const completion = await prisma.workoutCompletion.findUnique({
      where: { workoutItemId: String(workoutItemId) },
      select: COMPLETION_SELECT,
    });

    if (!completion) {
      return next(new AppError("Workout completion not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: completion,
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutCompletionsByWorkoutId = async (req, res, next) => {
  try {
    const workoutId = req.params.workoutId || req.query.workoutId;
    if (!workoutId) {
      return next(new AppError("Workout ID is required", 400));
    }

    const workout = await prisma.workout.findUnique({
      where: { id: String(workoutId) },
      select: {
        trainerId: true,
        clientId: true,
      },
    });

    if (!workout) {
      return next(new AppError("Workout not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, workout.trainerId, workout.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const completions = await prisma.workoutCompletion.findMany({
      where: {
        workoutItem: {
          day: {
            workoutId: String(workoutId),
          },
        },
      },
      orderBy: [
        { workoutItem: { day: { dayIndex: "asc" } } },
        { workoutItem: { order: "asc" } },
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

export const updateWorkoutCompletionById = async (req, res, next) => {
  try {
    const completionId = req.params.completionId;
    if (!completionId) {
      return next(new AppError("Completion ID is required", 400));
    }

    const context = await getCompletionOwnershipContext(completionId);
    if (!ensureClientOrPrivileged(req, context.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

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

    if (req.body.loggedWeightKg !== undefined) {
      data.loggedWeightKg = parseOptionalWeightKg(req.body.loggedWeightKg);
    }

    if (Object.keys(data).length === 0) {
      return next(new AppError("No valid fields to update", 400));
    }

    const updated = await prisma.workoutCompletion.update({
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

export const removeWorkoutCompletionById = async (req, res, next) => {
  try {
    const completionId = req.params.completionId;
    if (!completionId) {
      return next(new AppError("Completion ID is required", 400));
    }

    const context = await getCompletionOwnershipContext(completionId);
    if (!ensureClientOrPrivileged(req, context.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workoutCompletion.delete({
      where: { id: String(completionId) },
    });

    await recalcWorkoutDayAndSummary(context.workoutDayId);

    return res.status(200).json({
      success: true,
      message: "Workout completion removed",
    });
  } catch (error) {
    return next(error);
  }
};
