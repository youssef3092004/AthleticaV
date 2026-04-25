import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const ALLOWED_PERIODS = new Set(["WEEKLY", "BIWEEKLY", "MONTHLY"]);
const ALLOWED_SORT_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "nextDueAt",
  "lastAnsweredAt",
]);

const CHECKIN_SELECT = {
  id: true,
  trainerId: true,
  clientId: true,
  period: true,
  questions: true,
  answers: true,
  nextDueAt: true,
  lastAnsweredAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

const toStringArray = (value) =>
  Array.isArray(value) ? value.map((entry) => String(entry ?? "")) : [];

const normalizeSubmissionAnswers = (questions, submission) => {
  const answers = Array.isArray(submission?.answers) ? submission.answers : [];

  // Backward compatibility for old payloads: answers as plain string array.
  if (answers.length === 0 || typeof answers[0] === "string") {
    const plain = answers.map((entry) => String(entry ?? ""));
    return plain.map((answer, index) => ({
      questionIndex: index,
      question: questions[index] || `Question ${index + 1}`,
      answer,
    }));
  }

  return answers.map((row, index) => ({
    questionIndex:
      Number.isInteger(row?.questionIndex) && row.questionIndex >= 0
        ? row.questionIndex
        : index,
    question:
      typeof row?.question === "string" && row.question.trim()
        ? row.question
        : questions[index] || `Question ${index + 1}`,
    answer: String(row?.answer ?? ""),
  }));
};

const toCheckInResponse = (item) => {
  const questionList = toStringArray(item?.questions);
  const rawHistory = Array.isArray(item?.answers) ? item.answers : [];

  const answerHistory = rawHistory.map((submission) => ({
    submittedAt: submission?.submittedAt || null,
    questionAnswers: normalizeSubmissionAnswers(questionList, submission),
  }));

  return {
    ...item,
    questions: questionList,
    answerHistory,
    latestSubmission:
      answerHistory.length > 0 ? answerHistory[answerHistory.length - 1] : null,
  };
};

const parseDate = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return parsed;
};

const parseOptionalDate = (value, fieldName) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  return parseDate(value, fieldName);
};

const parseBoolean = (value, fieldName) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new AppError(`${fieldName} must be a boolean`, 400);
};

const parseOptionalBoolean = (value, fieldName) => {
  if (value === undefined) return undefined;
  return parseBoolean(value, fieldName);
};

const parsePeriod = (value) => {
  const normalized = String(value || "WEEKLY")
    .trim()
    .toUpperCase();

  if (!ALLOWED_PERIODS.has(normalized)) {
    throw new AppError("period must be WEEKLY, BIWEEKLY, or MONTHLY", 400);
  }

  return normalized;
};

const sanitizeText = (value, fieldName, maxLength = 4000) => {
  const parsed = String(value || "").trim();
  if (!parsed) {
    throw new AppError(`${fieldName} cannot be empty`, 400);
  }
  if (parsed.length > maxLength) {
    throw new AppError(
      `${fieldName} cannot exceed ${maxLength} characters`,
      400,
    );
  }
  return parsed;
};

const parseQuestionList = (value) => {
  if (!Array.isArray(value)) {
    throw new AppError("questions must be an array", 400);
  }

  if (value.length === 0) {
    throw new AppError("questions must include at least 1 item", 400);
  }

  if (value.length > 50) {
    throw new AppError("questions must include at most 50 items", 400);
  }

  return value.map((item, index) =>
    sanitizeText(item, `questions[${index}]`, 1000),
  );
};

const parseAnswerList = (value, expectedCount) => {
  if (!Array.isArray(value)) {
    throw new AppError("answers must be an array", 400);
  }

  if (value.length !== expectedCount) {
    throw new AppError("answers length must match questions length", 400);
  }

  return value.map((item, index) =>
    sanitizeText(item, `answers[${index}]`, 4000),
  );
};

const addPeriod = (date, period) => {
  const next = new Date(date);
  if (period === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }

  if (period === "BIWEEKLY") {
    next.setUTCDate(next.getUTCDate() + 14);
    return next;
  }

  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
};

const ensureUserExists = async (userId, label) => {
  const row = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true },
  });

  if (!row) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureActiveTrainerClientLink = async (trainerId, clientId) => {
  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: { id: true, status: true },
  });

  if (!relation) {
    throw new AppError("Trainer-client relationship not found", 404);
  }

  if (relation.status !== "ACTIVE") {
    throw new AppError("Trainer-client relationship is not active", 409);
  }
};

const ensureCanAccessCheckIn = (access, item) => {
  if (access.isPrivileged) return;

  const isTrainerOwner =
    access.roles.includes("TRAINER") &&
    String(access.userId) === String(item.trainerId);
  const isClientOwner =
    access.roles.includes("CLIENT") &&
    String(access.userId) === String(item.clientId);

  if (!isTrainerOwner && !isClientOwner) {
    throw new AppError("Forbidden", 403);
  }
};

const ensureCanManageCheckIn = (access, item) => {
  if (access.isPrivileged) return;

  const isTrainerOwner =
    access.roles.includes("TRAINER") &&
    String(access.userId) === String(item.trainerId);

  if (!isTrainerOwner) {
    throw new AppError("Forbidden", 403);
  }
};

