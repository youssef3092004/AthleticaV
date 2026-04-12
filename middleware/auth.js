import jwt from "jsonwebtoken";
import process from "process";
import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import {
  buildRoleIdentityContext,
  normalizeRoleNames,
} from "../utils/authz.js";

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next(new AppError("Authorization header missing", 401));
    }
    if (!authHeader.startsWith("Bearer ")) {
      return next(new AppError("Authorization header malformed", 401));
    }
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return next(new AppError("No token provided", 401));
    }

    const exsistToken = await prisma.blacklistedToken.findUnique({
      where: { token },
    });
    if (exsistToken) {
      return next(new AppError("Authorization denied: Token is Expired", 401));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const roles = normalizeRoleNames(decoded.roles || []);
    const userId = decoded.id || decoded.userId || decoded.sub || null;

    req.user = {
      ...decoded,
      id: userId,
      userId,
      roles,
      roleName: decoded.roleName || roles[0] || null,
      ...buildRoleIdentityContext(userId, roles),
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token expired, please login again", 401));
    }
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token", 401));
    }
    next(err);
  }
};
