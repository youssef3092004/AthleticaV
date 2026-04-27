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

const toNullableInput = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
};

const buildProfileInput = (payload = {}) => {
  const input = {};

  if (Object.prototype.hasOwnProperty.call(payload, "age")) {
    input.age = toNullableInput(payload.age);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "heightCm")) {
    input.heightCm = toNullableInput(payload.heightCm);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "weightKg")) {
    input.weightKg = toNullableInput(payload.weightKg);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "fitnessGoal")) {
    input.fitnessGoal = toNullableInput(payload.fitnessGoal);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "medicalConditions")) {
    input.medicalConditions = toNullableInput(payload.medicalConditions);
  }

  return input;
};

/**
 * Create or update a client profile
 * Clients can only edit their own; trainers/admins can edit any
 */
export const upsertClientProfile = async (req, res, next) => {
  try {
    const { userId: clientId } = req.params;

    if (!clientId) {
      throw new AppError("User ID is required", 400);
    }

    const requesterId = getUserId(req);
    const isAdmin = canManageAnyProfile(req.user);
    const isOwnProfile = String(requesterId) === String(clientId);

    if (!isAdmin && !isOwnProfile) {
      throw new AppError("Forbidden: You can only edit your own profile", 403);
    }

    const profile = await prisma.$transaction(async (tx) => {
      // ✅ Ensure user exists
      const user = await tx.user.findUnique({
        where: { id: clientId },
        select: { id: true },
      });

      if (!user) {
        throw new AppError("User not found", 404);
      }

      // ✅ Extract only allowed fields
      const inputData = buildProfileInput(req.body);

      // ✅ Validate
      const validation = validateClientProfileData(inputData);
      if (!validation.valid) {
        throw new AppError("Validation failed", 400, validation.errors);
      }

      // ✅ Normalize
      const normalized = normalizeClientProfileData(inputData);

      // ✅ Whitelist fields (VERY IMPORTANT)
      const safeData = {
        age: normalized.age,
        heightCm: normalized.heightCm,
        weightKg: normalized.weightKg,
        fitnessGoal: normalized.fitnessGoal,
        // add more fields explicitly here
      };

      return tx.clientProfile.upsert({
        where: { clientId },
        update: safeData,
        create: {
          clientId,
          ...safeData,
        },
      });
    });

    invalidateCacheByTags(buildResourceTags("client_profiles", clientId));

    return res.status(200).json({
      success: true,
      message: "Profile saved successfully",
      data: profile,
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
    const { userId: clientId } = req.params;

    if (!clientId) {
      return next(new AppError("User ID is required", 400));
    }

    const requesterId = getUserId(req);
    const isAdmin = canManageAnyProfile(req.user);
    const isOwnProfile = String(requesterId) === String(clientId);

    if (!isAdmin && !isOwnProfile) {
      return next(
        new AppError("Forbidden: You can only view your own profile", 403),
      );
    }

    const profile = await prisma.clientProfile.findUnique({
      where: { clientId },
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
    const clientId = getUserId(req);
    if (!clientId) {
      return next(new AppError("Unauthorized", 401));
    }

    const profile = await prisma.clientProfile.findUnique({
      where: { clientId },
      include: {
        client: {
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
    const { userId: clientId } = req.params;

    if (!clientId) {
      return next(new AppError("User ID is required", 400));
    }

    if (!canManageAnyProfile(req.user)) {
      return next(
        new AppError("Forbidden: Only admins can delete profiles", 403),
      );
    }

    const existing = await prisma.clientProfile.findUnique({
      where: { clientId },
    });

    if (!existing) {
      return next(new AppError("Profile not found", 404));
    }

    await prisma.clientProfile.delete({
      where: { clientId },
    });

    invalidateCacheByTags(buildResourceTags("client_profiles", clientId));

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
      defaultSort: "updatedAt",
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
          client: {
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
    const { updates } = req.body; // [{userId|clientId, profileData}, ...]

    if (!Array.isArray(updates) || updates.length === 0) {
      return next(new AppError("Updates must be a non-empty array", 400));
    }

    if (!canManageAnyProfile(req.user)) {
      return next(
        new AppError("Forbidden: Only admins can batch update profiles", 403),
      );
    }

    const results = [];

    for (const { userId, clientId, ...profileData } of updates) {
      const targetClientId = clientId || userId;

      if (!targetClientId) {
        results.push({
          clientId: null,
          success: false,
          error: "clientId or userId is required",
        });
        continue;
      }

      const inputData = buildProfileInput(profileData);
      const validation = validateClientProfileData(inputData);
      if (!validation.valid) {
        results.push({
          clientId: targetClientId,
          success: false,
          error: validation.errors,
        });
        continue;
      }

      try {
        const normalized = normalizeClientProfileData(inputData);
        const updated = await prisma.clientProfile.upsert({
          where: { clientId: targetClientId },
          update: normalized,
          create: { clientId: targetClientId, ...normalized },
        });

        invalidateCacheByTags(
          buildResourceTags("client_profiles", targetClientId),
        );

        results.push({
          clientId: targetClientId,
          success: true,
          data: updated,
        });
      } catch (error) {
        results.push({
          clientId: targetClientId,
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
