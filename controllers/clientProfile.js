/**
 * Client Profile Controller
 * Handles all CRUD operations for client health and fitness profiles
 */

import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { buildResourceTags, invalidateCacheByTags } from "../utils/cache.js";
import {
  validateClientProfileData,
  normalizeClientProfileData,
} from "../utils/clientProfileValidation.js";

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyProfile = (user) => {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const roleName = user?.roleName || "";
  return (
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN") ||
    roleName === "DEVELOPER" ||
    roleName === "ADMIN"
  );
};

/**
 * Create or update a client profile
 * Clients can only edit their own; trainers/admins can edit any
 */
export const upsertClientProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { age, heightCm, weightKg, fitnessGoal, medicalConditions } =
      req.body;

    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }

    const requesterId = getUserId(req);
    const isAdmin = canManageAnyProfile(req.user);
    const isOwnProfile = String(requesterId) === String(userId);

    if (!isAdmin && !isOwnProfile) {
      return next(
        new AppError("Forbidden: You can only edit your own profile", 403),
      );
    }

    // Validate user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // Validate input data
    const inputData = {
      age,
      heightCm,
      weightKg,
      fitnessGoal,
      medicalConditions,
    };

    const validation = validateClientProfileData(inputData);
    if (!validation.valid) {
      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(validation.errors)}`,
          400,
        ),
      );
    }

    // Normalize and sanitize
    const normalized = normalizeClientProfileData(inputData);

    // Upsert profile
    const profile = await prisma.clientProfile.upsert({
      where: { userId },
      update: normalized,
      create: {
        userId,
        ...normalized,
      },
    });

    invalidateCacheByTags(buildResourceTags("client_profiles", userId));

    return res.status(200).json({
      status: "success",
      message: "Profile saved successfully",
      data: profile,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get profile for a specific user
 */
export const getClientProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }

    const requesterId = getUserId(req);
    const isAdmin = canManageAnyProfile(req.user);
    const isOwnProfile = String(requesterId) === String(userId);

    if (!isAdmin && !isOwnProfile) {
      return next(
        new AppError("Forbidden: You can only view your own profile", 403),
      );
    }

    const profile = await prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return next(new AppError("Profile not found", 404));
    }

    return res.status(200).json({
      status: "success",
      data: profile,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get current authenticated user's own profile
 */
export const getMyClientProfile = async (req, res, next) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    const profile = await prisma.clientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            profileImage: true,
          },
        },
      },
    });

    if (!profile) {
      return res.status(200).json({
        status: "success",
        message: "Profile not yet created",
        data: null,
        source: "database",
      });
    }

    return res.status(200).json({
      status: "success",
      data: profile,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Delete a client profile (admin/developer only)
 */
export const deleteClientProfile = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return next(new AppError("User ID is required", 400));
    }

    if (!canManageAnyProfile(req.user)) {
      return next(
        new AppError("Forbidden: Only admins can delete profiles", 403),
      );
    }

    const existing = await prisma.clientProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      return next(new AppError("Profile not found", 404));
    }

    await prisma.clientProfile.delete({
      where: { userId },
    });

    invalidateCacheByTags(buildResourceTags("client_profiles", userId));

    return res.status(200).json({
      status: "success",
      message: "Profile deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get all client profiles (admin/developer only)
 * Supports pagination
 */
export const getAllClientProfiles = async (req, res, next) => {
  try {
    if (!canManageAnyProfile(req.user)) {
      return next(
        new AppError("Forbidden: Only admins can view all profiles", 403),
      );
    }

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    const [total, profiles] = await prisma.$transaction([
      prisma.clientProfile.count(),
      prisma.clientProfile.findMany({
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      }),
    ]);

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      data: profiles,
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

/**
 * Batch update profiles (admin/developer only)
 * Updates multiple profiles in one request
 */
export const batchUpdateClientProfiles = async (req, res, next) => {
  try {
    const { updates } = req.body; // [{userId, profileData}, ...]

    if (!Array.isArray(updates) || updates.length === 0) {
      return next(new AppError("Updates must be a non-empty array", 400));
    }

    if (!canManageAnyProfile(req.user)) {
      return next(
        new AppError("Forbidden: Only admins can batch update profiles", 403),
      );
    }

    const results = [];

    for (const { userId, ...profileData } of updates) {
      if (!userId) {
        results.push({
          userId,
          success: false,
          error: "userId is required",
        });
        continue;
      }

      const validation = validateClientProfileData(profileData);
      if (!validation.valid) {
        results.push({
          userId,
          success: false,
          error: validation.errors,
        });
        continue;
      }

      try {
        const normalized = normalizeClientProfileData(profileData);
        const updated = await prisma.clientProfile.upsert({
          where: { userId },
          update: normalized,
          create: { userId, ...normalized },
        });

        invalidateCacheByTags(buildResourceTags("client_profiles", userId));

        results.push({
          userId,
          success: true,
          data: updated,
        });
      } catch (error) {
        results.push({
          userId,
          success: false,
          error: error.message,
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Batch update completed",
      results,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
