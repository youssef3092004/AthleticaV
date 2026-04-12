import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const WALLET_SELECT = {
  trainerId: true,
  balance: true,
  trainer: {
    select: {
      id: true,
      name: true,
      email: true,
      profileImage: true,
    },
  },
};

const toBalanceNumber = (value) =>
  value === null || value === undefined ? null : Number(value);

const toWalletResponse = (row) => ({
  ...row,
  balance: toBalanceNumber(row.balance),
});

const parseDelta = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) {
    throw new AppError("delta must be a non-zero number", 400);
  }

  return Number(parsed.toFixed(2));
};

const parseOptionalReason = (value) => {
  if (value === undefined) return null;
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (normalized.length > 255) {
    throw new AppError("reason must be at most 255 characters", 400);
  }

  return normalized;
};

const ensureTrainerExists = async (trainerId) => {
  const trainer = await prisma.user.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!trainer) {
    throw new AppError("Trainer not found", 404);
  }

  const hasTrainerRole = trainer.userRoles.some(
    (entry) => entry.role?.name === "TRAINER",
  );
  if (!hasTrainerRole) {
    throw new AppError("Provided user is not a trainer", 400);
  }
};

export const getTrainerWallet = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const trainerId = access.isPrivileged
      ? String(req.query.trainerId || access.userId).trim()
      : access.userId;

    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    await ensureTrainerExists(trainerId);

    const wallet = await prisma.trainerWallet.upsert({
      where: { trainerId },
      update: {},
      create: { trainerId, balance: "0.00" },
      select: WALLET_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: toWalletResponse(wallet),
    });
  } catch (error) {
    return next(error);
  }
};

export const listTrainerWallets = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["ADMIN", "OWNER", "DEVELOPER", "SUPPORT"],
      "Forbidden",
    );

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "trainerId",
      defaultOrder: "asc",
      defaultLimit: 20,
    });

    const sortField = sort === "balance" ? "balance" : "trainerId";

    const [total, wallets] = await prisma.$transaction([
      prisma.trainerWallet.count(),
      prisma.trainerWallet.findMany({
        skip,
        take: limit,
        orderBy: {
          [sortField]: order,
        },
        select: WALLET_SELECT,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: wallets.map(toWalletResponse),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        sort: sortField,
        order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const adjustTrainerWalletBalance = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["ADMIN", "OWNER", "DEVELOPER"], "Forbidden");

    const trainerId = String(req.params.trainerId || "").trim();
    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    await ensureTrainerExists(trainerId);

    const delta = parseDelta(req.body.delta);
    const reason = parseOptionalReason(req.body.reason);

    const updated = await prisma.$transaction(async (tx) => {
      const wallet = await tx.trainerWallet.upsert({
        where: { trainerId },
        update: {},
        create: { trainerId, balance: "0.00" },
        select: {
          trainerId: true,
          balance: true,
        },
      });

      const nextBalance = Number((Number(wallet.balance) + delta).toFixed(2));
      if (nextBalance < 0) {
        throw new AppError("Resulting wallet balance cannot be negative", 400);
      }

      const adjusted = await tx.trainerWallet.update({
        where: { trainerId },
        data: {
          balance: nextBalance.toFixed(2),
        },
        select: WALLET_SELECT,
      });

      await tx.activityLog.create({
        data: {
          userId: access.userId,
          action: "TRAINER_WALLET_ADJUSTED",
          metadata: {
            trainerId,
            delta,
            reason,
            previousBalance: wallet.balance,
            nextBalance,
          },
        },
      });

      return adjusted;
    });

    return res.status(200).json({
      success: true,
      data: toWalletResponse(updated),
    });
  } catch (error) {
    return next(error);
  }
};
