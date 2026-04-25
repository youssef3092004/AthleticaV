import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const MAX_QUESTION_LENGTH = 4000;
const MAX_ANSWER_LENGTH = 4000;
const MAX_KEY_LENGTH = 120;

const ALLOWED_SORT_FIELDS = new Set([
  "checkIn",
  "createdAt",
  "updatedAt",
  "trainerId",
  "clientId",
  "key",
  "id",
]);

const QUESTION_SELECT = {
  id: true,
  trainerId: true,
  clientId: true,
  question: true,
  answer: true,
  key: true,
  checkIn: true,
  createdAt: true,
  updatedAt: true,
};

const normalizeSortField = (sortField) => {
  const value = String(sortField || "").trim();
  if (ALLOWED_SORT_FIELDS.has(value)) {
    return value;
  }

  return "checkIn";
};

const parseRequiredText = (value, fieldName, maxLength) => {
  if (value === undefined || value === null) {
    throw new AppError(`${fieldName} is required`, 400);
  }

  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(`${fieldName} cannot be empty`, 400);
  }

  if (trimmed.length > maxLength) {
    throw new AppError(
      `${fieldName} cannot exceed ${maxLength} characters`,
      400,
    );
  }

  return trimmed;
};

const parseOptionalText = (value, fieldName, maxLength) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(`${fieldName} cannot be empty`, 400);
  }

  if (trimmed.length > maxLength) {
    throw new AppError(
      `${fieldName} cannot exceed ${maxLength} characters`,
      400,
    );
  }

  return trimmed;
};

const parseCheckIn = (value) => {
  if (value === undefined || value === null || value === "") {
    throw new AppError("checkIn is required", 400);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError("checkIn must be a valid date", 400);
  }

  return parsed;
};

const getUserId = (access) => String(access.userId || "").trim();

const isTrainerOwner = (access, trainerId) =>
  access.roles.includes("TRAINER") && getUserId(access) === String(trainerId);

const isClientOwner = (access, clientId) =>
  access.roles.includes("CLIENT") && getUserId(access) === String(clientId);

const ensureUserExists = async (userId, label) => {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureTrainerClientLink = async (trainerId, clientId) => {
  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: { id: true, status: true },
  });

  if (!relation) {
    throw new AppError("Trainer-client relationship not found", 404);
  }

  if (relation.status !== "ACTIVE") {
    throw new AppError("Trainer-client relationship is not active", 409);
  }

  return relation;
};

const ensureCanViewQuestion = (access, trainerId, clientId) => {
  if (access.isPrivileged) {
    return;
  }

  if (isTrainerOwner(access, trainerId) || isClientOwner(access, clientId)) {
    return;
  }

  throw new AppError("Forbidden", 403);
};

const ensureCanDeleteQuestion = (access, trainerId) => {
  if (access.isPrivileged) {
    return;
  }

  if (isTrainerOwner(access, trainerId)) {
    return;
  }

  throw new AppError("Forbidden", 403);
};

const buildBaseWhereForAccess = (access) => {
  if (access.isPrivileged) {
    return {};
  }

  const clauses = [];

  if (access.roles.includes("TRAINER")) {
    clauses.push({ trainerId: getUserId(access) });
  }

  if (access.roles.includes("CLIENT")) {
    clauses.push({ clientId: getUserId(access) });
  }

  if (clauses.length === 0) {
    throw new AppError("Forbidden", 403);
  }

  return clauses.length === 1 ? clauses[0] : { OR: clauses };
};

