import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getUserId = (req) => {
  return req.user?.id || req.user?.userId || req.user?.sub || null;
};

export const checkPermission = (required) => {
  const requiredPermissions = toArray(required);

  return async (req, res, next) => {
    try {
      if (requiredPermissions.length === 0) return next();

      const userId = getUserId(req);
      if (!userId) {
        const err = new Error("Unauthorized: missing user context");
        err.statusCode = 401;
        return next(err);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                  rolePermissions: {
                    select: {
                      permission: {
                        select: { key: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return next(new AppError("Unauthorized: user not found", 401));
      }

      const roleNames = new Set();
      const permissionKeys = new Set();

      for (const userRole of user.userRoles) {
        if (!userRole?.role) continue;
        roleNames.add(userRole.role.name);

        for (const rolePermission of userRole.role.rolePermissions) {
          if (rolePermission?.permission?.key) {
            permissionKeys.add(rolePermission.permission.key);
          }
        }
      }

      req.user = {
        ...req.user,
        roles: Array.from(roleNames),
        permissions: Array.from(permissionKeys),
        isAdmin: roleNames.has("ADMIN"),
      };

      if (req.user.isAdmin) return next();

      const hasAll = requiredPermissions.every((permission) =>
        permissionKeys.has(permission),
      );

      if (!hasAll) {
        return next(new AppError("Forbidden: insufficient permissions", 403));
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
