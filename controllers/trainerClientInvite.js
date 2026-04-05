import process from "process";
import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";

const INVITE_CODE_PREFIX = "ATHLI";
const INVITE_SEQUENCE_START = 100;
const TRAINER_NAME_CODE_MAX_LENGTH = 20;

const ALLOWED_STATUSES = new Set([
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "CANCELLED",
]);
const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "status",
  "clientPhone",
]);

const INVITE_BASE_SELECT = {
  id: true,
  trainerId: true,
  inviteCodeId: true,
  usedByClientId: true,
  clientName: true,
  clientPhone: true,
  clientEmail: true,
  status: true,
  usedAt: true,
  createdAt: true,
  updatedAt: true,
};

const INVITE_SELECT = {
  ...INVITE_BASE_SELECT,
  inviteCode: {
    select: {
      code: true,
      totalClients: true,
    },
  },
};

const INVITE_CODE_SELECT = {
  id: true,
  trainerId: true,
  code: true,
  totalClients: true,
};

const toInviteResponse = (invite) => {
  if (!invite) return invite;

  const { inviteCode, ...rest } = invite;
  return {
    ...rest,
    code: inviteCode?.code || null,
    totalClients: inviteCode?.totalClients ?? 0,
  };
};

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const getRoleNames = (req) => {
  const fromRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const fromRoleName = req.user?.roleName ? [req.user.roleName] : [];

  return [...fromRoles, ...fromRoleName]
    .filter(Boolean)
    .map((name) => String(name).toUpperCase());
};

const isPrivileged = (req) => {
  const roles = new Set(getRoleNames(req));
  return roles.has("OWNER") || roles.has("DEVELOPER") || roles.has("ADMIN");
};

const ensureRequesterIsTrainerOrPrivileged = (req, trainerId) => {
  if (isPrivileged(req)) return;

  const requesterId = getUserId(req);
  if (!requesterId) {
    throw new AppError("Unauthorized", 401);
  }

  const roles = new Set(getRoleNames(req));
  if (!roles.has("TRAINER")) {
    throw new AppError("Forbidden: trainer role required", 403);
  }

  if (String(requesterId) !== String(trainerId)) {
    throw new AppError(
      "Forbidden: trainerId must match authenticated trainer",
      403,
    );
  }
};

const normalizeInviteCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

const normalizeCodeToken = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, TRAINER_NAME_CODE_MAX_LENGTH);

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeInviteStatus = (value) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!ALLOWED_STATUSES.has(normalized)) {
    throw new AppError("Invalid invite status", 400);
  }

  return normalized;
};

const ensureUserExists = async (id, label) => {
  const found = await prisma.user.findUnique({
    where: { id: String(id) },
    select: { id: true },
  });

  if (!found) {
    throw new AppError(`${label} not found`, 404);
  }
};

const getTrainerFirstNameToken = async (trainerId) => {
  const trainer = await prisma.user.findUnique({
    where: { id: String(trainerId) },
    select: {
      name: true,
    },
  });

  if (!trainer) {
    throw new AppError("Trainer user not found", 404);
  }

  const firstName = String(trainer.name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];

  return normalizeCodeToken(firstName) || "TRAINER";
};

const extractCodeSequence = (code, prefix) => {
  const matcher = new RegExp(`^${escapeRegExp(prefix)}(\\d+)$`);
  const match = String(code || "").match(matcher);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
};

const createFormattedInviteCode = async (trainerId) => {
  const firstNameToken = await getTrainerFirstNameToken(trainerId);
  const prefix = `${INVITE_CODE_PREFIX}${firstNameToken}`;

  const recentCodes = await prisma.trainerInviteCode.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    select: {
      code: true,
    },
  });

  let maxSequence = INVITE_SEQUENCE_START - 1;
  for (const entry of recentCodes) {
    const sequence = extractCodeSequence(entry.code, prefix);
    if (sequence !== null && sequence > maxSequence) {
      maxSequence = sequence;
    }
  }

  const nextSequence = Math.max(maxSequence + 1, INVITE_SEQUENCE_START);
  return `${prefix}${nextSequence}`;
};

const getInviteCodeByTrainerId = (trainerId) =>
  prisma.trainerInviteCode.findUnique({
    where: { trainerId: String(trainerId) },
    select: {
      id: true,
      trainerId: true,
      code: true,
      totalClients: true,
    },
  });

const createTrainerInviteCode = async (trainerId) => {
  const normalizedTrainerId = String(trainerId);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = await createFormattedInviteCode(normalizedTrainerId);

    try {
      const totalClients = await prisma.trainerClient.count({
        where: { trainerId: normalizedTrainerId },
      });

      return await prisma.trainerInviteCode.create({
        data: {
          trainerId: normalizedTrainerId,
          code,
          totalClients,
        },
        select: {
          id: true,
          trainerId: true,
          code: true,
          totalClients: true,
        },
      });
    } catch (error) {
      if (error?.code !== "P2002") {
        throw error;
      }

      const existingByTrainer =
        await getInviteCodeByTrainerId(normalizedTrainerId);
      if (existingByTrainer) {
        return existingByTrainer;
      }

      if (attempt === 9) {
        throw new AppError("Failed to generate unique invite code", 500);
      }
    }
  }

  throw new AppError("Failed to create invite code", 500);
};