const buildListFilters = (query = {}) => {
  const filters = {};

  if (query.key) {
    filters.key = {
      contains: String(query.key).trim(),
      mode: "insensitive",
    };
  }

  if (query.answered !== undefined) {
    const raw = String(query.answered).trim().toLowerCase();
    if (raw === "true") {
      filters.answer = { not: null };
    } else if (raw === "false") {
      filters.answer = null;
    } else {
      throw new AppError("answered must be true or false", 400);
    }
  }

  if (query.checkInFrom || query.checkInTo) {
    filters.checkIn = {};

    if (query.checkInFrom) {
      const from = new Date(query.checkInFrom);
      if (Number.isNaN(from.getTime())) {
        throw new AppError("checkInFrom must be a valid date", 400);
      }
      filters.checkIn.gte = from;
    }

    if (query.checkInTo) {
      const to = new Date(query.checkInTo);
      if (Number.isNaN(to.getTime())) {
        throw new AppError("checkInTo must be a valid date", 400);
      }
      filters.checkIn.lte = to;
    }
  }

  if (query.search) {
    const term = String(query.search).trim();
    if (!term) {
      throw new AppError("search cannot be empty", 400);
    }

    filters.OR = [
      {
        question: {
          contains: term,
          mode: "insensitive",
        },
      },
      {
        key: {
          contains: term,
          mode: "insensitive",
        },
      },
      {
        answer: {
          contains: term,
          mode: "insensitive",
        },
      },
    ];
  }

  return filters;
};

const combineWhereClauses = (baseWhere, filters) => {
  const hasBaseWhere = baseWhere && Object.keys(baseWhere).length > 0;
  const hasFilters = filters && Object.keys(filters).length > 0;

  if (!hasBaseWhere) {
    return filters || {};
  }

  if (!hasFilters) {
    return baseWhere;
  }

  return {
    AND: [baseWhere, filters],
  };
};

const getQuestionList = async (where, req) => {
  const { page, limit, skip, sort, order } = pagination(req, {
    defaultSort: "checkIn",
    defaultOrder: "desc",
    defaultLimit: 20,
  });

  const normalizedSort = normalizeSortField(sort);
  const [total, questions] = await prisma.$transaction([
    prisma.trainerQuestion.count({ where }),
    prisma.trainerQuestion.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [normalizedSort]: order,
      },
      select: QUESTION_SELECT,
    }),
  ]);

  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    sort: normalizedSort,
    order,
    questions,
  };
};

