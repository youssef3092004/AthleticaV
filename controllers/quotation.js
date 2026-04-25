import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { getUserAccessContext } from "../utils/authz.js";

const MAX_QUOTE_LENGTH = 5000;
const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "trainerId",
  "clientId",
  "id",
]);

const resolveQuoteText = (body = {}) => {
  const raw = body.qote ?? body.quote ?? body.body;

  if (raw === undefined || raw === null) {
    throw new AppError("qote is required", 400);
  }

  if (typeof raw !== "string") {
    throw new AppError("qote must be a string", 400);
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new AppError("qote cannot be empty", 400);
  }

  if (trimmed.length > MAX_QUOTE_LENGTH) {
    throw new AppError("qote cannot exceed 5000 characters", 400);
  }

  return trimmed;
};

const resolveClientId = (body = {}) => {
  const clientId = body.clientId ?? body.clientID;

  if (!clientId || typeof clientId !== "string") {
    throw new AppError("clientId is required", 400);
  }

  return clientId.trim();
};

const resolveTrainerIdFromBody = (body = {}) => {
  const trainerId = body.trainerId ?? body.trainerID;

  if (trainerId === undefined || trainerId === null || trainerId === "") {
    return null;
  }

  if (typeof trainerId !== "string") {
    throw new AppError("trainerId must be a string", 400);
  }

  return trainerId.trim();
};

const normalizeSortField = (sortField) => {
  if (ALLOWED_SORT_FIELDS.has(sortField)) {
    return sortField;
  }

  return "createdAt";
};

const getQuotationSelect = () => ({
  id: true,
  trainerId: true,
  clientId: true,
  qote: true,
  createdAt: true,
});

const ensureTrainerClientLink = async (trainerId, clientId) => {
  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: {
      id: true,
    },
  });

  if (!relation) {
    throw new AppError("Trainer-client relation not found", 404);
  }

  return relation;
};

const ensureUserExists = async (userId, label) => {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(`${label} not found`, 404);
  }

  return user;
};

const resolveAccessWhere = (ctx) => {
  const clauses = [];

  if (ctx.isPrivileged) {
    return {};
  }

  if (ctx.roles.includes("TRAINER")) {
    clauses.push({ trainerId: ctx.userId });
  }

  if (ctx.roles.includes("CLIENT")) {
    clauses.push({ clientId: ctx.userId });
  }

  if (clauses.length === 0) {
    throw new AppError("Forbidden", 403);
  }

  return clauses.length === 1 ? clauses[0] : { OR: clauses };
};

const assertCanMutateQuotation = (ctx, quotation) => {
  if (ctx.isPrivileged) return;

  const isTrainerOwner =
    ctx.roles.includes("TRAINER") &&
    String(quotation.trainerId) === String(ctx.userId);
  const isClientOwner =
    ctx.roles.includes("CLIENT") &&
    String(quotation.clientId) === String(ctx.userId);

  if (!isTrainerOwner && !isClientOwner) {
    throw new AppError("Forbidden", 403);
  }

  if (isClientOwner && !isTrainerOwner) {
    throw new AppError("Clients cannot modify quotations", 403);
  }
};

const assertCanViewQuotation = (ctx, quotation) => {
  if (ctx.isPrivileged) return;

  const canViewAsTrainer =
    ctx.roles.includes("TRAINER") &&
    String(quotation.trainerId) === String(ctx.userId);
  const canViewAsClient =
    ctx.roles.includes("CLIENT") &&
    String(quotation.clientId) === String(ctx.userId);

  if (!canViewAsTrainer && !canViewAsClient) {
    throw new AppError("Forbidden", 403);
  }
};

