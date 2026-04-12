import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import {
  buildResourceTags,
  getCache,
  invalidateCacheByTags,
  makeCacheKey,
  setCache,
} from "../utils/cache.js";
import { pagination } from "../utils/pagination.js";

const ALLOWED_SORT_FIELDS = [
  "id",
  "name_en",
  "primary_muscle",
  "equipment",
  "difficulty",
  "exercise_type",
  "workout_location",
  "priority",
  "createdAt",
  "updatedAt",
];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXERCISE_SELECT = {
  id: true,
  trainerId: true,
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
  createdAt: true,
  updatedAt: true,
};

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

const parseRequiredString = (value, fieldName, maxLength = 200) => {
  const parsed = String(value || "").trim();
  if (!parsed) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (parsed.length > maxLength) {
    throw new AppError(
      `${fieldName} must be at most ${maxLength} characters`,
      400,
    );
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

const parseRequiredMediaPath = (value, fieldName) => {
  return parseRequiredString(value, fieldName, 2000);
};

const parseOptionalMediaPath = (value, fieldName) => {
  return parseOptionalString(value, fieldName, 2000);
};

const parseBoolean = (value, fieldName, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;

  throw new AppError(`${fieldName} must be a boolean`, 400);
};

const parseStringArray = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  let parsed;

  if (Array.isArray(value)) {
    parsed = value
      .map((item) => String(item || "").trim())
      .filter((item) => item.length > 0);
  } else {
    parsed = String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (parsed.some((item) => item.length > 100)) {
    throw new AppError(
      `${fieldName} values must be at most 100 characters`,
      400,
    );
  }

  return parsed;
};

const parseExercisePayload = (payload, { partial = false } = {}) => {
  const nextData = {};

  const nameEnInput = payload.name_en ?? payload.name;
  if (nameEnInput !== undefined || !partial) {
    nextData.name_en = parseRequiredString(nameEnInput, "name_en", 200);
  }

  if (payload.name_ar !== undefined) {
    nextData.name_ar = parseOptionalString(payload.name_ar, "name_ar", 200);
  } else if (!partial) {
    nextData.name_ar = null;
  }

  const primaryMuscleInput = payload.primary_muscle ?? payload.category;
  if (primaryMuscleInput !== undefined || !partial) {
    nextData.primary_muscle = parseRequiredString(
      primaryMuscleInput,
      "primary_muscle",
      50,
    ).toLowerCase();
  }

  if (payload.secondary_muscles !== undefined || !partial) {
    nextData.secondary_muscles = parseStringArray(
      payload.secondary_muscles,
      "secondary_muscles",
    ).map((item) => item.toLowerCase());
  }

  if (payload.equipment !== undefined || !partial) {
    nextData.equipment = parseRequiredString(
      payload.equipment,
      "equipment",
      80,
    ).toLowerCase();
  }

  if (payload.difficulty !== undefined || !partial) {
    nextData.difficulty = parseRequiredString(
      payload.difficulty,
      "difficulty",
      50,
    ).toLowerCase();
  }

  if (payload.exercise_type !== undefined || !partial) {
    nextData.exercise_type = parseRequiredString(
      payload.exercise_type,
      "exercise_type",
      80,
    ).toLowerCase();
  }

  if (payload.classification !== undefined || !partial) {
    nextData.classification = parseStringArray(
      payload.classification,
      "classification",
    );
  }

  if (payload.movement_pattern !== undefined || !partial) {
    nextData.movement_pattern = parseRequiredString(
      payload.movement_pattern,
      "movement_pattern",
      80,
    );
  }

  if (payload.fitness_goals !== undefined || !partial) {
    nextData.fitness_goals = parseStringArray(
      payload.fitness_goals,
      "fitness_goals",
    );
  }

  if (payload.workout_location !== undefined || !partial) {
    nextData.workout_location = parseRequiredString(
      payload.workout_location,
      "workout_location",
      50,
    ).toLowerCase();
  }

  if (payload.media_type !== undefined || !partial) {
    nextData.media_type = parseRequiredString(
      payload.media_type,
      "media_type",
      50,
    ).toLowerCase();
  }

  const mediaUrlInput = payload.media_url;
  if (mediaUrlInput !== undefined || !partial) {
    nextData.media_url = parseRequiredMediaPath(mediaUrlInput, "media_url");
  }

  const parsedVideoUrl = parseOptionalMediaPath(payload.video_url, "video_url");
  if (parsedVideoUrl !== undefined) {
    nextData.video_url = parsedVideoUrl;
  } else if (!partial) {
    nextData.video_url = null;
  }

  if (payload.tags !== undefined || !partial) {
    nextData.tags = parseStringArray(payload.tags, "tags").map((item) =>
      item.toLowerCase(),
    );
  }

  if (payload.is_default !== undefined || !partial) {
    nextData.is_default = parseBoolean(payload.is_default, "is_default", false);
  }

  if (payload.priority !== undefined || !partial) {
    nextData.priority = parseRequiredString(payload.priority, "priority", 50);
  }

  if (payload.instructions !== undefined) {
    nextData.instructions = parseOptionalString(
      payload.instructions,
      "instructions",
      2000,
    );
  } else if (!partial) {
    nextData.instructions = null;
  }

  return nextData;
};

const canAccessExercise = (userId, exercise) => {
  if (!exercise.trainerId) return true;
  return String(exercise.trainerId) === String(userId);
};

const mapToLegacyCategory = (primaryMuscle) => {
  const normalized = String(primaryMuscle || "")
    .trim()
    .toUpperCase();
  return normalized || null;
};

const toExerciseResponse = (exercise) => ({
  ...exercise,
  name: exercise.name_en,
  category: mapToLegacyCategory(exercise.primary_muscle),
  videoUrl: exercise.video_url,
});

const parseBooleanQuery = (value, fieldName) => {
  if (value === undefined) return undefined;
  return parseBoolean(value, fieldName);
};

const normalizeQueryArray = (value, fieldName) => {
  return parseStringArray(value, fieldName)
    .map((item) => item.toLowerCase())
    .sort();
};

const buildExerciseListFilters = (req) => {
  const filters = {};

  const scope = String(req.query.scope || "")
    .trim()
    .toLowerCase();
  if (scope) {
    filters.scope = scope;
  }

  const search = String(req.query.search || "").trim();
  if (search) {
    filters.search = search;
  }

  const primaryMuscle = String(
    req.query.primary_muscle ?? req.query.category ?? "",
  )
    .trim()
    .toLowerCase();
  if (primaryMuscle) {
    filters.primary_muscle = primaryMuscle;
  }

  const secondaryMuscles = normalizeQueryArray(
    req.query.secondary_muscles,
    "secondary_muscles",
  );
  if (secondaryMuscles.length > 0) {
    filters.secondary_muscles = secondaryMuscles;
  }

  const difficulty = String(req.query.difficulty || "")
    .trim()
    .toLowerCase();
  if (difficulty) {
    filters.difficulty = difficulty;
  }

  const exerciseType = String(req.query.exercise_type || "")
    .trim()
    .toLowerCase();
  if (exerciseType) {
    filters.exercise_type = exerciseType;
  }

  const classification = normalizeQueryArray(
    req.query.classification,
    "classification",
  );
  if (classification.length > 0) {
    filters.classification = classification;
  }

  const fitnessGoals = normalizeQueryArray(
    req.query.fitness_goals,
    "fitness_goals",
  );
  if (fitnessGoals.length > 0) {
    filters.fitness_goals = fitnessGoals;
  }

  const tags = normalizeQueryArray(req.query.tags, "tags");
  if (tags.length > 0) {
    filters.tags = tags;
  }

  const isDefault = parseBooleanQuery(req.query.is_default, "is_default");
  if (isDefault !== undefined) {
    filters.is_default = isDefault;
  }

  const equipment = String(req.query.equipment || "")
    .trim()
    .toLowerCase();
  if (equipment) {
    filters.equipment = equipment;
  }

  const workoutLocation = String(req.query.workout_location || "")
    .trim()
    .toLowerCase();
  if (workoutLocation) {
    filters.workout_location = workoutLocation;
  }

  const priority = String(req.query.priority || "").trim();
  if (priority) {
    filters.priority = priority;
  }

  return filters;
};

const buildListWhere = (req, filters) => {
  const where = {};

  where.OR = [{ trainerId: req.user.id }, { trainerId: null }];

  if (filters.scope === "mine") {
    where.OR = [{ trainerId: req.user.id }];
  }

  if (filters.scope === "default") {
    where.OR = [{ trainerId: null }];
  }

  const search = filters.search || "";
  if (search) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        {
          name_en: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          name_ar: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          tags: {
            has: search.toLowerCase(),
          },
        },
      ],
    });
  }

  const primaryMuscle = filters.primary_muscle || "";
  if (primaryMuscle) {
    where.primary_muscle = primaryMuscle;
  }

  const secondaryMuscles = filters.secondary_muscles || [];
  if (secondaryMuscles.length > 0) {
    where.secondary_muscles = {
      hasSome: secondaryMuscles,
    };
  }

  const difficulty = filters.difficulty || "";
  if (difficulty) {
    where.difficulty = difficulty;
  }

  const exerciseType = filters.exercise_type || "";
  if (exerciseType) {
    where.exercise_type = exerciseType;
  }

  const classification = filters.classification || [];
  if (classification.length > 0) {
    where.classification = {
      hasSome: classification,
    };
  }

  const fitnessGoals = filters.fitness_goals || [];
  if (fitnessGoals.length > 0) {
    where.fitness_goals = {
      hasSome: fitnessGoals,
    };
  }

  const tags = filters.tags || [];
  if (tags.length > 0) {
    where.tags = {
      hasSome: tags,
    };
  }

  const isDefault = filters.is_default;
  if (isDefault !== undefined) {
    where.is_default = isDefault;
  }

  const equipment = filters.equipment || "";
  if (equipment) {
    where.equipment = equipment;
  }

  const workoutLocation = filters.workout_location || "";
  if (workoutLocation) {
    where.workout_location = workoutLocation;
  }

  const priority = filters.priority || "";
  if (priority) {
    where.priority = priority;
  }

  return where;
};

