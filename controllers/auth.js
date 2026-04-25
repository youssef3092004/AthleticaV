import { prisma } from "../configs/db.js";
import bcrypt from "bcrypt";
import process from "process";
import {
  isValidName,
  isValidEmail,
  isValidPassword,
  isValidPhone,
} from "../utils/validation.js";
import {
  validateClientProfileData,
  normalizeClientProfileData,
} from "../utils/clientProfileValidation.js";
import { AppError } from "../utils/appError.js";
import jwt from "jsonwebtoken";
import { buildRoleIdentityContext } from "../utils/authz.js";
// ============ CONSTANTS ============
const ROLE_IDS = {
  CLIENT: "670e8a6e-98dd-4270-b651-0d2923cbda1c",
  DEVELOPER: "5120385b-6f92-4de0-89db-58043a0775d8",
  SUPPORT: "2fafbe3d-6069-43ad-8cc5-6f93170025de",
  TRAINER: "b0fd6da3-def3-4448-8eb5-03e043219551",
  ADMIN: "b8c3e936-0b8c-4a3c-a134-671294e3cbd9",
};

const DEFAULT_PROFILE_IMAGE =
  "https://cdn.pixabay.com/photo/2020/07/01/12/58/icon-5359553_640.png";
const CONFIGURED_SALT_ROUNDS = Number(process.env.SALT_ROUNDS || 10);
const MAX_SALT_ROUNDS = Number(process.env.MAX_SALT_ROUNDS || 12);
const SALT_ROUNDS = Number.isFinite(CONFIGURED_SALT_ROUNDS)
  ? Math.min(Math.max(CONFIGURED_SALT_ROUNDS, 8), MAX_SALT_ROUNDS)
  : 10;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const ALLOWED_ROLE_IDS = new Set(Object.values(ROLE_IDS));

// ============ HELPER FUNCTIONS ============

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const toDateOnly = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Validates all required auth fields in one pass
 */
const validateAuthFields = (name, phone, email, password, isEmail = true) => {
  if (!name || !phone || !password) {
    throw new AppError("Name, phone and password are required", 400);
  }

  if (!isValidName(name)) {
    throw new AppError("Name must be between 5 and 30 characters", 400);
  }

  if (!isValidPhone(phone)) {
    throw new AppError("Invalid phone number", 400);
  }

  if (!isValidPassword(password)) {
    throw new AppError("Password must be at least 8 characters", 400);
  }

  if (isEmail && email && !isValidEmail(email)) {
    throw new AppError("Invalid email format", 400);
  }
};

const isUniqueConstraintError = (error) => {
  return error?.code === "P2002";
};

const userHasAnyRole = (user, allowedRoles = []) => {
  if (!user) return false;

  const normalizedAllowed = new Set(
    allowedRoles.map((role) => String(role).toUpperCase()),
  );

  const roleName = String(user.roleName || "").toUpperCase();
  if (roleName && normalizedAllowed.has(roleName)) {
    return true;
  }

  const rolesFromToken = Array.isArray(user.roles)
    ? user.roles.map((role) => String(role).toUpperCase())
    : [];

  return rolesFromToken.some((role) => normalizedAllowed.has(role));
};

const buildBaseUserData = ({
  name,
  phone,
  email,
  profileImage,
  hashedPassword,
  roleId,
}) => ({
  name,
  phone,
  email,
  profileImage: profileImage || DEFAULT_PROFILE_IMAGE,
  password: hashedPassword,
  userRoles: {
    create: { roleId },
  },
});

const createUserWithRole = async ({ input, roleId, extraData, select }) => {
  const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

  const data = {
    ...buildBaseUserData({
      name: input.name,
      phone: input.phone,
      email: input.email,
      profileImage: input.profileImage,
      hashedPassword,
      roleId,
    }),
    ...(extraData || {}),
  };

  return prisma.user.create({
    data,
    select,
  });
};

const normalizeInviteCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

// ============ REGISTER FUNCTIONS (Separated by Role Type) ============

/**
 * Client Registration - Self-registration for regular clients
 * Returns user data WITHOUT token (no auto-login)
 */
