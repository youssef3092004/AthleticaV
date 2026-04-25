import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const TRANSACTION_SELECT = {
  id: true,
  kind: true,
  clientId: true,
  trainerId: true,
  programId: true,
  planId: true,
  subscriptionId: true,
  grossAmount: true,
  platformFee: true,
  trainerAmount: true,
  currency: true,
  paymentMode: true,
  directMethod: true,
  decisionNote: true,
  decidedAt: true,
  status: true,
  createdAt: true,
};

const ALLOWED_TRANSACTION_STATUSES = new Set(["PENDING", "PAID", "FAILED"]);
const ALLOWED_TRANSACTION_KINDS = new Set([
  "CLIENT_TO_TRAINER",
  "TRAINER_TO_PLATFORM_SUBSCRIPTION",
]);
const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "grossAmount",
  "status",
  "kind",
]);

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

const parseKind = (value) => {
  const normalized = String(value || "CLIENT_TO_TRAINER")
    .trim()
    .toUpperCase();

  if (!ALLOWED_TRANSACTION_KINDS.has(normalized)) {
    throw new AppError("kind is invalid", 400);
  }

  return normalized;
};

const parsePaymentMode = (value) => {
  const normalized = String(value || "PLATFORM")
    .trim()
    .toUpperCase();

  if (normalized !== "PLATFORM" && normalized !== "DIRECT") {
    throw new AppError("paymentMode must be PLATFORM or DIRECT", 400);
  }

  return normalized;
};

const parseOptionalDirectMethod = (value) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  return String(value).trim().toUpperCase();
};

const parseOptionalDecisionNote = (value) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const parsed = String(value).trim();
  if (parsed.length > 1000) {
    throw new AppError("decisionNote must be at most 1000 characters", 400);
  }

  return parsed;
};

const isTrainer = (access) => access.roles.includes("TRAINER");
const isClient = (access) => access.roles.includes("CLIENT");

const ensureUserExists = async (userId, label) => {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(`${label} not found`, 404);
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

const addBillingCyclePeriod = (start, billingCycle) => {
  const end = new Date(start);
  if (billingCycle === "ANNUAL") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    return end;
  }

  end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
};

const ensurePlanExists = async (planId) => {
  const plan = await prisma.plan.findUnique({
    where: { id: String(planId) },
    select: {
      id: true,
      billingCycle: true,
      isActive: true,
    },
  });

  if (!plan) {
    throw new AppError("Plan not found", 404);
  }

  if (!plan.isActive) {
    throw new AppError("Plan is inactive", 409);
  }

  return plan;
};

const activateOrCreateSubscriptionFromPayment = async (tx, trainerId, plan) => {
  const now = new Date();
  const periodEnd = addBillingCyclePeriod(now, plan.billingCycle);

  const existing = await tx.subscription.findFirst({
    where: {
      userId: String(trainerId),
      planId: String(plan.id),
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      startDate: true,
    },
  });

  if (existing) {
    return tx.subscription.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        startDate: existing.startDate || now,
        endDate: periodEnd,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      select: { id: true },
    });
  }

  return tx.subscription.create({
    data: {
      userId: String(trainerId),
      planId: String(plan.id),
      status: "ACTIVE",
      startDate: now,
      endDate: periodEnd,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    select: { id: true },
  });
};

