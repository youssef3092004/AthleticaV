import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ACTIVITY_LOG_SELECT = {
  id: true,
  userId: true,
  action: true,
  metadata: true,
  createdAt: true,
};

const parseAction = (value) => {
  const action = String(value || "").trim();
  if (!action) {
    throw new AppError("action is required", 400);
  }

  if (action.length > 120) {
    throw new AppError("action must be at most 120 characters", 400);
  }

  return action;
};

const parseMetadata = (value) => {
  if (value === undefined || value === null) return null;

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("metadata must be a JSON object", 400);
  }

  return value;
};

export const createActivityLogEntry = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["ADMIN", "OWNER", "DEVELOPER"], "Forbidden");

    const userId = String(req.body.userId || access.userId).trim();
    if (!userId) {
      return next(new AppError("userId is required", 400));
    }

    const action = parseAction(req.body.action);
    const metadata = parseMetadata(req.body.metadata);

    const created = await prisma.activityLog.create({
      data: {
        userId,
        action,
        metadata,
      },
      select: ACTIVITY_LOG_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    return next(error);
  }
};

export const listActivityLogs = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["CLIENT", "TRAINER", "ADMIN", "OWNER", "DEVELOPER", "SUPPORT"],
      "Forbidden",
    );

    const { page, limit, skip } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 30,
    });

    const where = {};
    const queryUserId = req.query.userId
      ? String(req.query.userId).trim()
      : null;

    if (access.isPrivileged || access.roles.includes("SUPPORT")) {
      where.userId = queryUserId || undefined;
    } else {
      where.userId = access.userId;
    }

    if (req.query.action) {
      where.action = {
        contains: String(req.query.action).trim(),
        mode: "insensitive",
      };
    }

    const [total, logs] = await prisma.$transaction([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: ACTIVITY_LOG_SELECT,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getActivityLogById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    const logId = String(req.params.logId || "").trim();
    if (!logId) {
      return next(new AppError("logId is required", 400));
    }

    const log = await prisma.activityLog.findUnique({
      where: { id: logId },
      select: ACTIVITY_LOG_SELECT,
    });

    if (!log) {
      return next(new AppError("Activity log not found", 404));
    }

    ensureSameUserOrPrivileged(access, log.userId, "Forbidden");

    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (error) {
    return next(error);
  }
};
