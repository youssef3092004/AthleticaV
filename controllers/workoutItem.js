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
import { recalcWorkoutDayAndSummary } from "../utils/workoutProgress.js";

const ALLOWED_SORT_FIELDS = [
  "id",
  "exerciseId",
  "order",
  "workoutDayId",
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
    where: { id: String(id) },
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

const ensureWorkoutDayExists = async (id) => {
  const day = await prisma.workoutDay.findUnique({
    where: { id: String(id) },
    select: {
      id: true,
      dayIndex: true,
      date: true,
      title: true,
      workoutId: true,
      workout: {
        select: {
          trainerId: true,
          clientId: true,
        },
      },
    },
  });

  if (!day) {
    throw new AppError("Workout day not found", 404);
  }

  return day;
};

const ensureExerciseExists = async (id) => {
  if (!id) {
    throw new AppError("exerciseId is required", 400);
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id: String(id) },
    select: {
      id: true,
      name_en: true,
      name_ar: true,
      primary_muscle: true,
      media_url: true,
      video_url: true,
      instructions: true,
    },
  });

  if (!exercise) {
    throw new AppError("Exercise not found", 404);
  }

  return exercise;
};

const ITEM_SELECT = {
  id: true,
  workoutDayId: true,
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
      name_en: true,
      name_ar: true,
      primary_muscle: true,
      secondary_muscles: true,
      equipment: true,
      difficulty: true,
      exercise_type: true,
      classification: true,
      movement_pattern: true,
      fitness_goals: true,
      workout_location: true,
      media_type: true,
      media_url: true,
      video_url: true,
      tags: true,
      is_default: true,
      priority: true,
      instructions: true,
    },
  },
  day: {
    select: {
      id: true,
      workoutId: true,
      dayIndex: true,
      date: true,
      title: true,
      workout: {
        select: {
          trainerId: true,
          clientId: true,
        },
      },
    },
  },
};

const toResponseItem = (item) => ({
  id: item.id,
  workoutId: item.day.workoutId,
  workoutDayId: item.workoutDayId,
  exerciseId: item.exerciseId,
  order: item.order,
  sets: item.sets,
  reps: item.reps,
  restSeconds: item.restSeconds,
  notes: item.notes,
  tempo: item.tempo,
  rir: item.rir,
  rpe: item.rpe,
  exercise: {
    ...item.exercise,
    name: item.exercise.name_en,
    category: String(item.exercise.primary_muscle || "").toUpperCase(),
    videoUrl: item.exercise.video_url,
  },
  day: {
    id: item.day.id,
    dayIndex: item.day.dayIndex,
    date: item.day.date,
    title: item.day.title,
  },
});

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

