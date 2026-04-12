import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_METRICS = ["WEIGHT", "BODY_FAT", "MUSCLE"];
const ALLOWED_SORT_FIELDS = ["recordedAt", "createdAt", "id", "value"];

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const parseNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }
  return parsed;
};

const normalizeMetric = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!ALLOWED_METRICS.includes(normalized)) {
    throw new AppError("Invalid metric", 400);
  }

  return normalized;
};

const ensureClientBelongsToTrainerIfNeeded = async (access, userId) => {
  if (access.isPrivileged) return;

  const isSelf = String(access.userId) === String(userId);
  if (isSelf) return;

  ensureHasAnyRole(access, ["TRAINER"], "Forbidden");

  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: access.userId,
        clientId: userId,
      },
    },
    select: {
      status: true,
    },
  });

  if (!relation || relation.status !== "ACTIVE") {
    throw new AppError(
      "Forbidden: client is not assigned to this trainer",
      403,
    );
  }
};

const calculateCompletionPercentage = (completedCount, totalCount) => {
  const completed = Number(completedCount) || 0;
  const total = Number(totalCount) || 0;
  if (total <= 0) return 0;
  return Number(((completed / total) * 100).toFixed(2));
};

const resolveTrainerForWowMoment = async (
  access,
  clientId,
  trainerIdFromQuery,
) => {
  if (!access.isPrivileged) {
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden");
    await ensureClientBelongsToTrainerIfNeeded(access, clientId);
    return access.userId;
  }

  if (trainerIdFromQuery) {
    return trainerIdFromQuery;
  }

  const relation = await prisma.trainerClient.findFirst({
    where: {
      clientId,
      status: "ACTIVE",
    },
    select: { trainerId: true },
    orderBy: { startedAt: "desc" },
  });

  if (!relation) {
    throw new AppError(
      "No active trainer-client relationship found for this client",
      404,
    );
  }

  return relation.trainerId;
};