export const createQuotation = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const qote = resolveQuoteText(req.body);
    const clientId = resolveClientId(req.body);
    const requestedTrainerId = resolveTrainerIdFromBody(req.body);
    const trainerId = requestedTrainerId || ctx.userId;

    if (!ctx.isPrivileged && !ctx.roles.includes("TRAINER")) {
      throw new AppError("Only trainers can create quotations", 403);
    }

    if (
      !ctx.isPrivileged &&
      requestedTrainerId &&
      requestedTrainerId !== ctx.userId
    ) {
      throw new AppError("Forbidden", 403);
    }

    await Promise.all([
      ensureUserExists(trainerId, "Trainer"),
      ensureUserExists(clientId, "Client"),
    ]);

    if (!ctx.isPrivileged) {
      await ensureTrainerClientLink(trainerId, clientId);
    }

    const quotation = await prisma.quotation.create({
      data: {
        trainerId: String(trainerId),
        clientId: String(clientId),
        qote,
      },
      select: getQuotationSelect(),
    });

    return res.status(201).json({
      status: "success",
      data: quotation,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getQuotationById = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const { id } = req.params;

    if (!id) {
      throw new AppError("Quotation ID is required", 400);
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      select: getQuotationSelect(),
    });

    if (!quotation) {
      throw new AppError("Quotation not found", 404);
    }

    assertCanViewQuotation(ctx, quotation);

    return res.status(200).json({
      status: "success",
      data: quotation,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllQuotations = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const normalizedSort = normalizeSortField(sort);
    const where = resolveAccessWhere(ctx);

    const [total, quotations] = await prisma.$transaction([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [normalizedSort]: order,
        },
        select: getQuotationSelect(),
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      data: quotations,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort: normalizedSort,
        order,
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getQuotationsByTrainerId = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const { trainerId } = req.params;

    if (!trainerId) {
      throw new AppError("trainerId is required", 400);
    }

    if (!ctx.isPrivileged && String(ctx.userId) !== String(trainerId)) {
      throw new AppError("Forbidden", 403);
    }

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const normalizedSort = normalizeSortField(sort);
    const where = { trainerId: String(trainerId) };

    const [total, quotations] = await prisma.$transaction([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [normalizedSort]: order,
        },
        select: getQuotationSelect(),
      }),
    ]);

    return res.status(200).json({
      status: "success",
      data: quotations,
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
        sort: normalizedSort,
        order,
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getQuotationsByClientId = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const { clientId } = req.params;

    if (!clientId) {
      throw new AppError("clientId is required", 400);
    }

    if (!ctx.isPrivileged && String(ctx.userId) !== String(clientId)) {
      throw new AppError("Forbidden", 403);
    }

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const normalizedSort = normalizeSortField(sort);
    const where = { clientId: String(clientId) };

    const [total, quotations] = await prisma.$transaction([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [normalizedSort]: order,
        },
        select: getQuotationSelect(),
      }),
    ]);

    return res.status(200).json({
      status: "success",
      data: quotations,
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
        sort: normalizedSort,
        order,
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateQuotationById = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const { id } = req.params;

    if (!id) {
      throw new AppError("Quotation ID is required", 400);
    }

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
      select: getQuotationSelect(),
    });

    if (!existingQuotation) {
      throw new AppError("Quotation not found", 404);
    }

    assertCanMutateQuotation(ctx, existingQuotation);

    const qote = resolveQuoteText(req.body);

    const updatedQuotation = await prisma.quotation.update({
      where: { id },
      data: { qote },
      select: getQuotationSelect(),
    });

    return res.status(200).json({
      status: "success",
      data: updatedQuotation,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteQuotationById = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);
    const { id } = req.params;

    if (!id) {
      throw new AppError("Quotation ID is required", 400);
    }

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
      select: getQuotationSelect(),
    });

    if (!existingQuotation) {
      throw new AppError("Quotation not found", 404);
    }

    assertCanMutateQuotation(ctx, existingQuotation);

    await prisma.quotation.delete({
      where: { id },
    });

    return res.status(200).json({
      status: "success",
      message: "Quotation deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllQuotations = async (req, res, next) => {
  try {
    const ctx = await getUserAccessContext(req);

    if (!ctx.isPrivileged) {
      throw new AppError("Forbidden", 403);
    }

    const result = await prisma.quotation.deleteMany({});

    return res.status(200).json({
      status: "success",
      message: "All quotations deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
