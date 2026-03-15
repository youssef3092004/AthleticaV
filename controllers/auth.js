import { prisma } from "../configs/db.js";
import bcrypt from "bcrypt";
import process from "process";
import {
  isValidName,
  isValidEmail,
  isValidPassword,
  isValidPhone,
} from "../utils/validation.js";
import { AppError } from "../utils/appError.js";
import jwt from "jsonwebtoken";

const DEFAULT_ROLE = "CLIENT";
const TRAINER_ROLE_ID = "1da36adf-31f4-4cf8-bea7-a8e65c9aff0d";

const signToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError("JWT secret not configured", 500);
  }

  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

const sanitizeUser = (user) => {
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
};

export const register = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      profileImage,
      roleNames,
      roleId,
      roleIds,
      bio,
      certifications,
      yearsExperience,
    } = req.body;

    if (!name || !phone || !password) {
      return next(new AppError("Name, phone and password are required", 400));
    }

    if (email && !isValidEmail(email)) {
      return next(new AppError("Invalid email format", 400));
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ phone }, ...(email ? [{ email }] : [])],
      },
    });

    if (existingUser) {
      return next(new AppError("User already exists with email or phone", 409));
    }

    if (!isValidName(name)) {
      return next(
        new AppError("Name must be between 5 and 30 characters", 400),
      );
    }

    if (!isValidPassword(password)) {
      return next(new AppError("Password must be at least 8 characters", 400));
    }

    if (!isValidPhone(phone)) {
      return next(new AppError("Invalid phone number", 400));
    }

    const hashedPassword = await bcrypt.hash(
      password,
      Number(process.env.SALT_ROUNDS || 10),
    );

    const requestedRoleIds = [
      ...(Array.isArray(roleIds) ? roleIds : []),
      ...(roleId ? [roleId] : []),
    ]
      .map((idItem) => String(idItem).trim())
      .filter(Boolean);

    const requestedRoleNames =
      Array.isArray(roleNames) && roleNames.length > 0
        ? roleNames.map((nameItem) => String(nameItem).trim().toUpperCase())
        : [];

    const hasExplicitRoles =
      requestedRoleIds.length > 0 || requestedRoleNames.length > 0;

    if (!hasExplicitRoles) {
      requestedRoleNames.push(DEFAULT_ROLE);
    }

    let roles = await prisma.role.findMany({
      where: {
        OR: [
          ...(requestedRoleIds.length > 0
            ? [{ id: { in: requestedRoleIds } }]
            : []),
          ...(requestedRoleNames.length > 0
            ? [{ name: { in: requestedRoleNames } }]
            : []),
        ],
      },
      select: { id: true, name: true },
    });

    if (!hasExplicitRoles && requestedRoleNames.includes(DEFAULT_ROLE)) {
      const hasDefaultRole = roles.some((role) => role.name === DEFAULT_ROLE);
      if (!hasDefaultRole) {
        await prisma.role.upsert({
          where: { name: DEFAULT_ROLE },
          update: {},
          create: { name: DEFAULT_ROLE },
        });

        roles = await prisma.role.findMany({
          where: {
            OR: [{ name: { in: requestedRoleNames } }],
          },
          select: { id: true, name: true },
        });
      }
    }

    const foundRoleIds = new Set(roles.map((role) => role.id));
    const foundRoleNames = new Set(roles.map((role) => role.name));

    const missingRoleIds = requestedRoleIds.filter(
      (idItem) => !foundRoleIds.has(idItem),
    );
    const missingRoleNames = requestedRoleNames.filter(
      (roleNameItem) => !foundRoleNames.has(roleNameItem),
    );

    if (missingRoleIds.length > 0 || missingRoleNames.length > 0) {
      const details = [
        ...(missingRoleIds.length > 0
          ? [`roleId(s): ${missingRoleIds.join(", ")}`]
          : []),
        ...(missingRoleNames.length > 0
          ? [`role(s): ${missingRoleNames.join(", ")}`]
          : []),
      ];

      return next(new AppError(`Unknown ${details.join(" | ")}`, 400));
    }

    const shouldCreateTrainerProfile = roles.some(
      (role) => role.id === TRAINER_ROLE_ID,
    );

    const parsedYearsExperience =
      yearsExperience === undefined ||
      yearsExperience === null ||
      String(yearsExperience).trim() === ""
        ? 0
        : Number(yearsExperience);

    if (Number.isNaN(parsedYearsExperience) || parsedYearsExperience < 0) {
      return next(
        new AppError("yearsExperience must be a valid number >= 0", 400),
      );
    }

    const trainerProfileData = {
      bio:
        bio === undefined || bio === null || String(bio).trim() === ""
          ? "Pending"
          : String(bio).trim(),
      certifications:
        certifications === undefined ||
        certifications === null ||
        String(certifications).trim() === ""
          ? "Pending"
          : String(certifications).trim(),
      yearsExperience: parsedYearsExperience,
      rating: 0,
      isVerified: false,
    };

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email,
        profileImage,
        password: hashedPassword,
        userRoles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
        ...(shouldCreateTrainerProfile
          ? {
              trainerProfile: {
                create: trainerProfileData,
              },
            }
          : {}),
      },
      include: {
        trainerProfile: true,
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const token = signToken({ id: user.id, userId: user.id });

    return res.status(201).json({
      success: true,
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const requiredFields = { email, password };
    for (let i in requiredFields) {
      if (!requiredFields[i]) {
        return next(
          new AppError(
            `${i.charAt(0).toUpperCase() + i.slice(1)} is required`,
            400,
          ),
        );
      }
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: {
                        key: true,
                      },
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
      return next(new AppError("Invalid email", 401));
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid password", 401));
    }

    // eslint-disable-next-line no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    const roleNames = [];
    const permissionKeys = new Set();

    for (const userRole of user.userRoles) {
      const role = userRole.role;
      if (!role) continue;

      roleNames.push(role.name);
      for (const rp of role.rolePermissions) {
        if (rp.permission?.key) {
          permissionKeys.add(rp.permission.key);
        }
      }
    }

    const token = jwt.sign(
      {
        id: user.id,
        userId: user.id,
        roles: roleNames,
        permissions: Array.from(permissionKeys),
        isAdmin: roleNames.includes("ADMIN"),
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN },
    );

    res.status(200).json({
      status: "success",
      data: userWithoutPassword,
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];

    const decoded = jwt.decode(token);

    if (!decoded) {
      return next(new AppError("Invalid token", 401));
    }

    //TODO: make it in v2
    //! const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await prisma.blacklistedToken.create({
      data: {
        token,
        expiredAt: decoded.exp ? new Date(decoded.exp * 1000) : new Date(),
      },
    });
    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const {oldPassword, newPassword } = req.body;
    const previousPassword = oldPassword;
    const id = req.user?.id || req.user?.userId || req.user?.sub;

    if (!id) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!previousPassword || !newPassword) {
      return next(
        new AppError(
          "oldPassword and newPassword are required",
          400,
        ),
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    const isPasswordValid = await bcrypt.compare(
      previousPassword,
      user.password,
    );
    if (!isPasswordValid) {
      return next(new AppError("Current password is incorrect", 401));
    }
    if (!isValidPassword(newPassword)) {
      return next(new AppError("Weak password format", 400));
    }
    const hashedPassword = await bcrypt.hash(
      newPassword,
      Number(process.env.SALT_ROUNDS || 10),
    );
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};
