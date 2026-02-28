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
    const { name, phone, email, password, profileImage, roleNames } = req.body;

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
      return next(new AppError("User already exists", 409));
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

    const requestedRoles =
      Array.isArray(roleNames) && roleNames.length > 0
        ? roleNames.map((nameItem) => String(nameItem).trim().toUpperCase())
        : [DEFAULT_ROLE];

    const roles = await prisma.role.findMany({
      where: { name: { in: requestedRoles } },
      select: { id: true, name: true },
    });

    if (roles.length !== requestedRoles.length) {
      const found = new Set(roles.map((role) => role.name));
      const missing = requestedRoles.filter((roleName) => !found.has(roleName));
      return next(new AppError(`Unknown role(s): ${missing.join(", ")}`, 400));
    }

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
      },
      include: {
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

export const forgetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    if (userId !== id) {
      return next(new AppError("Unauthorized", 403));
    }
    const user = await prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      return next(new AppError("User not found", 404));
    }
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
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
