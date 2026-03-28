import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  buildResourceTags,
  getCache,
  invalidateCacheByTags,
  makeCacheKey,
  setCache,
} from "../utils/cache.js";

const ALLOWED_SORT_FIELDS = [
  "id",
  "exerciseId",
  "order",
  "workoutId",
  "sets",
  "reps",
  "restSeconds",
];

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyWorkoutItem = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const ensureOwnOrPrivileged = (req, trainerId, clientId) => {
  if (canManageAnyWorkoutItem(req.user)) return true;

  const requesterId = getUserId(req);
  return (
    requesterId &&
    (String(requesterId) === String(trainerId) ||
      String(requesterId) === String(clientId))
  );
};

const parsePositiveInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive integer`, 400);
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

const parseOptionalString = (value, fieldName, maxLength = 500) => {
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

const parseOptionalRir = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    throw new AppError("rir must be an integer between 0 and 10", 400);
  }

  return parsed;
};

const parseOptionalRpe = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    throw new AppError("rpe must be a number between 0 and 10", 400);
  }

  return parsed;
};

const ensureWorkoutExists = async (id) => {
  const workout = await prisma.workout.findUnique({
    where: { id },
    select: {
      id: true,
      trainerId: true,
      clientId: true,
    },
  });

  if (!workout) {
    throw new AppError("Workout not found", 404);
  }

  return workout;
};

const ensureExerciseExists = async (id) => {
  if (!id) {
    throw new AppError("exerciseId is required", 400);
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      category: true,
      videoUrl: true,
      instructions: true,
    },
  });

  if (!exercise) {
    throw new AppError("Exercise not found", 404);
  }

  return exercise;
};

const buildListWhere = (req) => {
  const requesterId = getUserId(req);
  const where = {};

  if (req.query.workoutId) {
    where.workoutId = String(req.query.workoutId);
  }

  if (req.query.exerciseId) {
    where.exerciseId = String(req.query.exerciseId);
  }

  if (!canManageAnyWorkoutItem(req.user)) {
    where.workout = {
      OR: [{ trainerId: requesterId }, { clientId: requesterId }],
    };
  } else {
    const workoutFilter = {};
    if (req.query.trainerId) {
      workoutFilter.trainerId = String(req.query.trainerId);
    }
    if (req.query.clientId) {
      workoutFilter.clientId = String(req.query.clientId);
    }

    if (Object.keys(workoutFilter).length > 0) {
      where.workout = workoutFilter;
    }
  }

  return where;
};

export const createWorkoutItem = async (req, res, next) => {
  try {
    const {
      workoutId,
      exerciseId,
      sets,
      reps,
      restSeconds,
      order,
      notes,
      tempo,
      rir,
      rpe,
    } = req.body;

    if (!workoutId) {
      return next(new AppError("Workout ID is required", 400));
    }

    const workout = await ensureWorkoutExists(workoutId);
    await ensureExerciseExists(exerciseId);

    if (!ensureOwnOrPrivileged(req, workout.trainerId, workout.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const created = await prisma.workoutItem.create({
      data: {
        workoutId,
        exerciseId,
        order: parseNonNegativeInteger(order, "order"),
        sets: parsePositiveInteger(sets, "sets"),
        reps: parsePositiveInteger(reps, "reps"),
        restSeconds: parseNonNegativeInteger(restSeconds, "restSeconds"),
        notes: parseOptionalString(notes, "notes", 1000),
        tempo: parseOptionalString(tempo, "tempo", 50),
        rir: parseOptionalRir(rir),
        rpe: parseOptionalRpe(rpe),
      },
      select: {
        id: true,
        workoutId: true,
        exerciseId: true,
        order: true,
        sets: true,
        reps: true,
        restSeconds: true,
        notes: true,
        tempo: true,
        rir: true,
        rpe: true,
        exercise: {
          select: {
            id: true,
            name: true,
            category: true,
            videoUrl: true,
            instructions: true,
          },
        },
      },
    });

    invalidateCacheByTags([
      ...buildResourceTags("workout_items", created.id),
      ...buildResourceTags("workouts", workoutId),
    ]);

    return res.status(201).json({
      status: "success",
      data: created,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout item ID is required", 400));
    }

    const cacheKey = makeCacheKey(["workout_items", "by-id", id, req.user?.id]);
    const cached = getCache(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json({ status: "success", data: cached, source: "cache" });
    }

    const item = await prisma.workoutItem.findUnique({
      where: { id },
      select: {
        id: true,
        workoutId: true,
        exerciseId: true,
        order: true,
        sets: true,
        reps: true,
        restSeconds: true,
        notes: true,
        tempo: true,
        rir: true,
        rpe: true,
        exercise: {
          select: {
            id: true,
            name: true,
            category: true,
            videoUrl: true,
            instructions: true,
          },
        },
        workout: {
          select: {
            trainerId: true,
            clientId: true,
          },
        },
      },
    });

    if (!item) {
      return next(new AppError("Workout item not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(req, item.workout.trainerId, item.workout.clientId)
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const payload = {
      id: item.id,
      workoutId: item.workoutId,
      exerciseId: item.exerciseId,
      order: item.order,
      sets: item.sets,
      reps: item.reps,
      restSeconds: item.restSeconds,
      notes: item.notes,
      tempo: item.tempo,
      rir: item.rir,
      rpe: item.rpe,
      exercise: item.exercise,
    };

    setCache(cacheKey, payload, buildResourceTags("workout_items", id));

    return res.status(200).json({
      status: "success",
      data: payload,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllWorkoutItems = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "id",
      defaultOrder: "desc",
      defaultLimit: 25,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = buildListWhere(req);
    const cacheKey = makeCacheKey([
      "workout_items",
      "list",
      where,
      { page, limit, skip, sort, order },
      req.user?.id,
    ]);

    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, source: "cache" });
    }

    const [total, items] = await prisma.$transaction([
      prisma.workoutItem.count({ where }),
      prisma.workoutItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          workoutId: true,
          exerciseId: true,
          order: true,
          sets: true,
          reps: true,
          restSeconds: true,
          notes: true,
          tempo: true,
          rir: true,
          rpe: true,
          exercise: {
            select: {
              id: true,
              name: true,
              category: true,
              videoUrl: true,
              instructions: true,
            },
          },
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const payload = {
      status: "success",
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
    };

    setCache(cacheKey, payload, buildResourceTags("workout_items"));

    return res.status(200).json({
      ...payload,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllWorkoutItemsByWorkoutId = async (req, res, next) => {
  try {
    const { workoutId } = req.params;
    if (!workoutId) {
      return next(new AppError("Workout ID is required", 400));
    }

    const workout = await ensureWorkoutExists(workoutId);
    if (!ensureOwnOrPrivileged(req, workout.trainerId, workout.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "order",
      defaultOrder: "asc",
      defaultLimit: 50,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = { workoutId };

    const [total, items] = await prisma.$transaction([
      prisma.workoutItem.count({ where }),
      prisma.workoutItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          workoutId: true,
          exerciseId: true,
          order: true,
          sets: true,
          reps: true,
          restSeconds: true,
          notes: true,
          tempo: true,
          rir: true,
          rpe: true,
          exercise: {
            select: {
              id: true,
              name: true,
              category: true,
              videoUrl: true,
              instructions: true,
            },
          },
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkoutItemByIdPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout item ID is required", 400));
    }

    const existing = await prisma.workoutItem.findUnique({
      where: { id },
      select: {
        id: true,
        workoutId: true,
        workout: {
          select: {
            trainerId: true,
            clientId: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Workout item not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(
        req,
        existing.workout.trainerId,
        existing.workout.clientId,
      )
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const allowedFields = [
      "workoutId",
      "exerciseId",
      "order",
      "sets",
      "reps",
      "restSeconds",
      "notes",
      "tempo",
      "rir",
      "rpe",
    ];

    const updateData = { ...req.body };
    const payloadKeys = Object.keys(updateData);

    if (payloadKeys.length === 0) {
      return next(new AppError("No fields provided for update", 400));
    }

    for (const key of payloadKeys) {
      if (!allowedFields.includes(key)) {
        return next(new AppError(`Field '${key}' cannot be updated`, 400));
      }
    }

    if (updateData.workoutId !== undefined) {
      const nextWorkout = await ensureWorkoutExists(updateData.workoutId);
      if (
        !ensureOwnOrPrivileged(req, nextWorkout.trainerId, nextWorkout.clientId)
      ) {
        return next(new AppError("Forbidden", 403));
      }
    }

    if (updateData.exerciseId !== undefined) {
      await ensureExerciseExists(updateData.exerciseId);
    }

    if (updateData.order !== undefined) {
      updateData.order = parseNonNegativeInteger(updateData.order, "order");
    }

    if (updateData.sets !== undefined) {
      updateData.sets = parsePositiveInteger(updateData.sets, "sets");
    }

    if (updateData.reps !== undefined) {
      updateData.reps = parsePositiveInteger(updateData.reps, "reps");
    }

    if (updateData.restSeconds !== undefined) {
      updateData.restSeconds = parseNonNegativeInteger(
        updateData.restSeconds,
        "restSeconds",
      );
    }

    if (updateData.notes !== undefined) {
      updateData.notes = parseOptionalString(updateData.notes, "notes", 1000);
    }

    if (updateData.tempo !== undefined) {
      updateData.tempo = parseOptionalString(updateData.tempo, "tempo", 50);
    }

    if (updateData.rir !== undefined) {
      updateData.rir = parseOptionalRir(updateData.rir);
    }

    if (updateData.rpe !== undefined) {
      updateData.rpe = parseOptionalRpe(updateData.rpe);
    }

    const updated = await prisma.workoutItem.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        workoutId: true,
        exerciseId: true,
        order: true,
        sets: true,
        reps: true,
        restSeconds: true,
        notes: true,
        tempo: true,
        rir: true,
        rpe: true,
        exercise: {
          select: {
            id: true,
            name: true,
            category: true,
            videoUrl: true,
            instructions: true,
          },
        },
      },
    });

    invalidateCacheByTags([
      ...buildResourceTags("workout_items", id),
      ...buildResourceTags("workout_items"),
      ...buildResourceTags("workouts", existing.workoutId),
      ...(updated.workoutId !== existing.workoutId
        ? buildResourceTags("workouts", updated.workoutId)
        : []),
    ]);

    return res.status(200).json({
      status: "success",
      data: updated,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteWorkoutItemById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout item ID is required", 400));
    }

    const existing = await prisma.workoutItem.findUnique({
      where: { id },
      select: {
        id: true,
        workoutId: true,
        workout: {
          select: {
            trainerId: true,
            clientId: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Workout item not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(
        req,
        existing.workout.trainerId,
        existing.workout.clientId,
      )
    ) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workoutItem.delete({ where: { id } });

    invalidateCacheByTags([
      ...buildResourceTags("workout_items", id),
      ...buildResourceTags("workout_items"),
      ...buildResourceTags("workouts", existing.workoutId),
    ]);

    return res.status(200).json({
      status: "success",
      message: "Workout item deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllWorkoutItems = async (req, res, next) => {
  try {
    if (!canManageAnyWorkoutItem(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete all workout items",
          403,
        ),
      );
    }

    const result = await prisma.workoutItem.deleteMany({});

    invalidateCacheByTags(buildResourceTags("workout_items"));

    return res.status(200).json({
      status: "success",
      message: "All workout items deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
