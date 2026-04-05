import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";

const MAX_ANSWER_LENGTH = 2000;

const INTAKE_QUESTIONS = [
  {
    key: "DIET_OR_NUTRITION_PLAN",
    prompt:
      "Are you currently following any specific diet or nutritional plan?",
  },
  {
    key: "MEDICAL_CONDITIONS",
    prompt:
      "Do you have any medical conditions or injuries that I should be aware of?",
  },
  {
    key: "ACTIVITY_LEVEL",
    prompt: "What is your current level of physical activity?",
  },
  {
    key: "FITNESS_PREFERENCES",
    prompt: "Do you have any fitness preferences or dislikes?",
  },
  {
    key: "TYPICAL_EATING_DAY",
    prompt: "What does a typical day of eating look like for you?",
  },
  {
    key: "TRAINING_TIME_COMMITMENT",
    prompt: "How much time can you commit to training each week?",
  },
  {
    key: "MOTIVATION",
    prompt: "What motivates you to stay committed to your fitness goals?",
  },
  {
    key: "MILESTONES_OR_DEADLINES",
    prompt:
      "Do you have any specific fitness milestones or deadlines you want to achieve?",
  },
  {
    key: "CURRENT_WEIGHT",
    prompt: "Type your weight",
  },
  {
    key: "CURRENT_HEIGHT",
    prompt: "Type your height",
  },
  {
    key: "PRIMARY_FITNESS_GOALS",
    prompt: "What are your primary fitness goals?",
  },
  {
    key: "PREVIOUS_PROGRAM_EXPERIENCE",
    prompt:
      "Do you have any previous experience with personal training or fitness programs?",
  },
];

const QUESTION_KEYS = new Set(INTAKE_QUESTIONS.map((item) => item.key));

const PROMPT_TO_KEY = new Map(
  INTAKE_QUESTIONS.map((item) => [
    item.prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim(),
    item.key,
  ]),
);

const ANSWER_SELECT = {
  id: true,
  trainerId: true,
  clientId: true,
  questionKey: true,
  answer: true,
  updatedAt: true,
};

const normalizePrompt = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeQuestionKey = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new AppError("questionKey is required", 400);
  }

  const enumStyle = raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (QUESTION_KEYS.has(enumStyle)) {
    return enumStyle;
  }

  const mapped = PROMPT_TO_KEY.get(normalizePrompt(raw));
  if (mapped) {
    return mapped;
  }

  throw new AppError(`Unsupported question key: ${raw}`, 400);
};

const sanitizeAnswer = (value) => {
  if (value === undefined || value === null) {
    throw new AppError("answer is required", 400);
  }

  const normalized = String(value).trim();
  if (!normalized) {
    throw new AppError("answer cannot be empty", 400);
  }

  if (normalized.length > MAX_ANSWER_LENGTH) {
    throw new AppError(
      `answer must be at most ${MAX_ANSWER_LENGTH} characters`,
      400,
    );
  }

  return normalized;
};

const ensureUsersExist = async (trainerId, clientId) => {
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [String(trainerId), String(clientId)],
      },
    },
    select: {
      id: true,
    },
  });

  if (users.length !== 2) {
    throw new AppError("Trainer or client user not found", 404);
  }
};

const ensureTrainerClientLink = async (trainerId, clientId) => {
  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: {
      status: true,
    },
  });

  if (!relation) {
    throw new AppError("Trainer-client relationship not found", 404);
  }

  if (relation.status !== "ACTIVE") {
    throw new AppError("Trainer-client relationship is not active", 409);
  }
};

const ensurePairAccess = (access, trainerId, clientId) => {
  if (access.isPrivileged) {
    return;
  }

  const isTrainerOwner =
    access.roles.includes("TRAINER") &&
    String(access.userId) === String(trainerId);
  const isClientOwner =
    access.roles.includes("CLIENT") &&
    String(access.userId) === String(clientId);

  if (!isTrainerOwner && !isClientOwner) {
    throw new AppError("Forbidden", 403);
  }
};

const ensureTrainerScopeAccess = (access, trainerId) => {
  if (access.isPrivileged) {
    return;
  }

  const isTrainerOwner =
    access.roles.includes("TRAINER") &&
    String(access.userId) === String(trainerId);

  if (!isTrainerOwner) {
    throw new AppError("Forbidden", 403);
  }
};

