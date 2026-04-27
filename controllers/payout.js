import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const PAYOUT_SELECT = {
  id: true,
  trainerId: true,
  amount: true,
  status: true,
  requestedAt: true,
  paidAt: true,
};

const ALLOWED_PAYOUT_STATUSES = new Set(["REQUESTED", "PAID"]);
const ALLOWED_SORT_FIELDS = new Set(["requestedAt", "amount", "status"]);

const toAmountNumber = (value) =>
  value === null || value === undefined ? null : Number(value);

const toPayoutResponse = (row) => ({
  ...row,
  amount: toAmountNumber(row.amount),
});

const parseAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("amount must be a positive number", 400);
  }

  return Number(parsed.toFixed(2));
};

const parseStatus = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  if (!ALLOWED_PAYOUT_STATUSES.has(normalized)) {
    throw new AppError("Invalid status", 400);
  }

  return normalized;
};

export const requestPayout = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const trainerId = access.isPrivileged
      ? String(req.body.trainerId || access.userId).trim()
      : access.userId;

    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    const amount = parseAmount(req.body.amount);

    const result = await prisma.$transaction(async (tx) => {
      // Ensure wallet exists
      const wallet = await tx.trainerWallet.upsert({
        where: { trainerId },
        update: {},
        create: {
          trainerId,
          balance: "0.00",
          totalEarned: "0.00",
        },
        select: {
          trainerId: true,
          balance: true,
        },
      });

      const currentBalance = Number(wallet.balance);
      if (currentBalance < amount) {
        throw new AppError("Insufficient wallet balance", 400);
      }

      // Use atomic decrement to prevent race conditions
      const updated = await tx.trainerWallet.update({
        where: { trainerId },
        data: {
          balance: {
            decrement: amount,
          },
        },
        select: {
          balance: true,
        },
      });

      const payout = await tx.payout.create({
        data: {
          trainerId,
          amount: amount.toFixed(2),
          status: "REQUESTED",
        },
        select: PAYOUT_SELECT,
      });

      await tx.activityLog.create({
        data: {
          userId: access.userId,
          action: "PAYOUT_REQUESTED",
          metadata: {
            payoutId: payout.id,
            trainerId,
            amount: amount.toFixed(2),
            previousBalance: currentBalance.toFixed(2),
            newBalance: Number(updated.balance).toFixed(2),
          },
        },
      });

      return payout;
    });

    return res.status(201).json({
      success: true,
      data: toPayoutResponse(result),
    });
  } catch (error) {
    return next(error);
  }
};

export const listPayouts = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER", "SUPPORT"],
      "Forbidden",
    );

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "requestedAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.has(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = {};

    if (req.query.status) {
      where.status = parseStatus(req.query.status);
    }

    if (access.isPrivileged || access.roles.includes("SUPPORT")) {
      if (req.query.trainerId) {
        where.trainerId = String(req.query.trainerId).trim();
      }
    } else {
      where.trainerId = access.userId;
    }

    const [total, payouts] = await prisma.$transaction([
      prisma.payout.count({ where }),
      prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        select: PAYOUT_SELECT,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: payouts.map(toPayoutResponse),
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

export const markPayoutPaid = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["ADMIN", "OWNER", "DEVELOPER"], "Forbidden");

    const payoutId = String(req.params.payoutId || "").trim();
    if (!payoutId) {
      return next(new AppError("payoutId is required", 400));
    }

    const existing = await prisma.payout.findUnique({
      where: { id: payoutId },
      select: PAYOUT_SELECT,
    });

    if (!existing) {
      return next(new AppError("Payout not found", 404));
    }

    if (existing.status === "PAID") {
      return res.status(200).json({
        success: true,
        data: toPayoutResponse(existing),
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const payout = await tx.payout.update({
        where: { id: payoutId },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
        select: PAYOUT_SELECT,
      });

      await tx.activityLog.create({
        data: {
          userId: access.userId,
          action: "PAYOUT_MARKED_PAID",
          metadata: {
            payoutId: payout.id,
            trainerId: payout.trainerId,
            amount: payout.amount,
          },
        },
      });

      return payout;
    });

    return res.status(200).json({
      success: true,
      data: toPayoutResponse(updated),
    });
  } catch (error) {
    return next(error);
  }
};
