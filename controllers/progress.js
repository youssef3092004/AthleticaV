import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_METRICS = ["WEIGHT", "BODY_FAT", "MUSCLE"];
const ALLOWED_SORT_FIELDS = ["recordedAt", "createdAt", "id", "value"];

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const parseNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }
  return parsed;
};

const normalizeMetric = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!ALLOWED_METRICS.includes(normalized)) {
    throw new AppError("Invalid metric", 400);
  }

  return normalized;
};

const ensureClientBelongsToTrainerIfNeeded = async (access, userId) => {
  if (access.isPrivileged) return;

  const isSelf = String(access.userId) === String(userId);
  if (isSelf) return;

  ensureHasAnyRole(access, ["TRAINER"], "Forbidden");

  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: access.userId,
        clientId: userId,
      },
    },
    select: {
      status: true,
    },
  });

  if (!relation || relation.status !== "ACTIVE") {
    throw new AppError(
      "Forbidden: client is not assigned to this trainer",
      403,
    );
  }
};

export const createProgressMetric = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["CLIENT", "TRAINER"], "Forbidden");

    const userId = String(req.body.userId || access.userId).trim();
    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    await ensureClientBelongsToTrainerIfNeeded(access, userId);

    const metric = normalizeMetric(req.body.metric);
    const value = parseNumber(req.body.value, "value");
    const recordedAt = parseDateOnly(req.body.recordedAt, "recordedAt");

    const created = await prisma.progressMetric.create({
      data: {
        userId,
        metric,
        value,
        recordedAt,
      },
      select: {
        id: true,
        userId: true,
        metric: true,
        value: true,
        recordedAt: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    return next(error);
  }
};

export const getProgressMetrics = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "recordedAt",
      defaultOrder: "desc",
      defaultLimit: 30,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const userId = req.query.userId
      ? String(req.query.userId).trim()
      : access.userId;
    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    if (!access.isPrivileged) {
      const isSelf = String(access.userId) === String(userId);
      if (!isSelf) {
        ensureHasAnyRole(access, ["TRAINER"], "Forbidden");
        await ensureClientBelongsToTrainerIfNeeded(access, userId);
      } else {
        ensureSameUserOrPrivileged(access, userId);
      }
    }

    const where = {
      userId,
    };

    if (req.query.metric !== undefined) {
      where.metric = normalizeMetric(req.query.metric);
    }

    if (req.query.recordedAtFrom || req.query.recordedAtTo) {
      where.recordedAt = {};

      if (req.query.recordedAtFrom) {
        where.recordedAt.gte = parseDateOnly(
          req.query.recordedAtFrom,
          "recordedAtFrom",
        );
      }

      if (req.query.recordedAtTo) {
        where.recordedAt.lte = parseDateOnly(
          req.query.recordedAtTo,
          "recordedAtTo",
        );
      }
    }

    const [total, metrics] = await prisma.$transaction([
      prisma.progressMetric.count({ where }),
      prisma.progressMetric.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          userId: true,
          metric: true,
          value: true,
          recordedAt: true,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: metrics,
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
