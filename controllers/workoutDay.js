import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { buildResourceTags, invalidateCacheByTags } from "../utils/cache.js";
import { recalcWorkoutSummary } from "../utils/workoutProgress.js";

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyWorkoutDay = (user) => {
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
  if (canManageAnyWorkoutDay(req.user)) return true;

  const requesterId = getUserId(req);
  return (
    requesterId &&
    (String(requesterId) === String(trainerId) ||
      String(requesterId) === String(clientId))
  );
};

const parseNonNegativeInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
};

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const parseOptionalString = (value, fieldName, maxLength = 120) => {
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

const calculateCompletionPercentage = (completedCount, totalCount) => {
  const total = Number(totalCount) || 0;
  const completed = Number(completedCount) || 0;
  if (total <= 0) return 0;
  return Number(((completed / total) * 100).toFixed(2));
};

const withDayCompletionPercentage = (day) => ({
  ...day,
  completionPercentage: calculateCompletionPercentage(
    day.completedCount,
    day.totalCount,
  ),
});

const ensureWorkoutAccess = async (workoutId, req) => {
  const workout = await prisma.workout.findUnique({
    where: { id: String(workoutId) },
    select: {
      id: true,
      trainerId: true,
      clientId: true,
      program: {
        select: {
          startDate: true,
          endDate: true,
        },
      },
    },
  });

  if (!workout) {
    throw new AppError("Workout not found", 404);
  }

  if (!ensureOwnOrPrivileged(req, workout.trainerId, workout.clientId)) {
    throw new AppError("Forbidden", 403);
  }

  return workout;
};

const WORKOUT_DAY_SELECT = {
  id: true,
  workoutId: true,
  dayIndex: true,
  date: true,
  title: true,
  totalCount: true,
  completedCount: true,
  createdAt: true,
  items: {
    orderBy: {
      order: "asc",
    },
    select: {
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
    },
  },
};

export const addWorkoutDay = async (req, res, next) => {
  try {
    const workoutId = req.params.workoutId || req.body.workoutId;
    if (!workoutId) {
      return next(new AppError("Workout ID is required", 400));
    }

    const workout = await ensureWorkoutAccess(workoutId, req);

    const dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    const date = parseDateOnly(req.body.date, "date");

    if (date < workout.program.startDate || date > workout.program.endDate) {
      return next(
        new AppError("Day date must be inside workout start/end range", 400),
      );
    }

    const created = await prisma.workoutDay.create({
      data: {
        workoutId: String(workoutId),
        dayIndex,
        date,
        title: parseOptionalString(req.body.title, "title", 120),
      },
      select: WORKOUT_DAY_SELECT,
    });

    invalidateCacheByTags([
      ...buildResourceTags("workout_days", created.id),
      ...buildResourceTags("workouts", workout.id),
    ]);

    return res.status(201).json({
      status: "success",
      data: withDayCompletionPercentage(created),
      source: "database",
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex or date already exists for this workout", 409),
      );
    }
    return next(error);
  }
};

export const getWorkoutDayById = async (req, res, next) => {
  try {
    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Workout day ID is required", 400));
    }

    const day = await prisma.workoutDay.findUnique({
      where: { id: String(dayId) },
      select: {
        ...WORKOUT_DAY_SELECT,
        workout: {
          select: {
            trainerId: true,
            clientId: true,
          },
        },
      },
    });

    if (!day) {
      return next(new AppError("Workout day not found", 404));
    }

    if (
      !ensureOwnOrPrivileged(req, day.workout.trainerId, day.workout.clientId)
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const payload = {
      id: day.id,
      workoutId: day.workoutId,
      dayIndex: day.dayIndex,
      date: day.date,
      title: day.title,
      totalCount: day.totalCount,
      completedCount: day.completedCount,
      completionPercentage: calculateCompletionPercentage(
        day.completedCount,
        day.totalCount,
      ),
      createdAt: day.createdAt,
      items: day.items,
    };

    return res.status(200).json({
      status: "success",
      data: payload,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutDaysByWorkoutId = async (req, res, next) => {
  try {
    const workoutId = req.params.workoutId || req.query.workoutId;
    if (!workoutId) {
      return next(new AppError("Workout ID is required", 400));
    }

    await ensureWorkoutAccess(workoutId, req);

    const days = await prisma.workoutDay.findMany({
      where: { workoutId: String(workoutId) },
      orderBy: { dayIndex: "asc" },
      select: WORKOUT_DAY_SELECT,
    });

    return res.status(200).json({
      status: "success",
      data: days.map(withDayCompletionPercentage),
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkoutDayById = async (req, res, next) => {
  try {
    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Workout day ID is required", 400));
    }

    const existing = await prisma.workoutDay.findUnique({
      where: { id: String(dayId) },
      select: {
        id: true,
        workoutId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Workout day not found", 404));
    }

    const workout = await ensureWorkoutAccess(existing.workoutId, req);

    const data = {};

    if (req.body.dayIndex !== undefined) {
      data.dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    }

    if (req.body.date !== undefined) {
      const date = parseDateOnly(req.body.date, "date");
      if (date < workout.program.startDate || date > workout.program.endDate) {
        return next(
          new AppError("Day date must be inside workout start/end range", 400),
        );
      }
      data.date = date;
    }

    if (req.body.title !== undefined) {
      data.title = parseOptionalString(req.body.title, "title", 120);
    }

    const updated = await prisma.workoutDay.update({
      where: { id: existing.id },
      data,
      select: WORKOUT_DAY_SELECT,
    });

    invalidateCacheByTags([
      ...buildResourceTags("workout_days", existing.id),
      ...buildResourceTags("workouts", existing.workoutId),
    ]);

    return res.status(200).json({
      status: "success",
      data: withDayCompletionPercentage(updated),
      source: "database",
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex or date already exists for this workout", 409),
      );
    }
    return next(error);
  }
};

export const removeWorkoutDayById = async (req, res, next) => {
  try {
    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Workout day ID is required", 400));
    }

    const existing = await prisma.workoutDay.findUnique({
      where: { id: String(dayId) },
      select: {
        id: true,
        workoutId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Workout day not found", 404));
    }

    await ensureWorkoutAccess(existing.workoutId, req);

    await prisma.workoutDay.delete({
      where: { id: existing.id },
    });

    await recalcWorkoutSummary(existing.workoutId);

    invalidateCacheByTags([
      ...buildResourceTags("workout_days", existing.id),
      ...buildResourceTags("workouts", existing.workoutId),
      ...buildResourceTags("workout_items"),
    ]);

    return res.status(200).json({
      status: "success",
      message: "Workout day removed",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
