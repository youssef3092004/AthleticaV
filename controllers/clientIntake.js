import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { ensureHasAnyRole, getUserAccessContext } from "../utils/authz.js";
import {
  CLIENT_INTAKE_QUESTION_GROUPS,
  CLIENT_INTAKE_QUESTIONS,
  CLIENT_INTAKE_REQUIRED_KEYS,
  buildClientIntakeStatus,
  normalizeClientIntakeAnswer,
  normalizeClientIntakeQuestionKey,
  parseClientIntakeAnswers,
} from "../utils/clientIntakeQuestions.js";

const INTAKE_SELECT = {
  id: true,
  clientId: true,
  answers: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
};

const getCurrentClientId = (access) => {
  if (!access?.roles?.includes("CLIENT")) {
    throw new AppError("Client role required", 403);
  }

  return String(access.userId);
};

const ensureClientExists = async (clientId) => {
  const client = await prisma.user.findUnique({
    where: { id: String(clientId) },
    select: { id: true },
  });

  if (!client) {
    throw new AppError("Client user not found", 404);
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

const normalizeStoredAnswers = (value) => {
  const answerMap = new Map();

  if (!value) {
    return answerMap;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const questionKey = normalizeClientIntakeQuestionKey(
        item?.questionKey || item?.key || item?.question || item?.prompt,
      );
      const answer = normalizeClientIntakeAnswer(item?.answer);

      if (questionKey && answer !== null) {
        answerMap.set(questionKey, answer);
      }
    }

    return answerMap;
  }

  if (typeof value === "object") {
    for (const [questionKeyRaw, answerRaw] of Object.entries(value)) {
      const questionKey = normalizeClientIntakeQuestionKey(questionKeyRaw);
      const answer = normalizeClientIntakeAnswer(answerRaw);

      if (questionKey && answer !== null) {
        answerMap.set(questionKey, answer);
      }
    }
  }

  return answerMap;
};

const buildQuestionAnswerList = (answerMap) =>
  CLIENT_INTAKE_QUESTIONS.map((question) => ({
    ...question,
    answer: answerMap.has(question.key) ? answerMap.get(question.key) : null,
  }));

const buildIntakeResponse = (record) => {
  const answerMap = normalizeStoredAnswers(record?.answers);
  const status = buildClientIntakeStatus(answerMap);

  return {
    id: record?.id || null,
    clientId: record?.clientId || null,
    questions: CLIENT_INTAKE_QUESTION_GROUPS,
    questionBank: CLIENT_INTAKE_QUESTIONS,
    answers: Object.fromEntries(answerMap.entries()),
    questionAnswers: buildQuestionAnswerList(answerMap),
    status,
    completedAt: record?.completedAt || null,
    createdAt: record?.createdAt || null,
    updatedAt: record?.updatedAt || null,
  };
};

const extractIncomingAnswers = (body = {}) => {
  if (body.answers !== undefined) {
    return body.answers;
  }

  if (
    body.questionKey !== undefined ||
    body.key !== undefined ||
    body.prompt !== undefined
  ) {
    return [
      {
        questionKey: body.questionKey ?? body.key ?? body.prompt,
        answer: body.answer ?? body.value,
      },
    ];
  }

  return null;
};

export const getIntakeQuestionBank = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["CLIENT", "TRAINER", "SUPPORT"], "Forbidden");

    return res.status(200).json({
      success: true,
      data: {
        sections: CLIENT_INTAKE_QUESTION_GROUPS,
        questions: CLIENT_INTAKE_QUESTIONS,
        requiredQuestionKeys: Array.from(CLIENT_INTAKE_REQUIRED_KEYS),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const upsertClientIntakeAnswers = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["CLIENT"], "Forbidden: client role required");

    const clientId = getCurrentClientId(access);
    await ensureClientExists(clientId);

    const incomingAnswers = extractIncomingAnswers(req.body || {});
    const parsedAnswers = parseClientIntakeAnswers(incomingAnswers);

    if (parsedAnswers.size === 0) {
      throw new AppError("No valid answers found", 400);
    }

    const existing = await prisma.clientIntake.findUnique({
      where: { clientId },
      select: INTAKE_SELECT,
    });

    const mergedAnswers = new Map(normalizeStoredAnswers(existing?.answers));

    for (const [questionKey, answer] of parsedAnswers.entries()) {
      mergedAnswers.set(questionKey, answer);
    }

    const status = buildClientIntakeStatus(mergedAnswers);
    const completedAt = status.isComplete
      ? existing?.completedAt || new Date()
      : existing?.completedAt || null;

    const saved = await prisma.clientIntake.upsert({
      where: { clientId },
      create: {
        clientId,
        answers: Object.fromEntries(mergedAnswers.entries()),
        completedAt,
      },
      update: {
        answers: Object.fromEntries(mergedAnswers.entries()),
        completedAt,
      },
      select: INTAKE_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: buildIntakeResponse(saved),
      meta: {
        received: parsedAnswers.size,
        stored: mergedAnswers.size,
        isComplete: status.isComplete,
        missingRequiredQuestionKeys: status.missingRequiredQuestionKeys,
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getMyClientIntakeStatus = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["CLIENT"], "Forbidden: client role required");

    const clientId = getCurrentClientId(access);

    const intake = await prisma.clientIntake.findUnique({
      where: { clientId },
      select: INTAKE_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: buildIntakeResponse(intake),
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

    if (!access.isPrivileged) {
      const isTrainerOwner =
        access.roles.includes("TRAINER") &&
        String(access.userId) === String(trainerId);
      const isClientOwner =
        access.roles.includes("CLIENT") &&
        String(access.userId) === String(clientId);

      if (!isTrainerOwner && !isClientOwner) {
        return next(new AppError("Forbidden", 403));
      }
    }

    await ensureTrainerClientLink(trainerId, clientId);

    const intake = await prisma.clientIntake.findUnique({
      where: { clientId: String(clientId) },
      select: INTAKE_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: buildIntakeResponse(intake),
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

    const trainerClients = await prisma.trainerClient.findMany({
      where: {
        trainerId: String(trainerId),
        status: "ACTIVE",
      },
      select: {
        clientId: true,
      },
    });

    const clientIds = trainerClients.map((relation) => relation.clientId);

    const intakes = clientIds.length
      ? await prisma.clientIntake.findMany({
          where: {
            clientId: {
              in: clientIds,
            },
          },
          orderBy: [{ updatedAt: "desc" }],
          select: INTAKE_SELECT,
        })
      : [];

    const responses = intakes.map((intake) => buildIntakeResponse(intake));

    return res.status(200).json({
      success: true,
      data: {
        trainerId,
        responses,
      },
      meta: {
        count: responses.length,
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

    if (!access.isPrivileged) {
      const isClientOwner =
        access.roles.includes("CLIENT") &&
        String(access.userId) === String(clientId);
      const isTrainer = access.roles.includes("TRAINER");

      if (!isClientOwner && !isTrainer) {
        return next(new AppError("Forbidden", 403));
      }

      if (isTrainer) {
        await ensureTrainerClientLink(access.userId, clientId);
      }
    }

    const intake = await prisma.clientIntake.findUnique({
      where: { clientId: String(clientId) },
      select: INTAKE_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: buildIntakeResponse(intake),
    });
  } catch (error) {
    return next(error);
  }
};