const getPreviousPerformanceForItem = async (item) => {
  const previous = await prisma.workoutCompletion.findFirst({
    where: {
      clientId: String(item.day.workout.clientId),
      workoutItemId: {
        not: String(item.id),
      },
      workoutItem: {
        exerciseId: String(item.exerciseId),
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

const toResponseItemWithPrevious = async (item) => {
  const previousPerformance = await getPreviousPerformanceForItem(item);

  return {
    ...toResponseItem(item),
    previousPerformance,
  };
};

const toResponseItemsWithPrevious = async (items) => {
  return Promise.all(items.map((item) => toResponseItemWithPrevious(item)));
};

const buildListWhere = (req) => {
  const requesterId = getUserId(req);
  const where = {};

  if (req.query.workoutDayId) {
    where.workoutDayId = String(req.query.workoutDayId);
  }

  if (req.query.exerciseId) {
    where.exerciseId = String(req.query.exerciseId);
  }

  const dayFilter = {};

  if (req.query.workoutId) {
    dayFilter.workoutId = String(req.query.workoutId);
  }

  if (!canManageAnyWorkoutItem(req.user)) {
    dayFilter.workout = {
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
      dayFilter.workout = workoutFilter;
    }
  }

  if (Object.keys(dayFilter).length > 0) {
    where.day = dayFilter;
  }

  return where;
};

export const createWorkoutItem = async (req, res, next) => {
  try {
    const {
      workoutDayId,
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

    if (!workoutDayId) {
      return next(new AppError("workoutDayId is required", 400));
    }

    const day = await ensureWorkoutDayExists(workoutDayId);
    await ensureExerciseExists(exerciseId);

    if (
      !ensureOwnOrPrivileged(req, day.workout.trainerId, day.workout.clientId)
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const created = await prisma.workoutItem.create({
      data: {
        workoutDayId: String(workoutDayId),
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
      select: ITEM_SELECT,
    });

    await recalcWorkoutDayAndSummary(created.workoutDayId);

    invalidateCacheByTags([
      ...buildResourceTags("workout_items", created.id),
      ...buildResourceTags("workout_days", created.workoutDayId),
      ...buildResourceTags("workouts", created.day.workoutId),
    ]);

    const payload = await toResponseItemWithPrevious(created);

    return res.status(201).json({
      status: "success",
      data: payload,
      source: "database",
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("order already exists in this workout day", 409),
      );
    }
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
      where: { id: String(id) },
      select: ITEM_SELECT,
    });

    if (!item) {
      return next(new AppError("Workout item not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(
        req,
        item.day.workout.trainerId,
        item.day.workout.clientId,
      )
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const payload = await toResponseItemWithPrevious(item);
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
        select: ITEM_SELECT,
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const responseItems = await toResponseItemsWithPrevious(items);

    const payload = {
      status: "success",
      data: responseItems,
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

    const where = {
      day: {
        workoutId: String(workoutId),
      },
    };

    const [total, items] = await prisma.$transaction([
      prisma.workoutItem.count({ where }),
      prisma.workoutItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: ITEM_SELECT,
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const responseItems = await toResponseItemsWithPrevious(items);

    return res.status(200).json({
      status: "success",
      data: responseItems,
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
      where: { id: String(id) },
      select: ITEM_SELECT,
    });

    if (!existing) {
      return next(new AppError("Workout item not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(
        req,
        existing.day.workout.trainerId,
        existing.day.workout.clientId,
      )
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const allowedFields = [
      "workoutDayId",
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

    if (updateData.workoutDayId !== undefined) {
      const nextDay = await ensureWorkoutDayExists(updateData.workoutDayId);
      if (
        !ensureOwnOrPrivileged(
          req,
          nextDay.workout.trainerId,
          nextDay.workout.clientId,
        )
      ) {
        return next(new AppError("Forbidden", 403));
      }
      updateData.workoutDayId = String(updateData.workoutDayId);
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
      where: { id: String(id) },
      data: updateData,
      select: ITEM_SELECT,
    });

    const dayIdsToRecalc = Array.from(
      new Set([existing.workoutDayId, updated.workoutDayId].map(String)),
    );
    for (const dayId of dayIdsToRecalc) {
      await recalcWorkoutDayAndSummary(dayId);
    }

    invalidateCacheByTags([
      ...buildResourceTags("workout_items", id),
      ...buildResourceTags("workout_items"),
      ...buildResourceTags("workout_days", existing.workoutDayId),
      ...buildResourceTags("workouts", existing.day.workoutId),
      ...(updated.workoutDayId !== existing.workoutDayId
        ? buildResourceTags("workout_days", updated.workoutDayId)
        : []),
      ...(updated.day.workoutId !== existing.day.workoutId
        ? buildResourceTags("workouts", updated.day.workoutId)
        : []),
    ]);

    const payload = await toResponseItemWithPrevious(updated);

    return res.status(200).json({
      status: "success",
      data: payload,
      source: "database",
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("order already exists in this workout day", 409),
      );
    }
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
      where: { id: String(id) },
      select: ITEM_SELECT,
    });

    if (!existing) {
      return next(new AppError("Workout item not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(
        req,
        existing.day.workout.trainerId,
        existing.day.workout.clientId,
      )
    ) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workoutItem.delete({ where: { id: String(id) } });

    await recalcWorkoutDayAndSummary(existing.workoutDayId);

    invalidateCacheByTags([
      ...buildResourceTags("workout_items", id),
      ...buildResourceTags("workout_items"),
      ...buildResourceTags("workout_days", existing.workoutDayId),
      ...buildResourceTags("workouts", existing.day.workoutId),
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

    await prisma.workoutDay.updateMany({
      data: {
        totalCount: 0,
        completedCount: 0,
      },
    });

    await prisma.workout.updateMany({
      data: {
        totalCount: 0,
        completedCount: 0,
      },
    });

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
