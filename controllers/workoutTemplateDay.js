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

const parseNonNegativeInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
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

const ensureTemplateAccess = async (templateId, req) => {
  const template = await prisma.workoutTemplate.findUnique({
    where: { id: String(templateId) },
    select: {
      id: true,
      trainerId: true,
    },
  });

  if (!template) {
    throw new AppError("Workout template not found", 404);
  }

  if (!ensureOwnOrPrivileged(req, template.trainerId)) {
    throw new AppError("Forbidden", 403);
  }

  return template;
};

const WORKOUT_TEMPLATE_DAY_SELECT = {
  id: true,
  workoutTemplateId: true,
  dayIndex: true,
  label: true,
  createdAt: true,
  items: {
    orderBy: {
      order: "asc",
    },
    select: {
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
    },
  },
};

export const addWorkoutTemplateDay = async (req, res, next) => {
  try {
    const workoutTemplateId =
      req.params.templateId || req.body.workoutTemplateId;
    if (!workoutTemplateId) {
      return next(new AppError("Workout template ID is required", 400));
    }

    await ensureTemplateAccess(workoutTemplateId, req);

    const created = await prisma.workoutTemplateDay.create({
      data: {
        workoutTemplateId: String(workoutTemplateId),
        dayIndex: parseNonNegativeInteger(req.body.dayIndex, "dayIndex"),
        label: parseOptionalString(req.body.label, "label", 120),
      },
      select: WORKOUT_TEMPLATE_DAY_SELECT,
    });

    return res.status(201).json({
      status: "success",
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex already exists for this workout template", 409),
      );
    }
    return next(error);
  }
};

export const getWorkoutTemplateDayById = async (req, res, next) => {
  try {
    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Workout template day ID is required", 400));
    }

    const day = await prisma.workoutTemplateDay.findUnique({
      where: { id: String(dayId) },
      select: {
        ...WORKOUT_TEMPLATE_DAY_SELECT,
        workoutTemplate: {
          select: {
            trainerId: true,
          },
        },
      },
    });

    if (!day) {
      return next(new AppError("Workout template day not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, day.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const payload = {
      id: day.id,
      workoutTemplateId: day.workoutTemplateId,
      dayIndex: day.dayIndex,
      label: day.label,
      createdAt: day.createdAt,
      items: day.items,
    };

    return res.status(200).json({
      status: "success",
      data: payload,
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutTemplateDaysByTemplateId = async (req, res, next) => {
  try {
    const workoutTemplateId = req.params.templateId || req.query.templateId;
    if (!workoutTemplateId) {
      return next(new AppError("Workout template ID is required", 400));
    }

    await ensureTemplateAccess(workoutTemplateId, req);

    const days = await prisma.workoutTemplateDay.findMany({
      where: { workoutTemplateId: String(workoutTemplateId) },
      orderBy: { dayIndex: "asc" },
      select: WORKOUT_TEMPLATE_DAY_SELECT,
    });

    return res.status(200).json({
      status: "success",
      data: days,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkoutTemplateDayById = async (req, res, next) => {
  try {
    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Workout template day ID is required", 400));
    }

    const existing = await prisma.workoutTemplateDay.findUnique({
      where: { id: String(dayId) },
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

    if (!existing) {
      return next(new AppError("Workout template day not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const data = {};

    if (req.body.dayIndex !== undefined) {
      data.dayIndex = parseNonNegativeInteger(req.body.dayIndex, "dayIndex");
    }

    if (req.body.label !== undefined) {
      data.label = parseOptionalString(req.body.label, "label", 120);
    }

    const updated = await prisma.workoutTemplateDay.update({
      where: { id: existing.id },
      data,
      select: WORKOUT_TEMPLATE_DAY_SELECT,
    });

    return res.status(200).json({
      status: "success",
      data: updated,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(
        new AppError("dayIndex already exists for this workout template", 409),
      );
    }
    return next(error);
  }
};

export const removeWorkoutTemplateDayById = async (req, res, next) => {
  try {
    const dayId = req.params.dayId;
    if (!dayId) {
      return next(new AppError("Workout template day ID is required", 400));
    }

    const existing = await prisma.workoutTemplateDay.findUnique({
      where: { id: String(dayId) },
      select: {
        id: true,
        workoutTemplate: {
          select: {
            trainerId: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Workout template day not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.workoutTemplate.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workoutTemplateDay.delete({
      where: { id: existing.id },
    });

    return res.status(200).json({
      status: "success",
      message: "Workout template day removed",
    });
  } catch (error) {
    return next(error);
  }
};
