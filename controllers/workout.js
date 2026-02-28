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

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyWorkout = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const ensureUserExists = async (id, label) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureWorkoutTemplateExists = async (id) => {
  const template = await prisma.workoutTemplate.findUnique({
    where: { id },
    select: { id: true, trainerId: true },
  });

  if (!template) {
    throw new AppError("Workout template not found", 404);
  }

  return template;
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return date;
};

const ensureDateRange = (startDate, endDate) => {
  if (startDate && endDate && endDate < startDate) {
    throw new AppError("End date cannot be before start date", 400);
  }
};

const ensureOwnOrPrivileged = (req, trainerId, clientId) => {
  if (canManageAnyWorkout(req.user)) return true;

  const requesterId = getUserId(req);
  return (
    requesterId &&
    (String(requesterId) === String(trainerId) ||
      String(requesterId) === String(clientId))
  );
};

const buildListWhere = (req) => {
  const requesterId = getUserId(req);
  const where = {};

  if (!canManageAnyWorkout(req.user)) {
    where.OR = [{ trainerId: requesterId }, { clientId: requesterId }];
  } else {
    if (req.query.trainerId) {
      where.trainerId = String(req.query.trainerId);
    }
    if (req.query.clientId) {
      where.clientId = String(req.query.clientId);
    }
  }

  if (req.query.workoutTemplateId) {
    where.workoutTemplateId = String(req.query.workoutTemplateId);
  }

  if (req.query.startDateFrom || req.query.startDateTo) {
    where.startDate = {};
    if (req.query.startDateFrom) {
      where.startDate.gte = parseDate(req.query.startDateFrom, "startDateFrom");
    }
    if (req.query.startDateTo) {
      where.startDate.lte = parseDate(req.query.startDateTo, "startDateTo");
    }
  }

  if (req.query.endDateFrom || req.query.endDateTo) {
    where.endDate = {};
    if (req.query.endDateFrom) {
      where.endDate.gte = parseDate(req.query.endDateFrom, "endDateFrom");
    }
    if (req.query.endDateTo) {
      where.endDate.lte = parseDate(req.query.endDateTo, "endDateTo");
    }
  }

  return where;
};