export const createCheckIn = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const trainerId = String(req.body.trainerId || access.userId).trim();
    const clientId = String(req.body.clientId || "").trim();

    if (!trainerId || !clientId) {
      return next(new AppError("trainerId and clientId are required", 400));
    }

    if (!access.isPrivileged && String(access.userId) !== String(trainerId)) {
      return next(new AppError("Forbidden", 403));
    }

    const period = parsePeriod(req.body.period);
    const questions = parseQuestionList(req.body.questions);
    const nextDueAtInput = parseOptionalDate(req.body.nextDueAt, "nextDueAt");

    await ensureUserExists(trainerId, "Trainer user");
    await ensureUserExists(clientId, "Client user");
    await ensureActiveTrainerClientLink(trainerId, clientId);

    const now = new Date();
    const nextDueAt = nextDueAtInput || addPeriod(now, period);

    const created = await prisma.checkIn.create({
      data: {
        trainerId,
        clientId,
        period,
        questions,
        answers: [],
        nextDueAt,
        isActive: true,
      },
      select: CHECKIN_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: toCheckInResponse(created),
    });
  } catch (error) {
    return next(error);
  }
};

export const getCheckIns = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "CLIENT", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "nextDueAt",
      defaultOrder: "asc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.has(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = {};

    if (!access.isPrivileged) {
      if (access.roles.includes("TRAINER")) {
        where.trainerId = access.userId;
      } else if (access.roles.includes("CLIENT")) {
        where.clientId = access.userId;
      } else {
        return next(new AppError("Forbidden", 403));
      }
    } else {
      if (req.query.trainerId) where.trainerId = String(req.query.trainerId);
      if (req.query.clientId) where.clientId = String(req.query.clientId);
    }

    if (req.query.period) {
      where.period = parsePeriod(req.query.period);
    }

    if (req.query.isActive !== undefined) {
      where.isActive = parseBoolean(req.query.isActive, "isActive");
    }

    if (
      req.query.dueOnly !== undefined &&
      parseBoolean(req.query.dueOnly, "dueOnly")
    ) {
      where.nextDueAt = { lte: new Date() };
      where.isActive = true;
    }

    const [total, items] = await prisma.$transaction([
      prisma.checkIn.count({ where }),
      prisma.checkIn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort]: order },
        select: CHECKIN_SELECT,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: items.map(toCheckInResponse),
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

export const getCheckInById = async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return next(new AppError("checkIn id is required", 400));
    }

    const access = await getUserAccessContext(req);

    const item = await prisma.checkIn.findUnique({
      where: { id },
      select: CHECKIN_SELECT,
    });

    if (!item) {
      return next(new AppError("Check-in not found", 404));
    }

    ensureCanAccessCheckIn(access, item);

    return res.status(200).json({
      success: true,
      data: toCheckInResponse(item),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateCheckInById = async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return next(new AppError("checkIn id is required", 400));
    }

    const access = await getUserAccessContext(req);

    const existing = await prisma.checkIn.findUnique({
      where: { id },
      select: CHECKIN_SELECT,
    });

    if (!existing) {
      return next(new AppError("Check-in not found", 404));
    }

    ensureCanManageCheckIn(access, existing);

    const data = {};

    if (req.body.period !== undefined) {
      data.period = parsePeriod(req.body.period);
    }

    if (req.body.questions !== undefined) {
      data.questions = parseQuestionList(req.body.questions);
    }

    if (req.body.nextDueAt !== undefined) {
      data.nextDueAt = parseOptionalDate(req.body.nextDueAt, "nextDueAt");
    }

    if (req.body.isActive !== undefined) {
      data.isActive = parseOptionalBoolean(req.body.isActive, "isActive");
    }

    if (Object.keys(data).length === 0) {
      return next(new AppError("No valid fields provided for update", 400));
    }

    const updated = await prisma.checkIn.update({
      where: { id },
      data,
      select: CHECKIN_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: toCheckInResponse(updated),
    });
  } catch (error) {
    return next(error);
  }
};

export const submitCheckInAnswers = async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return next(new AppError("checkIn id is required", 400));
    }

    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["CLIENT"], "Forbidden: client role required");

    const existing = await prisma.checkIn.findUnique({
      where: { id },
      select: CHECKIN_SELECT,
    });

    if (!existing) {
      return next(new AppError("Check-in not found", 404));
    }

    ensureCanAccessCheckIn(access, existing);

    if (!existing.isActive) {
      return next(new AppError("Check-in is inactive", 409));
    }

    const questionList = Array.isArray(existing.questions)
      ? existing.questions
      : [];
    const answerList = parseAnswerList(req.body.answers, questionList.length);

    const submittedAt = new Date();
    const history = Array.isArray(existing.answers)
      ? [...existing.answers]
      : [];
    const questionAnswers = answerList.map((answer, index) => ({
      questionIndex: index,
      question: questionList[index],
      answer,
    }));

    history.push({
      submittedAt: submittedAt.toISOString(),
      answers: questionAnswers,
    });

    const updated = await prisma.checkIn.update({
      where: { id },
      data: {
        answers: history,
        lastAnsweredAt: submittedAt,
        nextDueAt: addPeriod(submittedAt, existing.period),
      },
      select: CHECKIN_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: toCheckInResponse(updated),
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteCheckInById = async (req, res, next) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return next(new AppError("checkIn id is required", 400));
    }

    const access = await getUserAccessContext(req);

    const existing = await prisma.checkIn.findUnique({
      where: { id },
      select: CHECKIN_SELECT,
    });

    if (!existing) {
      return next(new AppError("Check-in not found", 404));
    }

    ensureCanManageCheckIn(access, existing);

    await prisma.checkIn.delete({ where: { id } });

    return res.status(200).json({
      success: true,
      message: "Check-in deleted",
    });
  } catch (error) {
    return next(error);
  }
};