export const createTransaction = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["CLIENT", "TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const kind = parseKind(req.body.kind);
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
    const paymentMode = parsePaymentMode(req.body.paymentMode);
    const directMethod = parseOptionalDirectMethod(req.body.directMethod);

    if (paymentMode === "PLATFORM" && directMethod) {
      return next(
        new AppError(
          "directMethod is only allowed when paymentMode is DIRECT",
          400,
        ),
      );
    }

    if (paymentMode === "DIRECT" && !directMethod) {
      return next(
        new AppError(
          "directMethod is required when paymentMode is DIRECT",
          400,
        ),
      );
    }

    let clientId = null;
    let trainerId = null;
    let planId = null;

    if (kind === "CLIENT_TO_TRAINER") {
      clientId = String(req.body.clientId || "").trim();
      trainerId = String(req.body.trainerId || "").trim();

      if (!clientId) {
        return next(new AppError("clientId is required", 400));
      }

      if (!trainerId) {
        return next(new AppError("trainerId is required", 400));
      }

      if (!access.isPrivileged && !isClient(access)) {
        return next(
          new AppError("Only clients can create trainer payment requests", 403),
        );
      }

      const effectiveClientId = access.isPrivileged
        ? clientId
        : String(access.userId);

      if (
        !access.isPrivileged &&
        String(effectiveClientId) !== String(clientId)
      ) {
        return next(
          new AppError(
            "Forbidden: clientId must match authenticated client",
            403,
          ),
        );
      }

      clientId = effectiveClientId;

      await ensureUserExists(trainerId, "Trainer user");
      await ensureUserExists(clientId, "Client user");
    } else {
      trainerId = access.isPrivileged
        ? String(req.body.trainerId || access.userId).trim()
        : String(access.userId);

      planId = String(req.body.planId || "").trim();

      if (!trainerId) {
        return next(new AppError("trainerId is required", 400));
      }

      if (!planId) {
        return next(new AppError("planId is required", 400));
      }

      if (!access.isPrivileged && !isTrainer(access)) {
        return next(
          new AppError(
            "Only trainers can create platform subscription payments",
            403,
          ),
        );
      }

      await ensureUserExists(trainerId, "Trainer user");
      await ensurePlanExists(planId);
    }

    const created = await prisma.transaction.create({
      data: {
        kind,
        trainerId,
        clientId,
        planId,
        grossAmount: grossAmount.toFixed(2),
        platformFee: platformFee.toFixed(2),
        trainerAmount: trainerAmount.toFixed(2),
        currency,
        paymentMode,
        directMethod,
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

    if (req.query.kind) {
      where.kind = parseKind(req.query.kind);
    }

    if (req.query.paymentMode) {
      where.paymentMode = parsePaymentMode(req.query.paymentMode);
    }

    if (req.query.planId) {
      where.planId = String(req.query.planId).trim();
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
    if (nextStatus !== "PAID" && nextStatus !== "FAILED") {
      return next(
        new AppError(
          "status can only be PAID (approve) or FAILED (decline)",
          400,
        ),
      );
    }

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

    if (existing.status !== "PENDING") {
      return next(
        new AppError(
          "Only pending transactions can be approved or declined",
          409,
        ),
      );
    }

    const decisionNote = parseOptionalDecisionNote(req.body.decisionNote);

    const updated = await prisma.$transaction(async (tx) => {
      let subscriptionId = existing.subscriptionId;

      if (
        existing.kind === "TRAINER_TO_PLATFORM_SUBSCRIPTION" &&
        nextStatus === "PAID"
      ) {
        if (!existing.planId) {
          throw new AppError("Subscription transaction must have planId", 409);
        }

        const plan = await tx.plan.findUnique({
          where: { id: String(existing.planId) },
          select: {
            id: true,
            billingCycle: true,
            isActive: true,
          },
        });

        if (!plan) {
          throw new AppError("Plan not found", 404);
        }

        if (!plan.isActive) {
          throw new AppError("Plan is inactive", 409);
        }

        const subscription = await activateOrCreateSubscriptionFromPayment(
          tx,
          existing.trainerId,
          plan,
        );
        subscriptionId = subscription.id;
      }

      return tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: nextStatus,
          decidedAt: new Date(),
          subscriptionId,
          ...(decisionNote !== undefined ? { decisionNote } : {}),
        },
        select: TRANSACTION_SELECT,
      });
    });

    return res.status(200).json({
      success: true,
      data: toTransactionResponse(updated),
    });
  } catch (error) {
    return next(error);
  }
};
