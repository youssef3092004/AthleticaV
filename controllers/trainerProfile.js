import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { buildResourceTags, invalidateCacheByTags } from "../utils/cache.js";

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  phone: true,
  profileImage: true,
  email: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
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
};

const canManageAnyTrainerProfile = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const normalizeCreateData = (body = {}) => {
  const {
    trainerId,
    bio,
    certifications,
    yearsExperience,
    rating,
    isVerified,
  } = body;

  return {
    trainerId,
    bio: bio ?? null,
    certifications: certifications ?? null,
    yearsExperience:
      yearsExperience !== undefined && yearsExperience !== null
        ? Number(yearsExperience)
        : null,
    rating: rating !== undefined && rating !== null ? Number(rating) : 0,
    isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
  };
};

const ensureNonNegativeNumber = (value, fieldName) => {
  if (value === null || value === undefined) return;
  if (Number.isNaN(value)) {
    throw new AppError(`${fieldName} must be a valid number`, 400);
  }
  if (value < 0) {
    throw new AppError(`${fieldName} must be greater than or equal to 0`, 400);
  }
};

const ensureOwnOrPrivileged = (req, trainerId) => {
  if (canManageAnyTrainerProfile(req.user)) return true;

  const requesterId = getUserId(req);
  return requesterId && String(requesterId) === String(trainerId);
};

