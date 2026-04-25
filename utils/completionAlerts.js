import { prisma } from "../configs/db.js";

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const toPercent = (completed, total) => {
  const scopedTotal = Number(total) || 0;
  const scopedCompleted = Number(completed) || 0;

  if (scopedTotal <= 0) return 0;
  return Number(((scopedCompleted / scopedTotal) * 100).toFixed(2));
};

const formatNumber = (value) => Number(Number(value || 0).toFixed(2));

const buildWorkoutReportBody = (dayStatus) => {
  const dayLabel = Number(dayStatus.dayIndex) + 1;
  const dateLabel = toIsoDate(dayStatus.date) || "unknown date";
  const completed = Number(dayStatus.completedCount) || 0;
  const total = Number(dayStatus.totalCount) || 0;
  const percentage = toPercent(completed, total);

  return [
    `Daily report: Workout Day ${dayLabel} (${dateLabel})`,
    `Completed exercises: ${completed}/${total} (${percentage}%).`,
  ].join("\n");
};

const buildNutritionReportBody = (dayStatus) => {
  const dayLabel = Number(dayStatus.dayIndex) + 1;
  const dateLabel = toIsoDate(dayStatus.date) || "unknown date";
  const completed = Number(dayStatus.completedCount) || 0;
  const total = Number(dayStatus.totalCount) || 0;
  const percentage = toPercent(completed, total);

  return [
    `Daily report: Nutrition Day ${dayLabel} (${dateLabel})`,
    `Completed meals: ${completed}/${total} (${percentage}%).`,
    `Nutrition totals: ${formatNumber(dayStatus.totalCalories)} kcal | P ${formatNumber(dayStatus.totalProtein)}g | C ${formatNumber(dayStatus.totalCarbs)}g | F ${formatNumber(dayStatus.totalFats)}g.`,
  ].join("\n");
};

const upsertConversationForUsers = async (userAId, userBId) => {
  const first = String(userAId);
  const second = String(userBId);

  const trainerId = first > second ? second : first;
  const clientId = first > second ? first : second;

  return prisma.conversation.upsert({
    where: {
      trainerId_clientId: {
        trainerId,
        clientId,
      },
    },
    update: {},
    create: {
      trainerId,
      clientId,
    },
    select: {
      id: true,
    },
  });
};

const createMessageIfNotExists = async ({ conversationId, senderId, body }) => {
  const existing = await prisma.message.findFirst({
    where: {
      conversationId: String(conversationId),
      senderId: String(senderId),
      body,
      type: "TEXT",
    },
    select: {
      id: true,
    },
  });

  if (existing) return false;

  await prisma.message.create({
    data: {
      conversationId: String(conversationId),
      senderId: String(senderId),
      body,
      type: "TEXT",
    },
  });

  return true;
};

export const getWorkoutDayCompletionStatus = async (workoutDayId) => {
  const day = await prisma.workoutDay.findUnique({
    where: { id: String(workoutDayId) },
    select: {
      id: true,
      workoutId: true,
      dayIndex: true,
      date: true,
      totalCount: true,
      completedCount: true,
      workout: {
        select: {
          trainerId: true,
          clientId: true,
        },
      },
    },
  });

  if (!day) return null;

  return {
    ...day,
    isCompleted:
      Number(day.totalCount) > 0 && day.completedCount >= day.totalCount,
  };
};

export const getMealPlanDayCompletionStatus = async (mealPlanDayId) => {
  const day = await prisma.mealPlanDay.findUnique({
    where: { id: String(mealPlanDayId) },
    select: {
      id: true,
      mealPlanId: true,
      dayIndex: true,
      date: true,
      totalCount: true,
      completedCount: true,
      mealPlan: {
        select: {
          trainerId: true,
          clientProfile: {
            select: {
              clientId: true,
            },
          },
        },
      },
      totalCalories: true,
      totalProtein: true,
      totalCarbs: true,
      totalFats: true,
    },
  });

  if (!day) return null;

  const clientId = day.mealPlan?.clientProfile?.clientId;

  return {
    ...day,
    clientId,
    trainerId: day.mealPlan?.trainerId,
    isCompleted:
      Number(day.totalCount) > 0 && day.completedCount >= day.totalCount,
  };
};

export const maybeNotifyTrainerWorkoutDayCompleted = async ({
  before,
  after,
}) => {
  if (!after?.isCompleted) return false;
  if (before?.isCompleted) return false;

  const trainerId = after.workout?.trainerId;
  const clientId = after.workout?.clientId;
  if (!trainerId || !clientId) return false;

  const body = buildWorkoutReportBody(after);

  const conversation = await upsertConversationForUsers(trainerId, clientId);

  return createMessageIfNotExists({
    conversationId: conversation.id,
    senderId: clientId,
    body,
  });
};

export const maybeNotifyTrainerMealPlanDayCompleted = async ({
  before,
  after,
}) => {
  if (!after?.isCompleted) return false;
  if (before?.isCompleted) return false;

  const trainerId = after.trainerId;
  const clientId = after.clientId;
  if (!trainerId || !clientId) return false;

  const body = buildNutritionReportBody(after);

  const conversation = await upsertConversationForUsers(trainerId, clientId);

  return createMessageIfNotExists({
    conversationId: conversation.id,
    senderId: clientId,
    body,
  });
};
