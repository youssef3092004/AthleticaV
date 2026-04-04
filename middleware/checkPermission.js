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

const toDateOnly = (value) => {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
};

const createCodedForbiddenError = (message, code) => {
  const err = new AppError(message, 403);
  err.code = code;
  return err;
};

const getCurrentTrainerSubscription = (subscriptions) => {
  if (!subscriptions) {
    return null;
  }

  const subscriptionList = Array.isArray(subscriptions)
    ? subscriptions
    : [subscriptions];

  return (
    subscriptionList.find(
      (subscription) => subscription?.status === "ACTIVE",
    ) ||
    subscriptionList.find((subscription) => subscription?.status === "TRIAL") ||
    subscriptionList[0] ||
    null
  );
};

const ensureTrainerSubscriptionIsActive = (subscriptions) => {
  const subscription = getCurrentTrainerSubscription(subscriptions);

  if (!subscription) {
    throw createCodedForbiddenError(
      "No subscription found for trainer",
      "SUBSCRIPTION_REQUIRED",
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (subscription.status === "TRIAL") {
    const trialEnd = toDateOnly(subscription.trialEnd);
    if (trialEnd && today > trialEnd) {
      throw createCodedForbiddenError("Trial expired", "TRIAL_EXPIRED");
    }
    return;
  }

  if (subscription.status === "ACTIVE") {
    const endDate = toDateOnly(subscription.endDate);
    if (endDate && today > endDate) {
      throw createCodedForbiddenError(
        "Subscription period ended",
        "SUBSCRIPTION_EXPIRED",
      );
    }
    return;
  }

  throw createCodedForbiddenError(
    "Subscription is inactive",
    "SUBSCRIPTION_INACTIVE",
  );
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
          subscriptions: {
            select: {
              status: true,
              trialEnd: true,
              endDate: true,
              createdAt: true,
            },
          },
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
      const isTrainer = normalizedRoles.includes("TRAINER");
      const isAdmin = normalizedRoles.includes("ADMIN");

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
        isAdmin,
      };

      if (isTrainer && !isBypassUser && !isAdmin) {
        ensureTrainerSubscriptionIsActive(user.subscriptions);
      }

      if (isBypassUser) return next();

      const hasAll = requiredPermissions.every((permissionKey) =>
        rolePermissionKeys.has(permissionKey),
      );

      if (!hasAll) {
        return next(
          new AppError(
            "Forbidden: You don't have permission to perform this action",
            403,
          ),
        );
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
};