export const createTrainerProfile = async (req, res, next) => {
  try {
    const payload = normalizeCreateData(req.body);

    if (!payload.trainerId) {
      return next(new AppError("Trainer ID is required", 400));
    }

    if (!ensureOwnOrPrivileged(req, payload.trainerId)) {
      return next(
        new AppError(
          "Forbidden: You can only create your own trainer profile",
          403,
        ),
      );
    }

    ensureNonNegativeNumber(payload.yearsExperience, "yearsExperience");
    ensureNonNegativeNumber(payload.rating, "rating");

    const trainer = await prisma.user.findUnique({
      where: { id: payload.trainerId },
      select: { id: true },
    });

    if (!trainer) {
      return next(new AppError("Trainer user not found", 404));
    }

    const existingProfile = await prisma.trainerProfile.findUnique({
      where: { trainerId: payload.trainerId },
    });

    if (existingProfile) {
      return next(
        new AppError("Trainer profile already exists for this trainer", 409),
      );
    }

    const profile = await prisma.trainerProfile.create({
      data: payload,
      include: {
        trainer: {
          select: USER_PUBLIC_SELECT,
        },
      },
    });

    invalidateCacheByTags(
      buildResourceTags("trainer_profiles", profile.trainerId),
    );

    return res.status(201).json({
      status: "success",
      data: profile,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getTrainerProfileByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return next(new AppError("Trainer userId is required", 400));
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { trainerId: userId },
      include: {
        trainer: {
          select: USER_PUBLIC_SELECT,
        },
      },
    });

    if (!profile) {
      return next(new AppError("Trainer profile not found", 404));
    }

    return res.status(200).json({
      status: "success",
      data: {
        userId,
        user: profile.trainer,
        profile: {
          id: profile.id,
          trainerId: profile.trainerId,
          bio: profile.bio,
          certifications: profile.certifications,
          yearsExperience: profile.yearsExperience,
          rating: profile.rating,
          isVerified: profile.isVerified,
        },
      },
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const getAllTrainerProfiles = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "id",
      defaultOrder: "asc",
      defaultLimit: 20,
    });

    const [total, profiles] = await prisma.$transaction([
      prisma.trainerProfile.count(),
      prisma.trainerProfile.findMany({
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        include: {
          trainer: {
            select: USER_PUBLIC_SELECT,
          },
        },
      }),
    ]);

    const formattedProfiles = profiles.map((profile) => ({
      user: profile.trainer,
      profile: {
        id: profile.id,
        trainerId: profile.trainerId,
        bio: profile.bio,
        certifications: profile.certifications,
        yearsExperience: profile.yearsExperience,
        rating: profile.rating,
        isVerified: profile.isVerified,
      },
    }));

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return res.status(200).json({
      status: "success",
      data: formattedProfiles,
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

export const updateTrainerProfileByIdPatch = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return next(new AppError("Trainer userId is required", 400));
    }

    const existingProfile = await prisma.trainerProfile.findUnique({
      where: { trainerId: userId },
    });

    if (!existingProfile) {
      return next(new AppError("Trainer profile not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existingProfile.trainerId)) {
      return next(
        new AppError(
          "Forbidden: You can only update your own trainer profile",
          403,
        ),
      );
    }

    const allowedFields = [
      "trainerId",
      "bio",
      "certifications",
      "yearsExperience",
      "rating",
      "isVerified",
    ];

    const updateData = { ...req.body };
    const payloadKeys = Object.keys(updateData);

    if (payloadKeys.length === 0) {
      return next(new AppError("No fields provided for update", 400));
    }

    for (const key of payloadKeys) {
      if (!allowedFields.includes(key)) {
        return next(new AppError(`Field '${key}' cannot be updated`, 400));
      }
    }

    if (updateData.yearsExperience !== undefined) {
      updateData.yearsExperience = Number(updateData.yearsExperience);
      ensureNonNegativeNumber(updateData.yearsExperience, "yearsExperience");
    }

    if (updateData.rating !== undefined) {
      updateData.rating = Number(updateData.rating);
      ensureNonNegativeNumber(updateData.rating, "rating");
    }

    if (updateData.isVerified !== undefined) {
      updateData.isVerified = Boolean(updateData.isVerified);
    }

    if (updateData.trainerId !== undefined) {
      if (!ensureOwnOrPrivileged(req, updateData.trainerId)) {
        return next(
          new AppError(
            "Forbidden: You can only assign your own trainer ID",
            403,
          ),
        );
      }

      const trainer = await prisma.user.findUnique({
        where: { id: updateData.trainerId },
        select: { id: true },
      });

      if (!trainer) {
        return next(new AppError("Trainer user not found", 404));
      }

      if (String(updateData.trainerId) !== String(existingProfile.trainerId)) {
        const profileWithTrainer = await prisma.trainerProfile.findUnique({
          where: { trainerId: updateData.trainerId },
        });

        if (profileWithTrainer) {
          return next(
            new AppError(
              "Trainer profile already exists for this trainer",
              409,
            ),
          );
        }
      }
    }

    const updatedProfile = await prisma.trainerProfile.update({
      where: { trainerId: userId },
      data: updateData,
      include: {
        trainer: {
          select: USER_PUBLIC_SELECT,
        },
      },
    });

    invalidateCacheByTags(buildResourceTags("trainer_profiles", userId));

    return res.status(200).json({
      status: "success",
      data: updatedProfile,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteTrainerProfileById = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return next(new AppError("Trainer userId is required", 400));
    }

    const existingProfile = await prisma.trainerProfile.findUnique({
      where: { trainerId: userId },
    });

    if (!existingProfile) {
      return next(new AppError("Trainer profile not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existingProfile.trainerId)) {
      return next(
        new AppError(
          "Forbidden: You can only delete your own trainer profile",
          403,
        ),
      );
    }

    await prisma.trainerProfile.delete({
      where: { trainerId: userId },
    });

    invalidateCacheByTags(buildResourceTags("trainer_profiles", userId));

    return res.status(200).json({
      status: "success",
      message: "Trainer profile deleted successfully",
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteAllTrainerProfiles = async (req, res, next) => {
  try {
    if (!canManageAnyTrainerProfile(req.user)) {
      return next(
        new AppError(
          "Forbidden: Only DEVELOPER or ADMIN can delete all trainer profiles",
          403,
        ),
      );
    }

    const result = await prisma.trainerProfile.deleteMany({});

    invalidateCacheByTags(buildResourceTags("trainer_profiles"));

    return res.status(200).json({
      status: "success",
      message: "All trainer profiles deleted successfully",
      count: result.count,
      source: "database",
    });
  } catch (error) {
    return next(error);
  }
};
