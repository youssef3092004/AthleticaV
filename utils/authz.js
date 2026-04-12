import { prisma } from "../configs/db.js";
import { AppError } from "./appError.js";

const PRIVILEGED_ROLES = new Set(["OWNER", "DEVELOPER", "ADMIN"]);
const ROLE_ID_FIELDS = {
  OWNER: "ownerId",
  DEVELOPER: "developerId",
  ADMIN: "adminId",
  TRAINER: "trainerId",
  CLIENT: "clientId",
  SUPPORT: "supportId",
};

export const normalizeRoleNames = (roles = []) => {
  return [
    ...new Set(roles.filter(Boolean).map((role) => String(role).toUpperCase())),
  ];
};

export const buildRoleIdentityContext = (userId, roles = []) => {
  const normalizedRoles = normalizeRoleNames(roles);
  const identity = {
    userId,
    primaryRole: normalizedRoles[0] || null,
  };

  for (const [roleName, fieldName] of Object.entries(ROLE_ID_FIELDS)) {
    identity[fieldName] = normalizedRoles.includes(roleName) ? userId : null;
  }

  return identity;
};

export const getUserIdFromRequest = (req) =>
  req.user?.id || req.user?.userId || req.user?.sub || null;

export const getUserAccessContext = async (req) => {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    throw new AppError("Unauthorized", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    throw new AppError("Unauthorized: user not found", 401);
  }

  const roles = user.userRoles
    .map((entry) => entry.role?.name)
    .filter(Boolean)
    .map((name) => String(name).toUpperCase());
  const identity = buildRoleIdentityContext(userId, roles);

  return {
    userId,
    roles,
    ...identity,
    isPrivileged: roles.some((role) => PRIVILEGED_ROLES.has(role)),
  };
};

export const ensureHasAnyRole = (ctx, allowedRoles, message = "Forbidden") => {
  if (ctx.isPrivileged) return;

  const allowed = new Set(
    allowedRoles.map((role) => String(role).toUpperCase()),
  );
  const hasAllowedRole = ctx.roles.some((role) => allowed.has(role));
  if (!hasAllowedRole) {
    throw new AppError(message, 403);
  }
};

export const ensureSameUserOrPrivileged = (
  ctx,
  targetUserId,
  message = "Forbidden",
) => {
  if (ctx.isPrivileged) return;
  if (String(ctx.userId) !== String(targetUserId)) {
    throw new AppError(message, 403);
  }
};
