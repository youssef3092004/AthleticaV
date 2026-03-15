import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";

const isDeveloper = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return roleName === "DEVELOPER" || roles.includes("DEVELOPER");
};

export const createRole = async (req, res, next) => {
  try {
    // if (req.user.roleName !== "DEVELOPER") {
    //   return next(
    //     new AppError("Forbidden: Only DEVELOPER can create roles", 403),
    //   );
    // }
    const { name } = req.body;
    if (!name) {
      return next(new AppError("Name is required", 400));
    }

    const existingRole = await prisma.role.findUnique({
      where: { name },
    });
    if (existingRole) {
      return next(new AppError("Role with this name already exists", 409));
    }
    const newRole = await prisma.role.create({
      data: {
        name,
      },
    });
    res.status(201).json({
      success: true,
      data: newRole,
    });
  } catch (error) {
    next(error);
  }
};

export const getRoles = async (req, res, next) => {
  try {
    if (!isDeveloper(req.user)) {
      return next(new AppError("Forbidden: Only DEVELOPER can get roles", 403));
    }
    const { page, limit, skip, sort, order } = pagination(req);
    const [roles, total] = await prisma.$transaction([
      prisma.role.findMany({
        skip,
        take: limit,
        orderBy: { [sort]: order },
      }),
      prisma.role.count(),
    ]);
    if (!roles.length) {
      return next(new AppError("No roles found", 404));
    }
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({
      success: true,
      data: roles,
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
    next(error);
  }
};

export const getRoleById = async (req, res, next) => {
  try {
    if (!isDeveloper(req.user)) {
      return next(
        new AppError("Forbidden: Only DEVELOPER can get roles by ID", 403),
      );
    }
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Role ID is required", 400));
    }
    const role = await prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      return next(new AppError("Role not found", 404));
    }
    res.status(200).json({
      success: true,
      data: role,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteRoleById = async (req, res, next) => {
  try {
    if (!isDeveloper(req.user)) {
      return next(
        new AppError("Forbidden: Only DEVELOPER can delete roles", 403),
      );
    }
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Role ID is required", 400));
    }
    const userRoleLinks = await prisma.userRole.count({
      where: { roleId: id },
    });

    if (userRoleLinks > 0) {
      return next(
        new AppError(
          "Cannot delete role while it is assigned to users. Remove role assignments first.",
          409,
        ),
      );
    }

    const role = await prisma.role.delete({
      where: { id },
    });
    if (!role) {
      return next(new AppError("Role not found", 404));
    }
    res.status(200).json({
      success: true,
      message: "Role deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    if (!isDeveloper(req.user)) {
      return next(
        new AppError("Forbidden: Only DEVELOPER can update roles", 403),
      );
    }
    const { id } = req.params;
    if (!id) {
      return next(new AppError("Role ID is required", 400));
    }
    const { name } = req.body;
    if (!name) {
      return next(new AppError("Name is required to update role", 400));
    }
    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name,
      },
    });
    res.status(200).json({
      success: true,
      data: updatedRole,
    });
  } catch (error) {
    next(error);
  }
};
