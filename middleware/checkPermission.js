import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getUserId = (req) => {
  return req.user?.id || req.user?.userId || req.user?.sub || null;
};

const getBranchId = (req) => {
  return (
    req.params?.branchId || req.body?.branchId || req.query?.branchId || null
  );
};

const hasBypassRole = (roles = []) => {
  return roles.includes("OWNER") || roles.includes("DEVELOPER");
};

export const checkPermission = (required, requireBranchId = false) => {
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
      const rolePermissionKeys = new Set();

      for (const userRole of user.userRoles) {
        if (!userRole?.role) continue;
        roleNames.add(userRole.role.name);

        for (const rolePermission of userRole.role.rolePermissions) {
          if (rolePermission?.permission?.key) {
            rolePermissionKeys.add(rolePermission.permission.key);
          }
        }
      }

      const normalizedRoles = Array.from(roleNames);
      const isBypassUser = hasBypassRole(normalizedRoles);

      let branchId = null;
      if (requireBranchId) {
        branchId = getBranchId(req);
        if (!branchId) {
          return next(
            new AppError("branchId is required for this operation", 400),
          );
        }
      }

      req.user = {
        ...req.user,
        roleName: normalizedRoles[0] || req.user?.roleName || null,
        roles: normalizedRoles,
        permissions: Array.from(rolePermissionKeys),
        isAdmin: roleNames.has("ADMIN"),
      };

      if (isBypassUser) return next();

      const hasAll = requiredPermissions.every((permissionKey) =>
        rolePermissionKeys.has(permissionKey),
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
