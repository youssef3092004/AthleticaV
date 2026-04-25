import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { recalcWorkoutDayAndSummary } from "../utils/workoutProgress.js";
import { calculateUserStreak } from "../utils/streakService.js";
import {
  getWorkoutDayCompletionStatus,
  maybeNotifyTrainerWorkoutDayCompleted,
} from "../utils/completionAlerts.js";

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

const parseOptionalPositiveInteger = (value, fieldName, maxValue = 1000) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AppError(`${fieldName} must be a valid integer`, 400);
  }

  if (parsed <= 0) {
    throw new AppError(`${fieldName} must be greater than 0`, 400);
  }

  if (parsed > maxValue) {
    throw new AppError(
      `${fieldName} must be less than or equal to ${maxValue}`,
      400,
    );
  }

  return parsed;
};

const parseOptionalSetKg = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }

  if (parsed < 0 || parsed > 1000) {
    throw new AppError(`${fieldName} must be between 0 and 1000`, 400);
  }

  return Number(parsed.toFixed(2));
};

const parseOptionalSetReps = (value, fieldName) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new AppError(`${fieldName} must be a valid integer`, 400);
  }

  if (parsed < 0 || parsed > 1000) {
    throw new AppError(`${fieldName} must be between 0 and 1000`, 400);
  }

  return parsed;
};

const parseOptionalPerformedSets = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (!Array.isArray(value)) {
    throw new AppError("performedSets must be an array", 400);
  }

  if (value.length > 100) {
    throw new AppError("performedSets must contain at most 100 sets", 400);
  }

  const normalized = value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new AppError(
        `performedSets[${index}] must be an object with setNumber/kg/reps/isCompleted`,
        400,
      );
    }

    const setNumber = parseOptionalPositiveInteger(
      row.setNumber,
      `performedSets[${index}].setNumber`,
      100,
    );

    if (setNumber === null || setNumber === undefined) {
      throw new AppError(`performedSets[${index}].setNumber is required`, 400);
    }

    const kg = parseOptionalSetKg(row.kg, `performedSets[${index}].kg`);
    const reps = parseOptionalSetReps(row.reps, `performedSets[${index}].reps`);
    const isCompleted =
      row.isCompleted === undefined ? true : Boolean(row.isCompleted);

    return {
      setNumber,
      kg,
      reps,
      isCompleted,
    };
  });

  const uniqueSetNumbers = new Set(normalized.map((row) => row.setNumber));
  if (uniqueSetNumbers.size !== normalized.length) {
    throw new AppError(
      "performedSets contains duplicate setNumber values",
      400,
    );
  }

  return normalized.sort((a, b) => a.setNumber - b.setNumber);
};

const deriveSummaryFromPerformedSets = (performedSets) => {
  if (!Array.isArray(performedSets)) {
    return {};
  }

  const activeSets = performedSets.filter(
    (row) => row.isCompleted || row.kg !== null || row.reps !== null,
  );

  if (activeSets.length === 0) {
    return {
      loggedSets: 0,
      loggedReps: 0,
      loggedWeightKg: null,
    };
  }

  const repsTotal = activeSets.reduce(
    (sum, row) => sum + (row.reps === null ? 0 : Number(row.reps)),
    0,
  );

  const maxKg = activeSets.reduce((max, row) => {
    if (row.kg === null) return max;
    if (max === null || row.kg > max) return row.kg;
    return max;
  }, null);

  return {
    loggedSets: activeSets.length,
    loggedReps: repsTotal,
    loggedWeightKg: maxKg,
  };
};

