import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyWorkoutTemplate = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const ensureOwnOrPrivileged = (req, trainerId) => {
  if (canManageAnyWorkoutTemplate(req.user)) return true;
  const requesterId = getUserId(req);
  return requesterId && String(requesterId) === String(trainerId);
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

const ensureWorkoutTemplateDayExists = async (id) => {
  const day = await prisma.workoutTemplateDay.findUnique({
    where: { id: String(id) },
    select: {
      id: true,
      workoutTemplateId: true,
      workoutTemplate: {
        select: {
          trainerId: true,
        },
      },
    },
  });

  if (!day) {
    throw new AppError("Workout template day not found", 404);
  }

  return day;
};

const ensureExerciseExists = async (id) => {
  const exercise = await prisma.exercise.findUnique({
    where: { id: String(id) },
    select: { id: true },
  });

  if (!exercise) {
    throw new AppError("Exercise not found", 404);
  }
};

const ITEM_SELECT = {
  id: true,
  workoutTemplateDayId: true,
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
};

export const addWorkoutTemplateItem = async (req, res, next) => {
  try {
    const workoutTemplateDayId =
      req.params.dayId || req.body.workoutTemplateDayId;

    if (!workoutTemplateDayId) {
      return next(new AppError("Workout template day ID is required", 400));
    }

    const day = await ensureWorkoutTemplateDayExists(workoutTemplateDayId);
    if (!ensureOwnOrPrivileged(req, day.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const exerciseId = String(req.body.exerciseId || "").trim();
    if (!exerciseId) {
      return next(new AppError("exerciseId is required", 400));
    }

    await ensureExerciseExists(exerciseId);

    const created = await prisma.workoutTemplateItem.create({
      data: {
        workoutTemplateDayId: String(workoutTemplateDayId),
        exerciseId,
        order: parseNonNegativeInteger(req.body.order, "order"),
        sets: parsePositiveInteger(req.body.sets, "sets"),
        reps: parsePositiveInteger(req.body.reps, "reps"),
        restSeconds: parseNonNegativeInteger(
          req.body.restSeconds,
          "restSeconds",
        ),
        notes: parseOptionalString(req.body.notes, "notes", 1000),
        tempo: parseOptionalString(req.body.tempo, "tempo", 50),
        rir: parseOptionalRir(req.body.rir),
        rpe: parseOptionalRpe(req.body.rpe),
      },
      select: ITEM_SELECT,
    });

    return res.status(201).json({
      status: "success",
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("order already exists in this template day", 409),
      );
    }
    return next(error);
  }
};

export const getWorkoutTemplateItemById = async (req, res, next) => {
  try {
    const itemId = req.params.itemId;
    if (!itemId) {
      return next(new AppError("Workout template item ID is required", 400));
    }

    const item = await prisma.workoutTemplateItem.findUnique({
      where: { id: String(itemId) },
      select: {
        ...ITEM_SELECT,
        day: {
          select: {
            workoutTemplate: {
              select: {
                trainerId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      return next(new AppError("Workout template item not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, item.day.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const payload = {
      id: item.id,
      workoutTemplateDayId: item.workoutTemplateDayId,
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

    return res.status(200).json({
      status: "success",
      data: payload,
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutTemplateItemsByDayId = async (req, res, next) => {
  try {
    const dayId = req.params.dayId || req.query.dayId;
    if (!dayId) {
      return next(new AppError("Workout template day ID is required", 400));
    }

    const day = await ensureWorkoutTemplateDayExists(dayId);
    if (!ensureOwnOrPrivileged(req, day.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const items = await prisma.workoutTemplateItem.findMany({
      where: { workoutTemplateDayId: String(dayId) },
      orderBy: {
        order: "asc",
      },
      select: ITEM_SELECT,
    });

    return res.status(200).json({
      status: "success",
      data: items,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkoutTemplateItemById = async (req, res, next) => {
  try {
    const itemId = req.params.itemId;
    if (!itemId) {
      return next(new AppError("Workout template item ID is required", 400));
    }

    const existing = await prisma.workoutTemplateItem.findUnique({
      where: { id: String(itemId) },
      select: {
        id: true,
        day: {
          select: {
            workoutTemplate: {
              select: {
                trainerId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Workout template item not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.day.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const data = {};

    if (req.body.order !== undefined) {
      data.order = parseNonNegativeInteger(req.body.order, "order");
    }

    if (req.body.sets !== undefined) {
      data.sets = parsePositiveInteger(req.body.sets, "sets");
    }

    if (req.body.reps !== undefined) {
      data.reps = parsePositiveInteger(req.body.reps, "reps");
    }

    if (req.body.restSeconds !== undefined) {
      data.restSeconds = parseNonNegativeInteger(
        req.body.restSeconds,
        "restSeconds",
      );
    }

    if (req.body.notes !== undefined) {
      data.notes = parseOptionalString(req.body.notes, "notes", 1000);
    }

    if (req.body.tempo !== undefined) {
      data.tempo = parseOptionalString(req.body.tempo, "tempo", 50);
    }

    if (req.body.rir !== undefined) {
      data.rir = parseOptionalRir(req.body.rir);
    }

    if (req.body.rpe !== undefined) {
      data.rpe = parseOptionalRpe(req.body.rpe);
    }

    if (req.body.exerciseId !== undefined) {
      await ensureExerciseExists(req.body.exerciseId);
      data.exerciseId = String(req.body.exerciseId);
    }

    const updated = await prisma.workoutTemplateItem.update({
      where: { id: existing.id },
      data,
      select: ITEM_SELECT,
    });

    return res.status(200).json({
      status: "success",
      data: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("order already exists in this template day", 409),
      );
    }
    return next(error);
  }
};

export const removeWorkoutTemplateItemById = async (req, res, next) => {
  try {
    const itemId = req.params.itemId;
    if (!itemId) {
      return next(new AppError("Workout template item ID is required", 400));
    }

    const existing = await prisma.workoutTemplateItem.findUnique({
      where: { id: String(itemId) },
      select: {
        id: true,
        day: {
          select: {
            workoutTemplate: {
              select: {
                trainerId: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Workout template item not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.day.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workoutTemplateItem.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      status: "success",
      message: "Workout template item removed",
    });
  } catch (error) {
    return next(error);
  }
};