const ensureCanMutateExercise = (req, exercise) => {
  if (
    !exercise.trainerId ||
    String(exercise.trainerId) !== String(req.user.id)
  ) {
    throw new AppError(
      "Forbidden: You can only modify your own exercises",
      403,
    );
  }
};

export const createExercise = async (req, res, next) => {
  try {
    ensureTrainerUser(req);
    ensureValidTrainerId(req.user.id);

    const parsed = parseExercisePayload(req.body, { partial: false });

    if (
      req.body.id !== undefined &&
      req.body.id !== null &&
      req.body.id !== ""
    ) {
      if (!UUID_REGEX.test(String(req.body.id))) {
        return next(new AppError("id must be a valid UUID", 400));
      }
      parsed.id = String(req.body.id);
    }

    const created = await prisma.exercise.create({
      data: {
        trainerId: req.user.id,
        ...parsed,
      },
      select: EXERCISE_SELECT,
    });

    invalidateCacheByTags(buildResourceTags("exercises"));

    return res.status(201).json({
      status: "success",
      data: toExerciseResponse(created),
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
      where: { id: String(id) },
      select: EXERCISE_SELECT,
    });

    if (!exercise) {
      return next(new AppError("Exercise not found", 404));
    }

    if (!canAccessExercise(req.user.id, exercise)) {
      return next(
        new AppError("Forbidden: You do not have access to this exercise", 403),
      );
    }

    return res.status(200).json({
      status: "success",
      data: toExerciseResponse(exercise),
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllExercises = async (req, res, next) => {
  try {
    ensureTrainerUser(req);

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 25,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const filters = buildExerciseListFilters(req);
    const where = buildListWhere(req, filters);
    const cacheKey = makeCacheKey([
      "exercises",
      "getAll",
      req.user?.id,
      filters,
      { page, limit, skip, sort, order },
    ]);

    const cached = getCache(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, source: "cache" });
    }

    const [total, exercises] = await prisma.$transaction([
      prisma.exercise.count({ where }),
      prisma.exercise.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: EXERCISE_SELECT,
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    const payload = {
      status: "success",
      data: exercises.map(toExerciseResponse),
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
    };

    setCache(cacheKey, payload, buildResourceTags("exercises"));

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
      where: { id: String(id) },
      select: {
        id: true,
        trainerId: true,
      },
    });

    if (!existing) {
      return next(new AppError("Exercise not found", 404));
    }

    ensureCanMutateExercise(req, existing);

    const allowedFields = [
      "name_en",
      "name",
      "name_ar",
      "primary_muscle",
      "secondary_muscles",
      "equipment",
      "difficulty",
      "exercise_type",
      "classification",
      "movement_pattern",
      "fitness_goals",
      "workout_location",
      "media_type",
      "media_url",
      "video_url",
      "tags",
      "is_default",
      "priority",
      "instructions",
    ];

    const payloadKeys = Object.keys(req.body || {});

    if (payloadKeys.length === 0) {
      return next(new AppError("No fields provided for update", 400));
    }

    for (const key of payloadKeys) {
      if (!allowedFields.includes(key)) {
        return next(new AppError(`Field '${key}' cannot be updated`, 400));
      }
    }

    const updateData = parseExercisePayload(req.body, { partial: true });
    if (Object.keys(updateData).length === 0) {
      return next(new AppError("No valid fields provided for update", 400));
    }

    const updated = await prisma.exercise.update({
      where: { id: String(id) },
      data: updateData,
      select: EXERCISE_SELECT,
    });

    invalidateCacheByTags(buildResourceTags("exercises", updated.id));
    invalidateCacheByTags(buildResourceTags("exercises"));

    return res.status(200).json({
      status: "success",
      data: toExerciseResponse(updated),
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
      where: { id: String(id) },
      select: {
        id: true,
        trainerId: true,
        _count: {
          select: {
            workoutItems: true,
            workoutTemplateItems: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Exercise not found", 404));
    }

    ensureCanMutateExercise(req, existing);

    if (
      existing._count.workoutItems > 0 ||
      existing._count.workoutTemplateItems > 0
    ) {
      return next(
        new AppError(
          "Cannot delete exercise that is used by workout or template items",
          400,
        ),
      );
    }

    await prisma.exercise.delete({ where: { id: String(id) } });

    invalidateCacheByTags(buildResourceTags("exercises", String(id)));
    invalidateCacheByTags(buildResourceTags("exercises"));

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
    if (req.user.roleName !== "DEVELOPER") {
      return next(new AppError("Forbidden: Only developers can delete all exercises", 403));
    }
    ensureTrainerUser(req);
    ensureValidTrainerId(req.user.id);

    const result = await prisma.exercise.deleteMany({
      where: { trainerId: req.user.id },
    });

    invalidateCacheByTags(buildResourceTags("exercises"));

    return res.status(200).json({
      status: "success",
      message: "All trainer exercises deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
