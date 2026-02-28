import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";

const getUserId = (req) =>
  req.user?.id || req.user?.userId || req.user?.sub || null;

const parseWhere = (input) => {
  if (!input) return null;
  if (typeof input === "object") return input;

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

const pickOwnershipWhere = (req, resource) => {
  if (resource.idField && req.params.id) {
    return { [resource.idField]: req.params.id };
  }

  const where = req.body?.where || parseWhere(req.query?.where);
  if (where && typeof where === "object") {
    return where;
  }

  return null;
};

export const checkOwnership = (resource) => {
  return async (req, res, next) => {
    try {
      const ownerFields = resource.ownerFields || [];
      if (ownerFields.length === 0) return next();
      if (req.user?.isAdmin) return next();

      const userId = getUserId(req);
      if (!userId) {
        return next(new AppError("Unauthorized: missing user context", 401));
      }

      const where = pickOwnershipWhere(req, resource);
      if (!where) {
        return next(
          new AppError("Missing resource identifier for ownership check", 400),
        );
      }

      const record = await prisma[resource.model].findFirst({ where });
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
