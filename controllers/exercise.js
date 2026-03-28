import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";

const ALLOWED_SORT_FIELDS = ["id", "name", "category", "createdAt"];
const ALLOWED_CATEGORIES = [
  "CHEST",
  "BACK",
  "LEGS",
  "ARMS",
  "SHOULDERS",
  "CORE",
  "CARDIO",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// const isTrainerRole = (user) => {
//   const roleName = user?.roleName;
//   const roles = Array.isArray(user?.roles) ? user.roles : [];

//   return roleName === "TRAINER" || roles.includes("TRAINER");
// };

const ensureTrainerUser = (req) => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
};

const ensureValidTrainerId = (trainerId) => {
  if (!trainerId || !UUID_REGEX.test(String(trainerId))) {
    throw new AppError("Invalid trainerId", 400);
  }
};

const normalizeCategory = (value) => {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().toUpperCase();
};

const sanitizeName = (value) => {
  const name = String(value || "").trim();
  if (!name) {
    throw new AppError("name is required", 400);
  }

  if (name.length > 200) {
    throw new AppError("name must be at most 200 characters", 400);
  }

  return name;
};

const parseVideoUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) {
    throw new AppError("videoUrl is required", 400);
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new AppError("videoUrl must use http or https", 400);
    }
  } catch {
    throw new AppError("videoUrl must be a valid URL", 400);
  }

  return url;
};

const parseOptionalInstructions = (value) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const instructions = String(value).trim();
  if (instructions.length > 2000) {
    throw new AppError("instructions must be at most 2000 characters", 400);
  }

  return instructions;
};

const buildListWhere = (req) => {
  const where = {
    trainerId: req.user.id,
  };

  if (req.query.trainerId !== undefined) {
    ensureValidTrainerId(req.query.trainerId);
    if (req.query.trainerId !== req.user.id) {
      throw new AppError(
        "Forbidden: trainerId must match authenticated trainer",
        403,
      );
    }
  }

  if (req.query.search) {
    where.name = {
      contains: String(req.query.search).trim(),
      mode: "insensitive",
    };
  }

  const normalizedCategory = normalizeCategory(req.query.category);
  if (normalizedCategory) {
    if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
      throw new AppError("Invalid category value", 400);
    }
    where.category = normalizedCategory;
  }

  return where;
};

export const createExercise = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    const { name, category, videoUrl, instructions } = req.body;
    ensureValidTrainerId(req.user.id);

    const normalizedCategory = normalizeCategory(category);
    if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
      return next(new AppError("Invalid category value", 400));
    }

    const created = await prisma.exercise.create({
      data: {
        trainerId: req.user.id,
        name: sanitizeName(name),
        category: normalizedCategory,
        videoUrl: parseVideoUrl(videoUrl),
        instructions: parseOptionalInstructions(instructions),
      },
      select: {
        id: true,
        trainerId: true,
        name: true,
        category: true,
        videoUrl: true,
        instructions: true,
        createdAt: true,
      },
    });

    return res.status(201).json({
      status: "success",
      data: created,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getExerciseById = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Exercise ID is required", 400));
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
        name: true,
        category: true,
        videoUrl: true,
        instructions: true,
        createdAt: true,
      },
    });

    if (!exercise) {
      return next(new AppError("Exercise not found", 404));
    }

    if (exercise.trainerId !== req.user.id) {
      return next(
        new AppError("Forbidden: You do not have access to this exercise", 403),
      );
    }

    return res.status(200).json({
      status: "success",
      data: exercise,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllExercises = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    const trainerId = req.params.trainerId;
    if (trainerId) {
      ensureValidTrainerId(trainerId);
      req.query.trainerId = trainerId;
    } else {
      req.query.trainerId = req.user?.id;
    }

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 25,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = buildListWhere(req);

    const [total, exercises] = await prisma.$transaction([
      prisma.exercise.count({ where }),
      prisma.exercise.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          trainerId: true,
          name: true,
          category: true,
          videoUrl: true,
          instructions: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const payload = {
      status: "success",
      data: exercises,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
    };

    return res.status(200).json({
      ...payload,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateExerciseByIdPatch = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Exercise ID is required", 400));
    }

    const existing = await prisma.exercise.findUnique({
      where: { id },
      select: { id: true, trainerId: true },
    });

    if (!existing) {
      return next(new AppError("Exercise not found", 404));
    }

    const allowedFields = ["name", "category", "videoUrl", "instructions"];
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

    if (updateData.name !== undefined) {
      updateData.name = sanitizeName(updateData.name);
    }

    if (updateData.category !== undefined) {
      const normalizedCategory = normalizeCategory(updateData.category);
      if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
        return next(new AppError("Invalid category value", 400));
      }
      updateData.category = normalizedCategory;
    }

    if (updateData.videoUrl !== undefined) {
      updateData.videoUrl = parseVideoUrl(updateData.videoUrl);
    }

    if (updateData.instructions !== undefined) {
      updateData.instructions = parseOptionalInstructions(
        updateData.instructions,
      );
    }

    const updated = await prisma.exercise.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        trainerId: true,
        name: true,
        category: true,
        videoUrl: true,
        instructions: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      status: "success",
      data: updated,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteExerciseById = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Exercise ID is required", 400));
    }

    const existing = await prisma.exercise.findUnique({
      where: { id },
      select: {
        id: true,
        trainerId: true,
        _count: {
          select: {
            workoutItems: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Exercise not found", 404));
    }

    if (existing.trainerId !== req.user.id) {
      return next(
        new AppError("Forbidden: You can only delete your own exercises", 403),
      );
    }

    if (existing._count.workoutItems > 0) {
      return next(
        new AppError(
          "Cannot delete exercise that is used by workout items",
          400,
        ),
      );
    }

    await prisma.exercise.delete({ where: { id } });

    return res.status(200).json({
      status: "success",
      message: "Exercise deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllExercises = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    ensureValidTrainerId(req.user.id);

    const result = await prisma.exercise.deleteMany({
      where: { trainerId: req.user.id },
    });

    return res.status(200).json({
      status: "success",
      message: "All exercises for this trainer deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
