import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";

const getUserId = (req) =>
  req.user?.id || req.user?.userId || req.user?.sub || null;

const getUserRoles = (req) => {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  if (req.user?.roleName && !roles.includes(req.user.roleName)) {
    roles.push(req.user.roleName);
  }
  return roles;
};

const pickTargetId = (req, paramKey) => {
  return (
    req.params?.[paramKey] ||
    req.body?.[paramKey] ||
    req.query?.[paramKey] ||
    null
  );
};

export const checkOwnership = (config = {}) => {
  const {
    model,
    idField = "id",
    ownerFields = [],
    paramKey = "id",
    allowRoles = ["OWNER", "DEVELOPER", "ADMIN"],
  } = config;

  return async (req, res, next) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return next(new AppError("Unauthorized: missing user context", 401));
      }

      const userRoles = getUserRoles(req);
      if (allowRoles.some((role) => userRoles.includes(role))) {
        return next();
      }

      const targetId = pickTargetId(req, paramKey);
      if (!targetId) {
        return next(
          new AppError(`Missing '${paramKey}' for ownership check`, 400),
        );
      }

      // Direct ownership check (e.g. userId in route equals requester id)
      if (!model) {
        if (String(targetId) !== String(userId)) {
          return next(
            new AppError("Forbidden: ownership validation failed", 403),
          );
        }
        return next();
      }

      if (ownerFields.length === 0) {
        return next();
      }

      const record = await prisma[model].findUnique({
        where: { [idField]: targetId },
      });

      if (!record) {
        return next(new AppError("Resource not found", 404));
      }

      const isOwner = ownerFields.some((field) => {
        return record[field] && String(record[field]) === String(userId);
      });

      if (!isOwner) {
        return next(
          new AppError("Forbidden: ownership validation failed", 403),
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