const toSetPerformanceRows = (completion) => {
  const rows = Array.isArray(completion?.performedSets)
    ? completion.performedSets
        .map((row) => ({
          setNumber: Number(row?.setNumber),
          kg: row?.kg ?? null,
          reps: row?.reps ?? null,
          isCompleted:
            row?.isCompleted === undefined ? true : Boolean(row?.isCompleted),
        }))
        .filter((row) => Number.isInteger(row.setNumber) && row.setNumber > 0)
        .sort((a, b) => a.setNumber - b.setNumber)
    : [];

  if (rows.length > 0) {
    return rows.map((row) => ({
      ...row,
      text:
        row.kg !== null && row.reps !== null
          ? `${row.kg} kg * ${row.reps}`
          : row.kg !== null
            ? `${row.kg} kg`
            : row.reps !== null
              ? `${row.reps} reps`
              : "-",
    }));
  }

  if (
    completion?.loggedWeightKg !== null &&
    completion?.loggedWeightKg !== undefined
  ) {
    return [
      {
        setNumber: 1,
        kg: completion.loggedWeightKg,
        reps: completion?.loggedReps ?? null,
        isCompleted: true,
        text:
          completion?.loggedReps !== null &&
          completion?.loggedReps !== undefined
            ? `${completion.loggedWeightKg} kg * ${completion.loggedReps}`
            : `${completion.loggedWeightKg} kg`,
      },
    ];
  }

  return [];
};

const formatPreviousPerformance = (completion) => {
  if (!completion) return null;

  const setRows = toSetPerformanceRows(completion);

  return {
    completionId: completion.id,
    workoutItemId: completion.workoutItemId,
    completedAt: completion.completedAt,
    loggedSets: completion.loggedSets,
    loggedReps: completion.loggedReps,
    loggedWeightKg: completion.loggedWeightKg,
    performedSets: completion.performedSets,
    note: completion.note,
    setRows,
  };
};

const getPreviousCompletionForItemAndClient = async (
  workoutItemId,
  clientId,
) => {
  const currentItem = await prisma.workoutItem.findUnique({
    where: { id: String(workoutItemId) },
    select: {
      id: true,
      exerciseId: true,
    },
  });

  if (!currentItem) {
    return null;
  }

  const previous = await prisma.workoutCompletion.findFirst({
    where: {
      clientId: String(clientId),
      workoutItemId: {
        not: String(workoutItemId),
      },
      workoutItem: {
        exerciseId: currentItem.exerciseId,
      },
    },
    orderBy: {
      completedAt: "desc",
    },
    select: {
      id: true,
      workoutItemId: true,
      completedAt: true,
      loggedSets: true,
      loggedReps: true,
      loggedWeightKg: true,
      performedSets: true,
      note: true,
    },
  });

  return formatPreviousPerformance(previous);
};

const enrichCompletionWithPreviousPerformance = async (completion) => {
  if (!completion) return completion;

  const previousPerformance = await getPreviousCompletionForItemAndClient(
    completion.workoutItemId,
    completion.clientId,
  );

  return {
    ...completion,
    previousPerformance,
  };
};

