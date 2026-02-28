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

const ALLOWED_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];

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

const normalizeLevel = (level) => {
  if (level === undefined || level === null) return undefined;
  return String(level).trim().toUpperCase();
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

const ensureOwnOrPrivileged = (req, trainerId) => {
  if (canManageAnyWorkoutTemplate(req.user)) return true;

  const requesterId = getUserId(req);
  return requesterId && String(requesterId) === String(trainerId);
};

const buildListWhere = (req) => {
  const requesterId = getUserId(req);
  const queryTrainerId = req.query.trainerId;
  const queryLevel = normalizeLevel(req.query.level);

  const where = {};

  if (!canManageAnyWorkoutTemplate(req.user)) {
    where.trainerId = requesterId;
  } else if (queryTrainerId) {
    where.trainerId = String(queryTrainerId);
  }

  if (queryLevel) {
    if (!ALLOWED_LEVELS.includes(queryLevel)) {
      throw new AppError("Invalid level value", 400);
    }
    where.level = queryLevel;
  }

  return where;
};

export const createWorkoutTemplate = async (req, res, next) => {
  try {
    const { trainerId, title, level } = req.body;

    if (!trainerId || !title) {
      return next(new AppError("Trainer ID and title are required", 400));
    }

    if (!ensureOwnOrPrivileged(req, trainerId)) {
      return next(
        new AppError(
          "Forbidden: You can only create your own workout templates",
          403,
        ),
      );
    }

    await ensureUserExists(trainerId, "Trainer user");

    const normalizedLevel = normalizeLevel(level) || "BEGINNER";
    if (!ALLOWED_LEVELS.includes(normalizedLevel)) {
      return next(new AppError("Invalid level value", 400));
    }

    const created = await prisma.workoutTemplate.create({
      data: {
        trainerId,
        title: String(title).trim(),
        level: normalizedLevel,
      },
      select: {
        id: true,
        trainerId: true,
        title: true,
        level: true,
        createdAt: true,
      },
    });

    invalidateCacheByTags(buildResourceTags("workout_templates", created.id));

    return res.status(201).json({
      status: "success",
      data: created,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getWorkoutTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout template ID is required", 400));
    }

    const cacheKey = makeCacheKey([
      "workout_templates",
      "by-id",
      id,
      req.user?.id,
    ]);
    const cached = getCache(cacheKey);
    if (cached) {
      return res
        .status(200)
        .json({ status: "success", data: cached, source: "cache" });
    }

    const template = await prisma.workoutTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
        title: true,
        level: true,
        createdAt: true,
      },
    });

    if (!template) {
      return next(new AppError("Workout template not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, template.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    setCache(cacheKey, template, buildResourceTags("workout_templates", id));

    return res.status(200).json({
      status: "success",
      data: template,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllWorkoutTemplates = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const where = buildListWhere(req);
    const cacheKey = makeCacheKey([
      "workout_templates",
      "list",
      where,
      { page, limit, skip, sort, order },
      req.user?.id,
    ]);

    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, source: "cache" });
    }

    const [total, templates] = await prisma.$transaction([
      prisma.workoutTemplate.count({ where }),
      prisma.workoutTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          trainerId: true,
          title: true,
          level: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const payload = {
      status: "success",
      data: templates,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
    };

    setCache(cacheKey, payload, buildResourceTags("workout_templates"));

    return res.status(200).json({
      ...payload,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWorkoutTemplateByIdPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout template ID is required", 400));
    }

    const existing = await prisma.workoutTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Workout template not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const allowedFields = ["trainerId", "title", "level"];
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

    if (updateData.trainerId !== undefined) {
      if (!ensureOwnOrPrivileged(req, updateData.trainerId)) {
        return next(
          new AppError(
            "Forbidden: You can only assign your own trainer ID",
            403,
          ),
        );
      }
      await ensureUserExists(updateData.trainerId, "Trainer user");
    }

    if (updateData.title !== undefined) {
      if (!String(updateData.title).trim()) {
        return next(new AppError("Title cannot be empty", 400));
      }
      updateData.title = String(updateData.title).trim();
    }

    if (updateData.level !== undefined) {
      const normalizedLevel = normalizeLevel(updateData.level);
      if (!ALLOWED_LEVELS.includes(normalizedLevel)) {
        return next(new AppError("Invalid level value", 400));
      }
      updateData.level = normalizedLevel;
    }

    const updated = await prisma.workoutTemplate.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        trainerId: true,
        title: true,
        level: true,
        createdAt: true,
      },
    });

    invalidateCacheByTags(buildResourceTags("workout_templates", id));

    return res.status(200).json({
      status: "success",
      data: updated,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteWorkoutTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Workout template ID is required", 400));
    }

    const existing = await prisma.workoutTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Workout template not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.workoutTemplate.delete({ where: { id } });

    invalidateCacheByTags(buildResourceTags("workout_templates", id));

    return res.status(200).json({
      status: "success",
      message: "Workout template deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllWorkoutTemplates = async (req, res, next) => {
  try {
    if (!canManageAnyWorkoutTemplate(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete all workout templates",
          403,
        ),
      );
    }

    const result = await prisma.workoutTemplate.deleteMany({});

    invalidateCacheByTags(buildResourceTags("workout_templates"));

    return res.status(200).json({
      status: "success",
      message: "All workout templates deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