const buildInviteLink = (code) => {
  const baseUrl =
    process.env.CLIENT_INVITE_LINK_BASE_URL ||
    process.env.CLIENT_APP_REGISTER_URL ||
    process.env.CLIENT_APP_URL ||
    (String(process.env.NODE_ENV).toLowerCase() !== "production"
      ? "http://localhost:5173/auth/register/client"
      : "https://athletica-six.vercel.app/api/v1/auth/register/client");

  if (!baseUrl) return null;

  const joiner = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${joiner}code=${encodeURIComponent(code)}`;
};

export const createTrainerClientInvite = async (req, res, next) => {
  try {
    const requesterId = getUserId(req);
    if (!requesterId) {
      return next(new AppError("Unauthorized", 401));
    }

    const trainerId = String(req.user?.trainerId || requesterId).trim();
    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    ensureRequesterIsTrainerOrPrivileged(req, trainerId);

    await ensureUserExists(trainerId, "Trainer user");

    let inviteCode = await getInviteCodeByTrainerId(trainerId);
    const reusedExistingCode = Boolean(inviteCode);

    if (!inviteCode) {
      inviteCode = await createTrainerInviteCode(trainerId);
    }

    return res.status(reusedExistingCode ? 200 : 201).json({
      success: true,
      data: {
        ...inviteCode,
        inviteLink: buildInviteLink(inviteCode.code),
      },
      ...(reusedExistingCode
        ? {
            meta: {
              reusedExistingCode: true,
            },
          }
        : {}),
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerClientInvites = async (req, res, next) => {
  try {
    const requesterId = getUserId(req);
    if (!requesterId) {
      return next(new AppError("Unauthorized", 401));
    }

    const trainerId = String(req.query.trainerId || requesterId).trim();
    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    ensureRequesterIsTrainerOrPrivileged(req, trainerId);

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.has(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const status = normalizeInviteStatus(req.query.status);
    const where = {
      trainerId,
    };

    if (status) {
      where.status = status;
    }

    if (req.query.clientPhone) {
      where.clientPhone = String(req.query.clientPhone).trim();
    }

    const [total, invites] = await prisma.$transaction([
      prisma.trainerClientInvite.count({ where }),
      prisma.trainerClientInvite.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: INVITE_SELECT,
      }),
    ]);

    const inviteResponses = invites.map(toInviteResponse);

    return res.status(200).json({
      success: true,
      data: inviteResponses,
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

export const verifyTrainerClientInvite = async (req, res, next) => {
  try {
    const code = normalizeInviteCode(req.params.code || req.query.code);
    if (!code) {
      return next(new AppError("Invite code is required", 400));
    }

    const inviteCode = await prisma.trainerInviteCode.findUnique({
      where: { code },
      select: INVITE_CODE_SELECT,
    });

    if (!inviteCode) {
      return next(new AppError("Invalid invite code", 404));
    }

    return res.status(200).json({
      success: true,
      data: {
        trainerId: inviteCode.trainerId,
        code: inviteCode.code,
        totalClients: inviteCode.totalClients,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const approveTrainerClientInviteByClientId = async (req, res, next) => {
  try {
    const requesterId = getUserId(req);
    if (!requesterId) {
      return next(new AppError("Unauthorized", 401));
    }

    const trainerId = String(req.user?.trainerId || requesterId).trim();
    const clientId = String(
      req.params.clientId || req.body.clientId || "",
    ).trim();

    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    if (!clientId) {
      return next(new AppError("clientId is required", 400));
    }

    ensureRequesterIsTrainerOrPrivileged(req, trainerId);

    const approval = await prisma.$transaction(async (tx) => {
      const pendingInvite = await tx.trainerClientInvite.findFirst({
        where: {
          trainerId,
          usedByClientId: clientId,
          status: "PENDING",
        },
        select: {
          id: true,
          trainerId: true,
          inviteCodeId: true,
          usedByClientId: true,
          clientName: true,
          clientPhone: true,
          clientEmail: true,
          status: true,
          usedAt: true,
        },
      });

      if (!pendingInvite) {
        throw new AppError("Pending invite not found for this client", 404);
      }

      const client = await tx.user.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, phone: true, email: true },
      });

      if (!client) {
        throw new AppError("Client user not found", 404);
      }

      const trainerClient = await tx.trainerClient.upsert({
        where: {
          trainerId_clientId: {
            trainerId,
            clientId,
          },
        },
        update: {
          status: "PAUSED",
          startedAt: new Date(),
        },
        create: {
          trainerId,
          clientId,
          status: "PAUSED",
          startedAt: new Date(),
        },
        select: {
          id: true,
          trainerId: true,
          clientId: true,
          status: true,
          startedAt: true,
        },
      });

      const totalClients = await tx.trainerClient.count({
        where: { trainerId },
      });

      await tx.trainerInviteCode.update({
        where: { id: pendingInvite.inviteCodeId },
        data: { totalClients },
        select: { id: true },
      });

      const updatedInvite = await tx.trainerClientInvite.update({
        where: { id: pendingInvite.id },
        data: {
          status: "ACCEPTED",
          usedAt: new Date(),
          clientName: pendingInvite.clientName || client.name,
          clientPhone: pendingInvite.clientPhone || client.phone,
          clientEmail: pendingInvite.clientEmail || client.email,
        },
        select: INVITE_SELECT,
      });

      return {
        invite: toInviteResponse(updatedInvite),
        totalClients,
        trainerClient,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Client approved successfully",
      data: approval,
    });
  } catch (error) {
    return next(error);
  }
};