export const createWorkout = async (req, res, next) => {
  try {
    const { workoutTemplateId, clientId, trainerId, startDate, endDate } =
      req.body;

    if (!clientId || !trainerId || !startDate || !endDate) {
      return next(
        new AppError(
          "Client ID, trainer ID, start date, and end date are required",
          400,
        ),
      );
    }

    if (!ensureOwnOrPrivileged(req, trainerId, clientId)) {
      return next(
        new AppError("Forbidden: You can only create your own workouts", 403),
      );
    }

    await ensureUserExists(clientId, "Client user");
    await ensureUserExists(trainerId, "Trainer user");

    const parsedStartDate = parseDate(startDate, "startDate");
    const parsedEndDate = parseDate(endDate, "endDate");
    ensureDateRange(parsedStartDate, parsedEndDate);

    if (workoutTemplateId) {
      const template = await ensureWorkoutTemplateExists(workoutTemplateId);
      if (
        !canManageAnyWorkout(req.user) &&
        String(template.trainerId) !== String(trainerId)
      ) {
        return next(
          new AppError(
            "Forbidden: Workout template must belong to the same trainer",
            403,
          ),
        );
      }
    }

    const workout = await prisma.workout.create({
      data: {
        workoutTemplateId: workoutTemplateId || null,
        clientId,
        trainerId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
      },
      select: {
        id: true,
        workoutTemplateId: true,
        clientId: true,
        trainerId: true,
        startDate: true,
        endDate: true,
      },
    });

    invalidateCacheByTags(buildResourceTags("workouts", workout.id));

    return res.status(201).json({
      status: "success",
      data: workout,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout ID is required", 400));
    }

    const cacheKey = makeCacheKey(["workouts", "by-id", id, req.user?.id]);
    const cached = getCache(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json({ status: "success", data: cached, source: "cache" });
    }

    const workout = await prisma.workout.findUnique({
      where: { id },
      select: {
        id: true,
        workoutTemplateId: true,
        clientId: true,
        trainerId: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!workout) {
      return next(new AppError("Workout not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, workout.trainerId, workout.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    setCache(cacheKey, workout, buildResourceTags("workouts", id));

    return res.status(200).json({
      status: "success",
      data: workout,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllWorkouts = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "startDate",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const where = buildListWhere(req);
    const cacheKey = makeCacheKey([
      "workouts",
      "list",
      where,
      { page, limit, skip, sort, order },
      req.user?.id,
    ]);

    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, source: "cache" });
    }

    const [total, workouts] = await prisma.$transaction([
      prisma.workout.count({ where }),
      prisma.workout.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          workoutTemplateId: true,
          clientId: true,
          trainerId: true,
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const payload = {
      status: "success",
      data: workouts,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
    };

    setCache(cacheKey, payload, buildResourceTags("workouts"));

    return res.status(200).json({
      ...payload,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkoutByIdPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout ID is required", 400));
    }

    const existing = await prisma.workout.findUnique({
      where: { id },
      select: {
        id: true,
        workoutTemplateId: true,
        trainerId: true,
        clientId: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!existing) {
      return next(new AppError("Workout not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId, existing.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const updateData = { ...req.body };
    const allowedFields = [
      "workoutTemplateId",
      "clientId",
      "trainerId",
      "startDate",
      "endDate",
    ];

    const payloadKeys = Object.keys(updateData);
    if (payloadKeys.length === 0) {
      return next(new AppError("No fields provided for update", 400));
    }

    for (const key of payloadKeys) {
      if (!allowedFields.includes(key)) {
        return next(new AppError(`Field '${key}' cannot be updated`, 400));
      }
    }

    const nextTrainerId = updateData.trainerId ?? existing.trainerId;
    const nextClientId = updateData.clientId ?? existing.clientId;

    if (!ensureOwnOrPrivileged(req, nextTrainerId, nextClientId)) {
      return next(new AppError("Forbidden", 403));
    }

    if (updateData.clientId !== undefined) {
      await ensureUserExists(updateData.clientId, "Client user");
    }

    if (updateData.trainerId !== undefined) {
      await ensureUserExists(updateData.trainerId, "Trainer user");
    }

    if (updateData.workoutTemplateId !== undefined) {
      if (
        updateData.workoutTemplateId === null ||
        updateData.workoutTemplateId === ""
      ) {
        updateData.workoutTemplateId = null;
      } else {
        const template = await ensureWorkoutTemplateExists(
          updateData.workoutTemplateId,
        );
        if (
          !canManageAnyWorkout(req.user) &&
          String(template.trainerId) !== String(nextTrainerId)
        ) {
          return next(
            new AppError(
              "Forbidden: Workout template must belong to the same trainer",
              403,
            ),
          );
        }
      }
    }

    const nextStartDate =
      updateData.startDate !== undefined
        ? parseDate(updateData.startDate, "startDate")
        : existing.startDate;
    const nextEndDate =
      updateData.endDate !== undefined
        ? parseDate(updateData.endDate, "endDate")
        : existing.endDate;

    ensureDateRange(nextStartDate, nextEndDate);

    if (updateData.startDate !== undefined) {
      updateData.startDate = nextStartDate;
    }

    if (updateData.endDate !== undefined) {
      updateData.endDate = nextEndDate;
    }

    const updated = await prisma.workout.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        workoutTemplateId: true,
        clientId: true,
        trainerId: true,
        startDate: true,
        endDate: true,
      },
    });

    invalidateCacheByTags(buildResourceTags("workouts", id));

    return res.status(200).json({
      status: "success",
      data: updated,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteWorkoutById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout ID is required", 400));
    }

    const existing = await prisma.workout.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
        clientId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Workout not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId, existing.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workout.delete({ where: { id } });

    invalidateCacheByTags(buildResourceTags("workouts", id));

    return res.status(200).json({
      status: "success",
      message: "Workout deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllWorkouts = async (req, res, next) => {
  try {
    if (!canManageAnyWorkout(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete all workouts",
          403,
        ),
      );
    }

    const result = await prisma.workout.deleteMany({});

    invalidateCacheByTags(buildResourceTags("workouts"));

    return res.status(200).json({
      status: "success",
      message: "All workouts deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
