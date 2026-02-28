import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { buildResourceTags, invalidateCacheByTags } from "../utils/cache.js";

const canManagePermissions = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return (
    roleName === "DEVELOPER" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const resolvePermissionKey = (body = {}) => {
  const raw = body.key ?? body.name;
  if (!raw || typeof raw !== "string") return null;
  return raw.trim();
};

export const createPermission = async (req, res, next) => {
  try {
    if (!canManagePermissions(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can create permissions",
          403,
        ),
      );
    }

    const key = resolvePermissionKey(req.body);
    if (!key) {
      return next(new AppError("Permission key (or name) is required", 400));
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { key },
    });

    if (existingPermission) {
      return next(new AppError("Permission with this key already exists", 400));
    }

    const newPermission = await prisma.permission.create({
      data: { key },
    });

    invalidateCacheByTags(buildResourceTags("permissions"));

    return res.status(201).json({
      status: "success",
      data: newPermission,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getPermissionById = async (req, res, next) => {
  try {
    if (!canManagePermissions(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can get permissions",
          403,
        ),
      );
    }

    const { id } = req.params;
    if (!id) {
      return next(new AppError("Permission ID is required", 400));
    }

    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      return next(new AppError("Permission not found", 404));
    }

    return res.status(200).json({
      status: "success",
      data: permission,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllPermissions = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "key",
      defaultOrder: "asc",
      defaultLimit: 20,
    });

    const [total, permissions] = await prisma.$transaction([
      prisma.permission.count(),
      prisma.permission.findMany({
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
      data: permissions,
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

export const updatePermissionById = async (req, res, next) => {
  try {
    if (!canManagePermissions(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can update permissions",
          403,
        ),
      );
    }

    const { id } = req.params;
    if (!id) {
      return next(new AppError("Permission ID is required", 400));
    }

    const key = resolvePermissionKey(req.body);
    if (!key) {
      return next(new AppError("Permission key (or name) is required", 400));
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { id },
    });
    if (!existingPermission) {
      return next(new AppError("Permission not found", 404));
    }

    const duplicated = await prisma.permission.findFirst({
      where: {
        key,
        id: { not: id },
      },
    });

    if (duplicated) {
      return next(new AppError("Permission with this key already exists", 400));
    }

    const updatedPermission = await prisma.permission.update({
      where: { id },
      data: { key },
    });

    invalidateCacheByTags(buildResourceTags("permissions", id));

    return res.status(200).json({
      status: "success",
      data: updatedPermission,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deletePermissionById = async (req, res, next) => {
  try {
    if (!canManagePermissions(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete permissions",
          403,
        ),
      );
    }

    const { id } = req.params;
    if (!id) {
      return next(new AppError("Permission ID is required", 400));
    }

    const existingPermission = await prisma.permission.findUnique({
      where: { id },
    });
    if (!existingPermission) {
      return next(new AppError("Permission not found", 404));
    }

    await prisma.permission.delete({
      where: { id },
    });

    invalidateCacheByTags(buildResourceTags("permissions", id));

    return res.status(200).json({
      status: "success",
      message: "Permission deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllPermissions = async (req, res, next) => {
  try {
    if (!canManagePermissions(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete permissions",
          403,
        ),
      );
    }

    const result = await prisma.permission.deleteMany({});
    invalidateCacheByTags(buildResourceTags("permissions"));

    return res.status(200).json({
      status: "success",
      message: "All permissions deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
