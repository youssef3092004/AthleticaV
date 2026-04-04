import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { buildResourceTags, invalidateCacheByTags } from "../utils/cache.js";

const ALLOWED_STATUS = ["ACTIVE", "PAUSED", "ENDED"];

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyTrainerClient = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const normalizeStatus = (status) => {
  if (status === undefined || status === null) return undefined;
  return String(status).trim().toUpperCase();
};

const ensureUserExists = async (id, label) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!user) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureOwnOrPrivileged = (req, trainerId, clientId) => {
  if (canManageAnyTrainerClient(req.user)) return true;

  const requesterId = getUserId(req);
  return (
    requesterId &&
    (String(requesterId) === String(trainerId) ||
      String(requesterId) === String(clientId))
  );
};

export const createTrainerClient = async (req, res, next) => {
  try {
    const { trainerId, clientId, status, startedAt, monthlyPrice, notes } =
      req.body;

    if (!trainerId || !clientId) {
      return next(new AppError("Trainer ID and client ID are required", 400));
    }

    if (!ensureOwnOrPrivileged(req, trainerId, clientId)) {
      return next(
        new AppError(
          "Forbidden: You can only create your own trainer-client link",
          403,
        ),
      );
    }

    await ensureUserExists(trainerId, "Trainer user");
    await ensureUserExists(clientId, "Client user");

    const normalizedStatus = normalizeStatus(status) || "ACTIVE";
    if (!ALLOWED_STATUS.includes(normalizedStatus)) {
      return next(new AppError("Invalid status value", 400));
    }

    const existing = await prisma.trainerClient.findUnique({
      where: {
        trainerId_clientId: {
          trainerId,
          clientId,
        },
      },
    });

    if (existing) {
      return next(new AppError("Trainer-client relation already exists", 409));
    }

    const relation = await prisma.trainerClient.create({
      data: {
        trainerId,
        clientId,
        status: normalizedStatus,
        monthlyPrice:
          monthlyPrice === undefined || monthlyPrice === null
            ? null
            : Number(monthlyPrice),
        notes:
          notes === undefined || notes === null || String(notes).trim() === ""
            ? null
            : String(notes).trim(),
        startedAt: startedAt ? new Date(startedAt) : new Date(),
      },
    });

    invalidateCacheByTags(buildResourceTags("trainer_clients", relation.id));

    return res.status(201).json({
      status: "success",
      data: relation,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerClientById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Trainer-client relation ID is required", 400));
    }

    const relation = await prisma.trainerClient.findUnique({
      where: { id },
    });

    if (!relation) {
      return next(new AppError("Trainer-client relation not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, relation.trainerId, relation.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    return res.status(200).json({
      status: "success",
      data: relation,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllTrainerClients = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "startedAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const requesterId = getUserId(req);
    const where = canManageAnyTrainerClient(req.user)
      ? {}
      : {
          OR: [{ trainerId: requesterId }, { clientId: requesterId }],
        };

    const [total, relations] = await prisma.$transaction([
      prisma.trainerClient.count({ where }),
      prisma.trainerClient.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      data: relations,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
export const getAllTrainerClientsByTrainerId = async (req, res, next) => {
  try {
    const { trainerId } = req.params;
    if (!trainerId) {
      return next(new AppError("Trainer ID is required", 400));
    }
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "startedAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const requesterId = getUserId(req);
    const where = canManageAnyTrainerClient(req.user)
      ? { trainerId }
      : {
          AND: [{ trainerId: requesterId }, { clientId: requesterId }],
        };

    const [total, relations] = await prisma.$transaction([
      prisma.trainerClient.count({ where }),
      prisma.trainerClient.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      data: relations,
      meta: {
        page,
        limit,
        total,
        totalPages,
        sort,
        order,
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

const updateTrainerClientStatus = async (req, res, next, nextStatus) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Trainer-client relation ID is required", 400));
    }

    const existing = await prisma.trainerClient.findUnique({
      where: { id },
    });

    if (!existing) {
      return next(new AppError("Trainer-client relation not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId, existing.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    if (!ALLOWED_STATUS.includes(nextStatus)) {
      return next(new AppError("Invalid status value", 400));
    }

    if (existing.status === nextStatus) {
      return res.status(200).json({
        status: "success",
        data: existing,
        source: "database",
      });
    }

    const updated = await prisma.trainerClient.update({
      where: { id },
      data: { status: nextStatus },
    });

    invalidateCacheByTags(buildResourceTags("trainer_clients", id));

    return res.status(200).json({
      status: "success",
      data: updated,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const updateStatusToPaused = async (req, res, next) => {
  return updateTrainerClientStatus(req, res, next, "PAUSED");
};

export const updateStatusToEnded = async (req, res, next) => {
  return updateTrainerClientStatus(req, res, next, "ENDED");
};

export const updateStatusToActive = async (req, res, next) => {
  return updateTrainerClientStatus(req, res, next, "ACTIVE");
};

export const deleteTrainerClientById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Trainer-client relation ID is required", 400));
    }

    const existing = await prisma.trainerClient.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError("Trainer-client relation not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId, existing.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.trainerClient.delete({ where: { id } });

    invalidateCacheByTags(buildResourceTags("trainer_clients", id));

    return res.status(200).json({
      status: "success",
      message: "Trainer-client relation deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllTrainerClients = async (req, res, next) => {
  try {
    if (!canManageAnyTrainerClient(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete all trainer-client relations",
          403,
        ),
      );
    }

    const result = await prisma.trainerClient.deleteMany({});

    invalidateCacheByTags(buildResourceTags("trainer_clients"));

    return res.status(200).json({
      status: "success",
      message: "All trainer-client relations deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