export const createTrainerQuestion = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const requestedTrainerId = String(
      req.body.trainerId || getUserId(access),
    ).trim();
    const clientId = String(req.body.clientId || "").trim();

    if (!requestedTrainerId) {
      throw new AppError("trainerId is required", 400);
    }

    if (!clientId) {
      throw new AppError("clientId is required", 400);
    }

    if (!access.isPrivileged && requestedTrainerId !== getUserId(access)) {
      throw new AppError("Forbidden", 403);
    }

    const question = parseRequiredText(
      req.body.question ?? req.body.prompt,
      "question",
      MAX_QUESTION_LENGTH,
    );
    const key = parseRequiredText(req.body.key, "key", MAX_KEY_LENGTH);
    const answer = parseOptionalText(
      req.body.answer ?? req.body.response,
      "answer",
      MAX_ANSWER_LENGTH,
    );
    const checkIn = parseCheckIn(req.body.checkIn);

    await Promise.all([
      ensureUserExists(requestedTrainerId, "Trainer"),
      ensureUserExists(clientId, "Client"),
      ensureTrainerClientLink(requestedTrainerId, clientId),
    ]);

    const createdQuestion = await prisma.trainerQuestion.create({
      data: {
        trainerId: requestedTrainerId,
        clientId,
        question,
        answer,
        key,
        checkIn,
      },
      select: QUESTION_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: createdQuestion,
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerQuestionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const { id } = req.params;

    if (!id) {
      throw new AppError("Question ID is required", 400);
    }

    const question = await prisma.trainerQuestion.findUnique({
      where: { id },
      select: QUESTION_SELECT,
    });

    if (!question) {
      throw new AppError("Trainer question not found", 404);
    }

    ensureCanViewQuestion(access, question.trainerId, question.clientId);

    return res.status(200).json({
      success: true,
      data: question,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllTrainerQuestions = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER", "CLIENT"], "Forbidden");

    const where = combineWhereClauses(
      buildBaseWhereForAccess(access),
      buildListFilters(req.query),
    );

    const result = await getQuestionList(where, req);

    return res.status(200).json({
      success: true,
      data: result.questions,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        sort: result.sort,
        order: result.order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerQuestionsByTrainerId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const { trainerId } = req.params;

    if (!trainerId) {
      throw new AppError("trainerId is required", 400);
    }

    if (!access.isPrivileged && !isTrainerOwner(access, trainerId)) {
      throw new AppError("Forbidden", 403);
    }

    const where = combineWhereClauses(
      { trainerId: String(trainerId) },
      buildListFilters(req.query),
    );

    const result = await getQuestionList(where, req);

    return res.status(200).json({
      success: true,
      data: result.questions,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        sort: result.sort,
        order: result.order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerQuestionsByClientId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const { clientId } = req.params;

    if (!clientId) {
      throw new AppError("clientId is required", 400);
    }

    if (!access.isPrivileged && !isClientOwner(access, clientId)) {
      throw new AppError("Forbidden", 403);
    }

    const where = combineWhereClauses(
      { clientId: String(clientId) },
      buildListFilters(req.query),
    );

    const result = await getQuestionList(where, req);

    return res.status(200).json({
      success: true,
      data: result.questions,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        sort: result.sort,
        order: result.order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerQuestionsByPair = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const { trainerId, clientId } = req.params;

    if (!trainerId || !clientId) {
      throw new AppError("trainerId and clientId are required", 400);
    }

    if (!access.isPrivileged) {
      const canAccessAsTrainer = isTrainerOwner(access, trainerId);
      const canAccessAsClient = isClientOwner(access, clientId);

      if (!canAccessAsTrainer && !canAccessAsClient) {
        throw new AppError("Forbidden", 403);
      }
    }

    const where = combineWhereClauses(
      {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
      buildListFilters(req.query),
    );

    const result = await getQuestionList(where, req);

    return res.status(200).json({
      success: true,
      data: result.questions,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        sort: result.sort,
        order: result.order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateTrainerQuestionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const { id } = req.params;

    if (!id) {
      throw new AppError("Question ID is required", 400);
    }

    const existingQuestion = await prisma.trainerQuestion.findUnique({
      where: { id },
      select: QUESTION_SELECT,
    });

    if (!existingQuestion) {
      throw new AppError("Trainer question not found", 404);
    }

    const isTrainer = isTrainerOwner(access, existingQuestion.trainerId);
    const isClient = isClientOwner(access, existingQuestion.clientId);

    if (!access.isPrivileged && !isTrainer && !isClient) {
      throw new AppError("Forbidden", 403);
    }

    const updateData = {};
    const bodyKeys = Object.keys(req.body || {});

    if (isClient && !isTrainer && !access.isPrivileged) {
      const allowedKeys = new Set(["answer", "response"]);
      const hasForbiddenField = bodyKeys.some(
        (key) => !allowedKeys.has(key) && req.body[key] !== undefined,
      );

      if (hasForbiddenField) {
        throw new AppError(
          "Clients can only update the answer for a trainer question",
          403,
        );
      }

      const answer = parseOptionalText(
        req.body.answer ?? req.body.response,
        "answer",
        MAX_ANSWER_LENGTH,
      );

      if (answer === undefined) {
        throw new AppError("answer is required", 400);
      }

      updateData.answer = answer;
    } else {
      if (req.body.question !== undefined || req.body.prompt !== undefined) {
        updateData.question = parseRequiredText(
          req.body.question ?? req.body.prompt,
          "question",
          MAX_QUESTION_LENGTH,
        );
      }

      if (req.body.key !== undefined) {
        updateData.key = parseRequiredText(req.body.key, "key", MAX_KEY_LENGTH);
      }

      if (req.body.checkIn !== undefined) {
        updateData.checkIn = parseCheckIn(req.body.checkIn);
      }

      if (req.body.answer !== undefined || req.body.response !== undefined) {
        updateData.answer = parseOptionalText(
          req.body.answer ?? req.body.response,
          "answer",
          MAX_ANSWER_LENGTH,
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError("No valid fields provided for update", 400);
    }

    const updatedQuestion = await prisma.trainerQuestion.update({
      where: { id },
      data: updateData,
      select: QUESTION_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: updatedQuestion,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteTrainerQuestionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const { id } = req.params;

    if (!id) {
      throw new AppError("Question ID is required", 400);
    }

    const existingQuestion = await prisma.trainerQuestion.findUnique({
      where: { id },
      select: QUESTION_SELECT,
    });

    if (!existingQuestion) {
      throw new AppError("Trainer question not found", 404);
    }

    ensureCanDeleteQuestion(access, existingQuestion.trainerId);

    await prisma.trainerQuestion.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: "Trainer question deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};