const ensureClientScopeAccess = (access, clientId) => {
  if (access.isPrivileged) {
    return;
  }

  const isClientOwner =
    access.roles.includes("CLIENT") &&
    String(access.userId) === String(clientId);
  const isTrainer = access.roles.includes("TRAINER");

  if (!isClientOwner && !isTrainer) {
    throw new AppError("Forbidden", 403);
  }
};

const parseAnswers = (rawAnswers) => {
  if (!Array.isArray(rawAnswers) || rawAnswers.length === 0) {
    throw new AppError("answers must be a non-empty array", 400);
  }

  const deduped = new Map();

  for (const item of rawAnswers) {
    const key = normalizeQuestionKey(
      item?.questionKey || item?.question || item?.prompt,
    );
    if (deduped.has(key)) {
      continue;
    }

    deduped.set(key, sanitizeAnswer(item?.answer));
  }

  if (deduped.size === 0) {
    throw new AppError("No valid answers found", 400);
  }

  return deduped;
};

export const getIntakeQuestionBank = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER", "CLIENT", "SUPPORT"], "Forbidden");

    return res.status(200).json({
      success: true,
      data: INTAKE_QUESTIONS,
    });
  } catch (error) {
    return next(error);
  }
};

export const upsertClientIntakeAnswers = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "CLIENT"],
      "Forbidden: trainer or client role required",
    );

    const trainerId = String(req.body.trainerId || "").trim();
    const clientId = String(req.body.clientId || "").trim();

    if (!trainerId || !clientId) {
      return next(new AppError("trainerId and clientId are required", 400));
    }

    ensurePairAccess(access, trainerId, clientId);

    await ensureUsersExist(trainerId, clientId);
    await ensureTrainerClientLink(trainerId, clientId);

    const answers = parseAnswers(req.body.answers);

    const saved = await prisma.$transaction(
      Array.from(answers.entries()).map(([questionKey, answer]) =>
        prisma.clientIntakeAnswer.upsert({
          where: {
            trainerId_clientId_questionKey: {
              trainerId,
              clientId,
              questionKey,
            },
          },
          create: {
            trainerId,
            clientId,
            questionKey,
            answer,
          },
          update: {
            answer,
          },
          select: ANSWER_SELECT,
        }),
      ),
    );

    return res.status(200).json({
      success: true,
      data: saved,
      meta: {
        received: req.body.answers.length,
        persisted: saved.length,
        duplicatesSkippedInPayload: req.body.answers.length - saved.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getClientIntakeAnswers = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER", "CLIENT", "SUPPORT"], "Forbidden");

    const { trainerId, clientId } = req.params;

    if (!trainerId || !clientId) {
      return next(new AppError("trainerId and clientId are required", 400));
    }

    ensurePairAccess(access, trainerId, clientId);

    await ensureTrainerClientLink(trainerId, clientId);

    const answers = await prisma.clientIntakeAnswer.findMany({
      where: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
      orderBy: [{ questionKey: "asc" }],
      select: ANSWER_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: answers,
    });
  } catch (error) {
    return next(error);
  }
};

export const getClientIntakeAnswersByTrainerId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER", "SUPPORT"], "Forbidden");

    const { trainerId } = req.params;
    if (!trainerId) {
      return next(new AppError("trainerId is required", 400));
    }

    ensureTrainerScopeAccess(access, trainerId);

    const answers = await prisma.clientIntakeAnswer.findMany({
      where: {
        trainerId: String(trainerId),
      },
      orderBy: [{ clientId: "asc" }, { questionKey: "asc" }],
      select: ANSWER_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: answers,
      meta: {
        count: answers.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getClientIntakeAnswersByClientId = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER", "CLIENT", "SUPPORT"], "Forbidden");

    const { clientId } = req.params;
    if (!clientId) {
      return next(new AppError("clientId is required", 400));
    }

    ensureClientScopeAccess(access, clientId);

    const where = {
      clientId: String(clientId),
    };

    if (!access.isPrivileged && access.roles.includes("TRAINER")) {
      await ensureTrainerClientLink(access.userId, clientId);
      where.trainerId = String(access.userId);
    }

    const answers = await prisma.clientIntakeAnswer.findMany({
      where,
      orderBy: [{ trainerId: "asc" }, { questionKey: "asc" }],
      select: ANSWER_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: answers,
      meta: {
        count: answers.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};
