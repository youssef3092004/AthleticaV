import { checkOwnership } from "./checkOwnership.js";
import { checkPermission } from "./checkPermission.js";
import { getResourceConfig } from "../configs/resources.js";
import { AppError } from "../utils/appError.js";

export const authorizeResource = (action, options = {}) => {
  const { enforceOwnership = false } = options;

  return async (req, res, next) => {
    try {
      const resourceName = req.params.resource;
      const resource = getResourceConfig(resourceName);

      if (!resource) {
        return next(new AppError(`Unknown resource: ${resourceName}`, 404));
      }

      const actionPermissions = resource.permissions?.[action] || [];
      await checkPermission(actionPermissions)(
        req,
        res,
        async (permissionErr) => {
          if (permissionErr) {
            return next(permissionErr);
          }

          if (!enforceOwnership) {
            return next();
          }

          return checkOwnership(resource)(req, res, next);
        },
      );
    } catch (error) {
      return next(error);
    }
  };
};