export const createProgressMetric = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["CLIENT", "TRAINER"], "Forbidden");

    const userId = String(req.body.userId || access.userId).trim();
    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    await ensureClientBelongsToTrainerIfNeeded(access, userId);

    const metric = normalizeMetric(req.body.metric);
    const value = parseNumber(req.body.value, "value");
    const recordedAt = parseDateOnly(req.body.recordedAt, "recordedAt");

    const created = await prisma.progressMetric.create({
      data: {
        userId,
        metric,
        value,
        recordedAt,
      },
      select: {
        id: true,
        userId: true,
        metric: true,
        value: true,
        recordedAt: true,
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

export const getProgressMetrics = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "recordedAt",
      defaultOrder: "desc",
      defaultLimit: 30,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const userId = req.query.userId
      ? String(req.query.userId).trim()
      : access.userId;
    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    if (!access.isPrivileged) {
      const isSelf = String(access.userId) === String(userId);
      if (!isSelf) {
        ensureHasAnyRole(access, ["TRAINER"], "Forbidden");
        await ensureClientBelongsToTrainerIfNeeded(access, userId);
      } else {
        ensureSameUserOrPrivileged(access, userId);
      }
    }

    const where = {
      userId,
    };

    if (req.query.metric !== undefined) {
      where.metric = normalizeMetric(req.query.metric);
    }

    if (req.query.recordedAtFrom || req.query.recordedAtTo) {
      where.recordedAt = {};

      if (req.query.recordedAtFrom) {
        where.recordedAt.gte = parseDateOnly(
          req.query.recordedAtFrom,
          "recordedAtFrom",
        );
      }

      if (req.query.recordedAtTo) {
        where.recordedAt.lte = parseDateOnly(
          req.query.recordedAtTo,
          "recordedAtTo",
        );
      }
    }

    const [total, metrics] = await prisma.$transaction([
      prisma.progressMetric.count({ where }),
      prisma.progressMetric.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          userId: true,
          metric: true,
          value: true,
          recordedAt: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: metrics,
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

export const getCoachWowMoment = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const clientId = String(req.params.clientId || "").trim();
    const trainerIdFromQuery = req.query.trainerId
      ? String(req.query.trainerId).trim()
      : null;

    if (!clientId) {
      return next(new AppError("clientId is required", 400));
    }

    const trainerId = await resolveTrainerForWowMoment(
      access,
      clientId,
      trainerIdFromQuery,
    );

    const [latestWorkoutResult, mealPlanResult, latestCoachMessageResult] =
      await Promise.allSettled([
        prisma.workout.findFirst({
          where: {
            trainerId,
            clientId,
          },
          orderBy: [{ endDate: "desc" }, { startDate: "desc" }],
          select: {
            id: true,
            startDate: true,
            endDate: true,
            totalCount: true,
            completedCount: true,
          },
        }),
        prisma.mealPlan.findFirst({
          where: {
            trainerId,
            clientProfile: {
              clientId,
            },
          },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            totalCount: true,
            completedCount: true,
            startDate: true,
            endDate: true,
          },
        }),
        prisma.message.findFirst({
          where: {
            senderId: trainerId,
            conversation: {
              trainerId,
              clientId,
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            conversationId: true,
            body: true,
            createdAt: true,
          },
        }),
      ]);

    const sectionStatus = {
      workout: latestWorkoutResult.status === "fulfilled" ? "ok" : "error",
      meals: mealPlanResult.status === "fulfilled" ? "ok" : "error",
      latestCoachMessage:
        latestCoachMessageResult.status === "fulfilled" ? "ok" : "error",
      loggedWeights: "ok",
    };

    const latestWorkout =
      latestWorkoutResult.status === "fulfilled"
        ? latestWorkoutResult.value
        : null;
    const mealPlan =
      mealPlanResult.status === "fulfilled" ? mealPlanResult.value : null;
    const latestCoachMessage =
      latestCoachMessageResult.status === "fulfilled"
        ? latestCoachMessageResult.value
        : null;

    const workoutCompletionPercentage = latestWorkout
      ? calculateCompletionPercentage(
          latestWorkout.completedCount,
          latestWorkout.totalCount,
        )
      : 0;

    const workoutStatus = latestWorkout
      ? latestWorkout.totalCount > 0 &&
        latestWorkout.completedCount >= latestWorkout.totalCount
        ? "DONE"
        : latestWorkout.completedCount > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED"
      : "NO_WORKOUT";

    const mealCompletionPercentage = mealPlan
      ? calculateCompletionPercentage(
          mealPlan.completedCount,
          mealPlan.totalCount,
        )
      : 0;

    let loggedWeightRows = [];
    if (latestWorkout) {
      try {
        loggedWeightRows = await prisma.workoutCompletion.findMany({
          where: {
            clientId,
            loggedWeightKg: { not: null },
            workoutItem: {
              day: {
                workoutId: latestWorkout.id,
              },
            },
          },
          orderBy: { completedAt: "desc" },
          select: {
            workoutItemId: true,
            loggedWeightKg: true,
            completedAt: true,
            workoutItem: {
              select: {
                exercise: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });
      } catch {
        loggedWeightRows = [];
        sectionStatus.loggedWeights = "error";
      }
    }

    const seenExerciseIds = new Set();
    const loggedWeights = [];
    for (const row of loggedWeightRows) {
      const exercise = row.workoutItem?.exercise;
      if (!exercise?.id || seenExerciseIds.has(exercise.id)) {
        continue;
      }

      seenExerciseIds.add(exercise.id);
      loggedWeights.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        loggedWeightKg: row.loggedWeightKg,
        completedAt: row.completedAt,
        workoutItemId: row.workoutItemId,
      });
    }

    const isPartial = Object.values(sectionStatus).includes("error");

    return res.status(200).json({
      success: true,
      data: {
        clientId,
        trainerId,
        generatedAt: new Date().toISOString(),
        workout: {
          workoutId: latestWorkout?.id || null,
          startDate: latestWorkout?.startDate || null,
          endDate: latestWorkout?.endDate || null,
          status: workoutStatus,
          totalCount: latestWorkout?.totalCount || 0,
          completedCount: latestWorkout?.completedCount || 0,
          completionPercentage: workoutCompletionPercentage,
          loggedWeights,
        },
        meals: {
          mealPlanId: mealPlan?.id || null,
          status: mealPlan?.status || null,
          startDate: mealPlan?.startDate || null,
          endDate: mealPlan?.endDate || null,
          totalCount: mealPlan?.totalCount || 0,
          completedCount: mealPlan?.completedCount || 0,
          completionPercentage: mealCompletionPercentage,
          summary: mealPlan
            ? `${mealPlan.completedCount}/${mealPlan.totalCount}`
            : null,
        },
        latestCoachMessage: latestCoachMessage
          ? {
              messageId: latestCoachMessage.id,
              conversationId: latestCoachMessage.conversationId,
              body: latestCoachMessage.body,
              createdAt: latestCoachMessage.createdAt,
            }
          : null,
      },
      meta: {
        partial: isPartial,
        sectionStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
};