export const clientRegister = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      profileImage,
      age,
      heightCm,
      weightKg,
      fitnessGoal,
      medicalConditions,
    } = req.body;

    const inviteCodeInput = normalizeInviteCode(
      req.body.code || req.query.code,
    );
    const isInviteSignup = Boolean(inviteCodeInput);

    // Validate all fields in one pass
    validateAuthFields(name, phone, email, password, true);

    const clientProfileInput = {
      age,
      heightCm,
      weightKg,
      fitnessGoal,
      medicalConditions,
    };

    const clientProfileValidation =
      validateClientProfileData(clientProfileInput);
    if (!clientProfileValidation.valid) {
      return next(
        new AppError(
          `Validation failed: ${JSON.stringify(clientProfileValidation.errors)}`,
          400,
        ),
      );
    }

    const normalizedClientProfile =
      normalizeClientProfileData(clientProfileInput);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const clientRole = await prisma.role.findUnique({
      where: { id: ROLE_IDS.CLIENT },
      select: { id: true, name: true },
    });

    if (!clientRole) {
      throw new AppError("CLIENT role is not configured", 500);
    }

    const registration = await prisma.$transaction(async (tx) => {
      let inviteCodeRecord = null;

      if (isInviteSignup) {
        inviteCodeRecord = await tx.trainerInviteCode.findUnique({
          where: { code: inviteCodeInput },
          select: {
            id: true,
            trainerId: true,
            code: true,
            totalClients: true,
          },
        });

        if (!inviteCodeRecord) {
          throw new AppError("Invalid invite code", 404);
        }
      }

      const user = await tx.user.create({
        data: {
          name,
          phone,
          email,
          profileImage: profileImage || DEFAULT_PROFILE_IMAGE,
          password: passwordHash,
          userRoles: {
            create: { roleId: clientRole.id },
          },
          clientProfile: {
            create: normalizedClientProfile,
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          profileImage: true,
          email: true,
          password: true,
          isVerified: true,
          createdAt: true,
          updatedAt: true,
          clientProfile: true,
        },
      });

      let inviteHistory = null;
      if (inviteCodeRecord) {
        inviteHistory = await tx.trainerClientInvite.create({
          data: {
            trainerId: inviteCodeRecord.trainerId,
            inviteCodeId: inviteCodeRecord.id,
            usedByClientId: user.id,
            clientName: name,
            clientPhone: phone,
            clientEmail: email || null,
            status: "PENDING",
          },
          select: {
            id: true,
            trainerId: true,
            inviteCodeId: true,
            usedByClientId: true,
            clientName: true,
            clientPhone: true,
            clientEmail: true,
            status: true,
            usedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      }

      return { user, inviteCodeRecord, inviteHistory };
    });

    const userWithoutPassword = { ...registration.user };
    delete userWithoutPassword.password;

    return res.status(201).json({
      success: true,
      message: isInviteSignup
        ? "Client registered successfully. Waiting for trainer approval."
        : "Client registered successfully. Please login with your credentials.",
      data: {
        user: userWithoutPassword,
        role: {
          id: clientRole.id,
          name: clientRole.name,
        },
        activation: isInviteSignup
          ? {
              flow: "MANUAL_TRAINER_APPROVAL",
              requiresTrainerApproval: true,
              status: "PENDING",
            }
          : {
              flow: "DIRECT_LOGIN",
              requiresTrainerApproval: false,
              status: "ACTIVE",
            },
        clientProfile: { data: registration.user.clientProfile || null },
        invite: registration.inviteHistory
          ? {
              data: registration.inviteHistory,
              code: registration.inviteCodeRecord?.code || inviteCodeInput,
              totalClients: registration.inviteCodeRecord?.totalClients ?? 0,
            }
          : null,
        trainerInviteCode: registration.inviteCodeRecord
          ? {
              id: registration.inviteCodeRecord.id,
              trainerId: registration.inviteCodeRecord.trainerId,
              code: registration.inviteCodeRecord.code,
              totalClients: registration.inviteCodeRecord.totalClients ?? 0,
            }
          : null,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return next(new AppError("User already exists with email or phone", 409));
    }
    return next(err);
  }
};

/**
 * Trainer Registration - For trainers with trial subscription
 * Creates TrainerProfile and 14-day trial subscription automatically
 * Returns user data WITHOUT token (no auto-login)
 */
export const trainerRegister = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      profileImage,
      rating,
      yearsExperience,
    } = req.body;

    validateAuthFields(name, phone, email, password, true);

    const parsedYearsExperience = Math.max(0, parseInt(yearsExperience) || 0);
    const trialStart = toDateOnly(new Date());
    const trialEnd = toDateOnly(addDays(trialStart, 14));
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [trainerRole, preferredPlan, fallbackPlan] = await Promise.all([
      prisma.role.findUnique({
        where: { id: ROLE_IDS.TRAINER },
        select: { id: true, name: true },
      }),
      prisma.plan.findFirst({
        where: {
          name: "elite",
          billingCycle: "MONTHLY",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          price: true,
          billingCycle: true,
          isActive: true,
          createdAt: true,
        },
      }),
      prisma.plan.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          billingCycle: true,
          isActive: true,
          createdAt: true,
        },
      }),
    ]);

    if (!trainerRole) {
      throw new AppError("TRAINER role is not configured", 500);
    }

    const trialPlan = preferredPlan || fallbackPlan;
    if (!trialPlan) {
      throw new AppError(
        "No active subscription plan found for trainer trial",
        500,
      );
    }

    const created = await prisma.user.create({
      data: {
        name,
        phone,
        email,
        profileImage: profileImage || DEFAULT_PROFILE_IMAGE,
        password: hashedPassword,
        userRoles: {
          create: { roleId: trainerRole.id },
        },
        trainerProfile: {
          create: {
            bio: "Pending",
            certifications: "Pending",
            yearsExperience: parsedYearsExperience,
            rating: Number(rating) || 0,
          },
        },
        subscriptions: {
          create: {
            planId: trialPlan.id,
            status: "TRIAL",
            trialStart,
            trialEnd,
          },
        },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profileImage: true,
        email: true,
        password: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
        trainerProfile: true,
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    const userWithoutPassword = { ...created };
    delete userWithoutPassword.password;

    return res.status(201).json({
      success: true,
      message:
        "Trainer registered successfully. 14-day trial activated. Please login with your credentials.",
      data: {
        user: userWithoutPassword,
        role: {
          id: trainerRole.id,
          name: trainerRole.name,
        },
        trainerProfile: {
          data: created.trainerProfile,
        },
        subscription: {
          data: created.subscriptions?.[0] || null,
        },
        plan: {
          data: trialPlan,
        },
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return next(new AppError("User already exists with email or phone", 409));
    }
    return next(err);
  }
};

/**
 * Developer Registration - For developer users
 * Returns user data WITHOUT token (no auto-login)
 */
export const developerRegister = async (req, res, next) => {
  try {
    if (!userHasAnyRole(req.user, ["DEVELOPER"])) {
      return next(
        new AppError("Only developers can access this endpoint", 403),
      );
    }
    const { name, phone, email, password, profileImage } = req.body;

    validateAuthFields(name, phone, email, password, true);

    const newUser = await createUserWithRole({
      input: { name, phone, email, password, profileImage },
      roleId: ROLE_IDS.DEVELOPER,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profileImage: true,
        isVerified: true,
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
        createdAt: true,
      },
    });

    const role = newUser.userRoles?.[0]?.role || null;
    const userWithoutRoles = { ...newUser };
    delete userWithoutRoles.userRoles;

    return res.status(201).json({
      success: true,
      message:
        "Developer registered successfully. Please login with your credentials.",
      data: {
        user: userWithoutRoles,
        role,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return next(new AppError("User already exists with email or phone", 409));
    }
    return next(err);
  }
};

/**
 * Support Registration - For support staff
 * Returns user data WITHOUT token (no auto-login)
 */
export const supportRegister = async (req, res, next) => {
  try {
    if (!userHasAnyRole(req.user, ["DEVELOPER", "ADMIN"])) {
      return next(
        new AppError(
          "Only developers and admins can access this endpoint",
          403,
        ),
      );
    }
    const { name, phone, email, password, profileImage } = req.body;

    validateAuthFields(name, phone, email, password, true);

    const newUser = await createUserWithRole({
      input: { name, phone, email, password, profileImage },
      roleId: ROLE_IDS.SUPPORT,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profileImage: true,
        isVerified: true,
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
        createdAt: true,
      },
    });

    const role = newUser.userRoles?.[0]?.role || null;
    const userWithoutRoles = { ...newUser };
    delete userWithoutRoles.userRoles;

    return res.status(201).json({
      success: true,
      message:
        "Support staff registered successfully. Please login with your credentials.",
      data: {
        user: userWithoutRoles,
        role,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return next(new AppError("User already exists with email or phone", 409));
    }
    return next(err);
  }
};

/**
 * Admin Registration - For admin to create new users (non-self-registration)
 * Admin must be authenticated for this endpoint
 * Returns user data WITHOUT token
 */
export const adminRegister = async (req, res, next) => {
  try {
    if (!userHasAnyRole(req.user, ["DEVELOPER", "ADMIN"])) {
      return next(
        new AppError(
          "Only developers and admins can access this endpoint",
          403,
        ),
      );
    }
    const { name, phone, email, password, profileImage, roleId } = req.body;

    validateAuthFields(name, phone, email, password, true);

    // Validate that roleId is one of the allowed roles
    if (roleId && !ALLOWED_ROLE_IDS.has(roleId)) {
      return next(new AppError("Invalid role ID provided", 400));
    }

    const finalRoleId = roleId || ROLE_IDS.CLIENT; // Default to CLIENT if no role specified

    const newUser = await createUserWithRole({
      input: { name, phone, email, password, profileImage },
      roleId: finalRoleId,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profileImage: true,
        isVerified: true,
        userRoles: {
          select: {
            role: { select: { id: true, name: true } },
          },
        },
        createdAt: true,
      },
    });

    const role = newUser.userRoles?.[0]?.role || null;
    const userWithoutRoles = { ...newUser };
    delete userWithoutRoles.userRoles;

    return res.status(201).json({
      success: true,
      message: "User created successfully by admin.",
      data: {
        user: userWithoutRoles,
        role,
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return next(new AppError("User already exists with email or phone", 409));
    }
    return next(err);
  }
};

// ============ LOGIN & AUTHENTICATION ============

/**
 * Optimized Login - Credentials validation + role/permission lookup
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Early validation using faster check
    if (!email?.trim() || !password?.trim()) {
      return next(new AppError("Email and password are required", 400));
    }

    // Single optimized query that fetches user with all needed data
    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        profileImage: true,
        isVerified: true,
        password: true,
        userRoles: {
          select: {
            roleId: true,
            role: {
              select: {
                id: true,
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
        subscriptions: {
          where: {
            status: {
              in: ["TRIAL", "ACTIVE"],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: { status: true, trialStart: true, trialEnd: true },
        },
      },
    });

    // Generic error message to avoid user enumeration attacks
    if (!user) {
      return next(new AppError("Invalid email or password", 401));
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new AppError("Invalid email or password", 401));
    }

    // Extract roles and permissions efficiently in single pass
    const roleNames = new Set();
    const permissions = new Set();

    for (const userRole of user.userRoles) {
      const role = userRole.role;
      if (role?.name) {
        roleNames.add(role.name);
        // Aggregate permissions from role
        for (const rp of role.rolePermissions || []) {
          if (rp?.permission?.key) {
            permissions.add(rp.permission.key);
          }
        }
      }
    }

    const roleArray = Array.from(roleNames);
    const roleIdentity = buildRoleIdentityContext(user.id, roleArray);

    // Generate token with optimized payload
    const token = jwt.sign(
      {
        id: user.id,
        userId: user.id,
        roles: roleArray,
        roleName: roleArray[0] || null,
        isAdmin: roleArray.includes("ADMIN"),
        ...roleIdentity,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    // Build safe user response (exclude password and internal permission graph)
    const safeUser = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      subscriptions: user.subscriptions,
      userRoles: user.userRoles.map((entry) => ({
        roleId: entry.roleId,
        role: entry.role
          ? {
              id: entry.role.id,
              name: entry.role.name,
            }
          : null,
      })),
    };

    return res.status(200).json({
      status: "success",
      token,
      data: {
        ...safeUser,
        ...roleIdentity,
        roles: roleArray,
        roleName: roleArray[0] || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// ============ PASSWORD & LOGOUT ============

/**
 * Optimized Logout
 */
export const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization?.split(" ");
    if (!authHeader || authHeader.length !== 2) {
      return next(new AppError("Invalid authorization header", 401));
    }

    const token = authHeader[1];
    const decoded = jwt.decode(token);

    if (!decoded) {
      return next(new AppError("Invalid token", 401));
    }

    await prisma.blacklistedToken.create({
      data: {
        token,
        expiredAt: decoded.exp ? new Date(decoded.exp * 1000) : new Date(),
      },
    });

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Optimized Reset Password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;

    if (!userId) {
      return next(new AppError("Unauthorized", 401));
    }

    // Validate inputs early
    if (!oldPassword?.trim() || !newPassword?.trim()) {
      return next(
        new AppError("Old password and new password are required", 400),
      );
    }

    if (!isValidPassword(newPassword)) {
      return next(
        new AppError("New password must be at least 8 characters", 400),
      );
    }

    if (oldPassword.trim() === newPassword.trim()) {
      return next(
        new AppError("New password must be different from old password", 400),
      );
    }

    // Fetch user and verify old password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return next(new AppError("Current password is incorrect", 401));
    }

    // Hash and update password
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: { id: true }, // Minimal select for performance
    });

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (error) {
    return next(error);
  }
};