const enrichManyCompletionsWithPreviousPerformance = async (completions) => {
  const enriched = await Promise.all(
    completions.map((completion) =>
      enrichCompletionWithPreviousPerformance(completion),
    ),
  );

  return enriched;
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
  loggedSets: true,
  loggedReps: true,
  loggedWeightKg: true,
  performedSets: true,
  note: true,
  workoutItem: {
    select: {
      id: true,
      workoutDayId: true,
      exerciseId: true,
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

    const dayStatusBefore = await getWorkoutDayCompletionStatus(
      context.workoutDayId,
    );

    const completedAt = parseOptionalDateTime(
      req.body.completedAt,
      "completedAt",
    );
    const loggedSets = parseOptionalPositiveInteger(
      req.body.loggedSets,
      "loggedSets",
      100,
    );
    const loggedReps = parseOptionalPositiveInteger(
      req.body.loggedReps,
      "loggedReps",
      1000,
    );
    const loggedWeightKg = parseOptionalWeightKg(req.body.loggedWeightKg);
    const performedSets = parseOptionalPerformedSets(req.body.performedSets);
    const note = sanitizeOptionalString(req.body.note, "note", 1000);

    const derivedSummary =
      performedSets !== undefined && performedSets !== null
        ? deriveSummaryFromPerformedSets(performedSets)
        : {};

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
      ...(performedSets !== undefined ? { performedSets } : {}),
      ...(loggedSets !== undefined ? { loggedSets } : {}),
      ...(loggedReps !== undefined ? { loggedReps } : {}),
      ...(loggedWeightKg !== undefined ? { loggedWeightKg } : {}),
      ...(note !== undefined ? { note } : {}),
    };

    if (performedSets !== undefined) {
      if (
        data.loggedSets === undefined &&
        derivedSummary.loggedSets !== undefined
      ) {
        data.loggedSets = derivedSummary.loggedSets;
      }

      if (
        data.loggedReps === undefined &&
        derivedSummary.loggedReps !== undefined
      ) {
        data.loggedReps = derivedSummary.loggedReps;
      }

      if (
        data.loggedWeightKg === undefined &&
        derivedSummary.loggedWeightKg !== undefined
      ) {
        data.loggedWeightKg = derivedSummary.loggedWeightKg;
      }
    }

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
    await calculateUserStreak(context.clientId);

    try {
      const dayStatusAfter = await getWorkoutDayCompletionStatus(
        context.workoutDayId,
      );

      await maybeNotifyTrainerWorkoutDayCompleted({
        before: dayStatusBefore,
        after: dayStatusAfter,
      });
    } catch (notificationError) {
      console.error(
        "Workout completion notification failed",
        notificationError,
      );
    }

    const enrichedCompletion =
      await enrichCompletionWithPreviousPerformance(completion);

    return res.status(existing ? 200 : 201).json({
      success: true,
      message: existing
        ? "Workout completion updated"
        : "Workout completion created",
      data: enrichedCompletion,
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

    const enrichedCompletion =
      await enrichCompletionWithPreviousPerformance(completion);

    return res.status(200).json({
      success: true,
      data: enrichedCompletion,
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

    const enrichedCompletion =
      await enrichCompletionWithPreviousPerformance(completion);

    return res.status(200).json({
      success: true,
      data: enrichedCompletion,
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

    const enrichedCompletions =
      await enrichManyCompletionsWithPreviousPerformance(completions);

    return res.status(200).json({
      success: true,
      data: enrichedCompletions,
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

    const performedSets = parseOptionalPerformedSets(req.body.performedSets);
    if (performedSets !== undefined) {
      data.performedSets = performedSets;
      const derivedSummary =
        performedSets === null
          ? {}
          : deriveSummaryFromPerformedSets(performedSets);

      if (
        req.body.loggedSets === undefined &&
        derivedSummary.loggedSets !== undefined
      ) {
        data.loggedSets = derivedSummary.loggedSets;
      }

      if (
        req.body.loggedReps === undefined &&
        derivedSummary.loggedReps !== undefined
      ) {
        data.loggedReps = derivedSummary.loggedReps;
      }

      if (
        req.body.loggedWeightKg === undefined &&
        derivedSummary.loggedWeightKg !== undefined
      ) {
        data.loggedWeightKg = derivedSummary.loggedWeightKg;
      }
    }

    if (req.body.loggedSets !== undefined) {
      data.loggedSets = parseOptionalPositiveInteger(
        req.body.loggedSets,
        "loggedSets",
        100,
      );
    }

    if (req.body.loggedReps !== undefined) {
      data.loggedReps = parseOptionalPositiveInteger(
        req.body.loggedReps,
        "loggedReps",
        1000,
      );
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

    const enrichedUpdated =
      await enrichCompletionWithPreviousPerformance(updated);

    return res.status(200).json({
      success: true,
      data: enrichedUpdated,
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
    await calculateUserStreak(context.clientId);

    return res.status(200).json({
      success: true,
      message: "Workout completion removed",
    });
  } catch (error) {
    return next(error);
  }
};
