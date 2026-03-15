import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import bcrypt from "bcrypt";

const READONLY_FIELDS = new Set(["id", "createdAt", "updatedAt", "isVerified"]);

export const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId || String(userId).trim() === "" || userId === "undefined") {
      return next(new AppError("User ID is required", 400));
    }

    const userexists = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!userexists || userexists.id !== userId) {
      return next(new AppError("User not found", 404));
    }

    const data = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (!READONLY_FIELDS.has(key) && value !== undefined) {
        data[key] = value;
      }
    }

    if (Object.keys(data).length === 0) {
      return next(new AppError("No updatable fields provided", 400));
    }

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profileImage: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await prisma.user.delete({
      where: { id: userId },
    });

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
