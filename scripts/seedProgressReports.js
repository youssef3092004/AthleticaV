import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

const DEFAULTS = {
  maxClients: 10,
  maxDaysPerClient: 40,
};

const ensureDatabaseEnv = () => {
  if (
    !process.env.PRISMA_URL &&
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_PRISMA_URL &&
    !process.env.POSTGRES_URL_NON_POOLING &&
    !process.env.POSTGRES_URL &&
    !process.env.SUPABASE_URL
  ) {
    throw new Error(
      "Database URL is missing. Set one of PRISMA_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, or SUPABASE_URL before running seed:progress:reports.",
    );
  }
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const startOfDayUtc = (date = new Date()) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const addDaysUtc = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + Number(days));
  return copy;
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

const upsertConversationForUsers = async (trainerId, clientId) => {
  const first = String(trainerId);
  const second = String(clientId);

  return prisma.conversation.upsert({
    where: {
      trainerId_clientId: {
        trainerId: first,
        clientId: second,
      },
    },
    update: {},
    create: {
      trainerId: first,
      clientId: second,
    },
    select: {
      id: true,
    },
  });
};

const createUniqueMessage = async ({
  conversationId,
  senderId,
  body,
  createdAt,
}) => {
  const existing = await prisma.message.findFirst({
    where: {
      conversationId: String(conversationId),
      senderId: String(senderId),
      body,
      type: "TEXT",
    },
    select: { id: true },
  });

  if (existing) return false;

  await prisma.message.create({
    data: {
      conversationId: String(conversationId),
      senderId: String(senderId),
      body,
      type: "TEXT",
      isRead: false,
      createdAt,
    },
  });

  return true;
};

const main = async () => {
  ensureDatabaseEnv();

  const maxClients = Number(
    process.env.SEED_REPORTS_CLIENTS || DEFAULTS.maxClients,
  );
  const maxDaysPerClient = Number(
    process.env.SEED_REPORTS_DAYS || DEFAULTS.maxDaysPerClient,
  );

  const users = await prisma.user.findMany({
    where: {
      dayPlans: {
        some: {},
      },
    },
    select: {
      id: true,
      name: true,
      trainerClientsAsUser: {
        select: {
          trainerId: true,
          status: true,
        },
        orderBy: {
          startedAt: "asc",
        },
      },
      workoutsAsClient: {
        select: {
          id: true,
          trainerId: true,
          days: {
            orderBy: { date: "asc" },
            select: {
              id: true,
              dayIndex: true,
              date: true,
              totalCount: true,
              completedCount: true,
            },
          },
        },
      },
      clientProfile: {
        select: {
          mealPlans: {
            select: {
              id: true,
              trainerId: true,
              days: {
                orderBy: { date: "asc" },
                select: {
                  id: true,
                  dayIndex: true,
                  date: true,
                  totalCount: true,
                  completedCount: true,
                  totalCalories: true,
                  totalProtein: true,
                  totalCarbs: true,
                  totalFats: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: maxClients,
  });

  let messagesCreated = 0;
  let conversationsTouched = 0;

  for (const user of users) {
    const workout = user.workoutsAsClient[0] || null;
    const mealPlan = user.clientProfile?.mealPlans?.[0] || null;
    const trainerId =
      workout?.trainerId ||
      mealPlan?.trainerId ||
      user.trainerClientsAsUser?.[0]?.trainerId;

    if (!trainerId) {
      continue;
    }

    const conversation = await upsertConversationForUsers(trainerId, user.id);
    conversationsTouched += 1;

    const workoutDays = workout?.days || [];
    const mealDays = mealPlan?.days || [];

    const dates = new Set(
      [
        ...workoutDays.map((day) => toIsoDate(day.date)),
        ...mealDays.map((day) => toIsoDate(day.date)),
      ].filter(Boolean),
    );

    const sortedDates = Array.from(dates).sort().slice(0, maxDaysPerClient);

    for (const dateKey of sortedDates) {
      const workoutDay = workoutDays.find(
        (day) => toIsoDate(day.date) === dateKey,
      );
      const mealPlanDay = mealDays.find(
        (day) => toIsoDate(day.date) === dateKey,
      );

      const isWorkoutComplete =
        workoutDay &&
        Number(workoutDay.totalCount) > 0 &&
        Number(workoutDay.completedCount) >= Number(workoutDay.totalCount);

      const isMealComplete =
        mealPlanDay &&
        Number(mealPlanDay.totalCount) > 0 &&
        Number(mealPlanDay.completedCount) >= Number(mealPlanDay.totalCount);

      if (!isWorkoutComplete && !isMealComplete) {
        continue;
      }

      const date = startOfDayUtc(new Date(`${dateKey}T00:00:00.000Z`));
      if (isWorkoutComplete) {
        const workoutBody = buildWorkoutReportBody(workoutDay);
        const createdWorkout = await createUniqueMessage({
          conversationId: conversation.id,
          senderId: user.id,
          body: workoutBody,
          createdAt: addDaysUtc(date, 0),
        });

        if (createdWorkout) {
          messagesCreated += 1;
        }
      }

      if (isMealComplete) {
        const nutritionBody = buildNutritionReportBody(mealPlanDay);
        const createdNutrition = await createUniqueMessage({
          conversationId: conversation.id,
          senderId: user.id,
          body: nutritionBody,
          createdAt: addDaysUtc(date, 0),
        });

        if (createdNutrition) {
          messagesCreated += 1;
        }
      }
    }
  }

  console.log("Progress report message seed completed successfully");
  console.log(`Conversations touched: ${conversationsTouched}`);
  console.log(`Messages created: ${messagesCreated}`);
};

main()
  .catch((error) => {
    console.error("seed:progress:reports failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
