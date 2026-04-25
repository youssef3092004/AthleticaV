import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";

const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "startDate",
  "endDate",
]);

const getUserId = (req) => req.user?.id || req.user?.userId || req.user?.sub;

const canManageAnyProgram = (user) => {
  const roleName = user?.roleName;
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  return (
    roleName === "DEVELOPER" ||
    roleName === "ADMIN" ||
    roles.includes("DEVELOPER") ||
    roles.includes("ADMIN")
  );
};

const ensureOwnOrPrivileged = (req, trainerId, clientId) => {
  if (canManageAnyProgram(req.user)) return true;

  const requesterId = getUserId(req);
  return (
    requesterId &&
    (String(requesterId) === String(trainerId) ||
      String(requesterId) === String(clientId))
  );
};

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const ensureDateRange = (startDate, endDate) => {
  if (endDate < startDate) {
    throw new AppError("endDate cannot be before startDate", 400);
  }
};

const ensureUserExists = async (id, label) => {
  const row = await prisma.user.findUnique({
    where: { id: String(id) },
    select: { id: true },
  });

  if (!row) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureApprovedTransactionForProgram = async (
  tx,
  transactionId,
  trainerId,
  clientId,
) => {
  if (!transactionId) {
    throw new AppError("transactionId is required to create a program", 400);
  }

  const transaction = await tx.transaction.findUnique({
    where: { id: String(transactionId) },
    select: {
      id: true,
      kind: true,
      trainerId: true,
      clientId: true,
      status: true,
      programId: true,
    },
  });

  if (!transaction) {
    throw new AppError("Transaction not found", 404);
  }

  if (
    String(transaction.trainerId) !== String(trainerId) ||
    String(transaction.clientId) !== String(clientId)
  ) {
    throw new AppError(
      "Transaction must belong to the same trainer and client",
      409,
    );
  }

  if (transaction.kind !== "CLIENT_TO_TRAINER") {
    throw new AppError(
      "Only client-to-trainer payments can be used to create programs",
      409,
    );
  }

  if (transaction.status !== "PAID") {
    throw new AppError(
      "Transaction must be approved by trainer before creating program",
      409,
    );
  }

  if (transaction.programId) {
    throw new AppError("This transaction is already linked to a program", 409);
  }

  return transaction;
};

const PROGRAM_SELECT = {
  id: true,
  trainerId: true,
  clientId: true,
  trainerClientId: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
};

const ensureTrainerClientExistsOrCreate = async (tx, trainerId, clientId) => {
  const existing = await tx.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (existing) {
    if (existing.status !== "ACTIVE") {
      await tx.trainerClient.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
    }

    return existing.id;
  }

  const created = await tx.trainerClient.create({
    data: {
      trainerId: String(trainerId),
      clientId: String(clientId),
      status: "ACTIVE",
      startedAt: new Date(),
    },
    select: { id: true },
  });

  return created.id;
};

export const createProgram = async (req, res, next) => {
  try {
    const trainerId = String(req.body.trainerId || "").trim();
    const clientId = String(req.body.clientId || "").trim();

    if (!trainerId || !clientId || !req.body.startDate || !req.body.endDate) {
      return next(
        new AppError(
          "trainerId, clientId, startDate and endDate are required",
          400,
        ),
      );
    }

    if (!ensureOwnOrPrivileged(req, trainerId, clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const startDate = parseDateOnly(req.body.startDate, "startDate");
    const endDate = parseDateOnly(req.body.endDate, "endDate");
    ensureDateRange(startDate, endDate);

    await ensureUserExists(trainerId, "Trainer user");
    await ensureUserExists(clientId, "Client user");

    const created = await prisma.$transaction(async (tx) => {
      const approvedTransaction = await ensureApprovedTransactionForProgram(
        tx,
        req.body.transactionId,
        trainerId,
        clientId,
      );

      const trainerClientId = await ensureTrainerClientExistsOrCreate(
        tx,
        trainerId,
        clientId,
      );

      const program = await tx.program.create({
        data: {
          trainerId,
          clientId,
          trainerClientId,
          startDate,
          endDate,
        },
        select: PROGRAM_SELECT,
      });

      await tx.transaction.update({
        where: { id: approvedTransaction.id },
        data: { programId: program.id },
      });

      return program;
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    return next(error);
  }
};

export const getProgramById = async (req, res, next) => {
  try {
    const id = String(req.params.id || req.params.programId || "").trim();
    if (!id) {
      return next(new AppError("Program ID is required", 400));
    }

    const program = await prisma.program.findUnique({
      where: { id },
      select: PROGRAM_SELECT,
    });

    if (!program) {
      return next(new AppError("Program not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, program.trainerId, program.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    return res.status(200).json({
      success: true,
      data: program,
    });
  } catch (error) {
    return next(error);
  }
};

export const getPrograms = async (req, res, next) => {
  try {
    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "createdAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.has(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const requesterId = getUserId(req);
    const where = {};

    if (!canManageAnyProgram(req.user)) {
      where.OR = [{ trainerId: requesterId }, { clientId: requesterId }];
    } else {
      if (req.query.trainerId) {
        where.trainerId = String(req.query.trainerId);
      }
      if (req.query.clientId) {
        where.clientId = String(req.query.clientId);
      }
    }

    if (req.query.startDateFrom || req.query.startDateTo) {
      where.startDate = {};
      if (req.query.startDateFrom) {
        where.startDate.gte = parseDateOnly(
          req.query.startDateFrom,
          "startDateFrom",
        );
      }
      if (req.query.startDateTo) {
        where.startDate.lte = parseDateOnly(
          req.query.startDateTo,
          "startDateTo",
        );
      }
    }

    if (req.query.endDateFrom || req.query.endDateTo) {
      where.endDate = {};
      if (req.query.endDateFrom) {
        where.endDate.gte = parseDateOnly(req.query.endDateFrom, "endDateFrom");
      }
      if (req.query.endDateTo) {
        where.endDate.lte = parseDateOnly(req.query.endDateTo, "endDateTo");
      }
    }

    const [total, programs] = await prisma.$transaction([
      prisma.program.count({ where }),
      prisma.program.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        select: PROGRAM_SELECT,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: programs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        sort,
        order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const updateProgramById = async (req, res, next) => {
  try {
    const id = String(req.params.id || req.params.programId || "").trim();
    if (!id) {
      return next(new AppError("Program ID is required", 400));
    }

    const existing = await prisma.program.findUnique({
      where: { id },
      select: PROGRAM_SELECT,
    });

    if (!existing) {
      return next(new AppError("Program not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId, existing.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    const data = {};

    if (req.body.startDate !== undefined) {
      data.startDate = parseDateOnly(req.body.startDate, "startDate");
    }

    if (req.body.endDate !== undefined) {
      data.endDate = parseDateOnly(req.body.endDate, "endDate");
    }

    if (Object.keys(data).length === 0) {
      return next(new AppError("No fields provided for update", 400));
    }

    const nextStartDate = data.startDate || existing.startDate;
    const nextEndDate = data.endDate || existing.endDate;
    ensureDateRange(nextStartDate, nextEndDate);

    const updated = await prisma.program.update({
      where: { id },
      data,
      select: PROGRAM_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteProgramById = async (req, res, next) => {
  try {
    const id = String(req.params.id || req.params.programId || "").trim();
    if (!id) {
      return next(new AppError("Program ID is required", 400));
    }

    const existing = await prisma.program.findUnique({
      where: { id },
      select: PROGRAM_SELECT,
    });

    if (!existing) {
      return next(new AppError("Program not found", 404));
    }

    if (!ensureOwnOrPrivileged(req, existing.trainerId, existing.clientId)) {
      return next(new AppError("Forbidden", 403));
    }

    await prisma.program.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Program deleted",
    });
  } catch (error) {
    return next(error);
  }
};
