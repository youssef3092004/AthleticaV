import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const TRANSACTION_SELECT = {
  id: true,
  clientId: true,
  trainerId: true,
  grossAmount: true,
  platformFee: true,
  trainerAmount: true,
  currency: true,
  status: true,
  createdAt: true,
};

const ALLOWED_TRANSACTION_STATUSES = new Set(["PENDING", "PAID", "FAILED"]);
const ALLOWED_SORT_FIELDS = new Set(["createdAt", "grossAmount", "status"]);

const toAmountNumber = (value) =>
  value === null || value === undefined ? null : Number(value);

const toTransactionResponse = (row) => ({
  ...row,
  grossAmount: toAmountNumber(row.grossAmount),
  platformFee: toAmountNumber(row.platformFee),
  trainerAmount: toAmountNumber(row.trainerAmount),
});

const parseAmount = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a valid number >= 0`, 400);
  }

  return Number(parsed.toFixed(2));
};

const parseCurrency = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new AppError("currency must be a 3-letter ISO code", 400);
  }

  return normalized;
};

const parseStatus = (value, fieldName = "status") => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!ALLOWED_TRANSACTION_STATUSES.has(normalized)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }

  return normalized;
};

const isTrainer = (access) => access.roles.includes("TRAINER");
const isClient = (access) => access.roles.includes("CLIENT");

const ensureTrainerClientRelation = async (trainerId, clientId) => {
  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: {
      status: true,
    },
  });

  if (!relation || relation.status !== "ACTIVE") {
    throw new AppError("No active trainer-client relation found", 403);
  }
};

const ensureCanViewTransaction = (access, transaction) => {
  if (access.isPrivileged) return;

  const isOwnerTrainer =
    String(access.userId) === String(transaction.trainerId);
  const isOwnerClient = String(access.userId) === String(transaction.clientId);

  if (!isOwnerTrainer && !isOwnerClient) {
    throw new AppError("Forbidden", 403);
  }
};

export const createTransaction = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"]);

    const clientId = String(req.body.clientId || "").trim();
    if (!clientId) {
      return next(new AppError("clientId is required", 400));
    }

    const trainerId = access.isPrivileged
      ? String(req.body.trainerId || access.userId).trim()
      : access.userId;

    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    const grossAmount = parseAmount(req.body.grossAmount, "grossAmount");
    const platformFee = parseAmount(req.body.platformFee ?? 0, "platformFee");
    if (platformFee > grossAmount) {
      return next(
        new AppError("platformFee cannot be greater than grossAmount", 400),
      );
    }

    const trainerAmount =
      req.body.trainerAmount !== undefined
        ? parseAmount(req.body.trainerAmount, "trainerAmount")
        : Number((grossAmount - platformFee).toFixed(2));

    const currency = parseCurrency(req.body.currency || "USD");

    await ensureTrainerClientRelation(trainerId, clientId);

    const created = await prisma.transaction.create({
      data: {
        trainerId,
        clientId,
        grossAmount: grossAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        trainerAmount: trainerAmount.toFixed(2),
        currency,
        status: "PENDING",
      },
      select: TRANSACTION_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: toTransactionResponse(created),
    });
  } catch (error) {
    return next(error);
  }
};

export const getTransactionById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    const transactionId = String(req.params.transactionId || "").trim();
    if (!transactionId) {
      return next(new AppError("transactionId is required", 400));
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: TRANSACTION_SELECT,
    });

    if (!transaction) {
      return next(new AppError("Transaction not found", 404));
    }

    ensureCanViewTransaction(access, transaction);

    return res.status(200).json({
      success: true,
      data: toTransactionResponse(transaction),
    });
  } catch (error) {
    return next(error);
  }
};

export const listTransactions = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "CLIENT", "ADMIN", "OWNER", "DEVELOPER", "SUPPORT"],
      "Forbidden",
    );

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.has(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = {};

    if (req.query.status) {
      where.status = parseStatus(req.query.status, "status");
    }

    if (req.query.currency) {
      where.currency = parseCurrency(req.query.currency);
    }

    if (access.isPrivileged || access.roles.includes("SUPPORT")) {
      if (req.query.trainerId) {
        where.trainerId = String(req.query.trainerId).trim();
      }

      if (req.query.clientId) {
        where.clientId = String(req.query.clientId).trim();
      }
    } else if (isTrainer(access)) {
      where.trainerId = access.userId;
      if (req.query.clientId) {
        where.clientId = String(req.query.clientId).trim();
      }
    } else if (isClient(access)) {
      where.clientId = access.userId;
      if (req.query.trainerId) {
        where.trainerId = String(req.query.trainerId).trim();
      }
    } else {
      return next(new AppError("Forbidden", 403));
    }

    const [total, items] = await prisma.$transaction([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        select: TRANSACTION_SELECT,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: items.map(toTransactionResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        sort,
        order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateTransactionStatus = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const transactionId = String(req.params.transactionId || "").trim();
    if (!transactionId) {
      return next(new AppError("transactionId is required", 400));
    }

    const nextStatus = parseStatus(req.body.status);

    const existing = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: TRANSACTION_SELECT,
    });

    if (!existing) {
      return next(new AppError("Transaction not found", 404));
    }

    if (
      !access.isPrivileged &&
      String(existing.trainerId) !== String(access.userId)
    ) {
      return next(new AppError("Forbidden", 403));
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: nextStatus },
      select: TRANSACTION_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: toTransactionResponse(updated),
    });
  } catch (error) {
    return next(error);
  }
};
