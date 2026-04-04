import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toRoundedPercentage = (completedCount, totalCount) => {
  if (!totalCount || totalCount <= 0) return 0;
  return Number(((completedCount / totalCount) * 100).toFixed(2));
};
const pickRandomSubset = (items, count) => {
  if (count <= 0 || items.length === 0) return [];
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
};

const MEAL_TIMES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "EVENING_SNACK",
];

const QUANTITIES = [1, 1.5, 2];

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const pickRandom = (arr) => arr[randomInt(0, arr.length - 1)];

const startOfDayUtc = (date = new Date()) => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

const addDaysUtc = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + Number(days));
  return copy;
};

const pickTrainer = async () => {
  const trainer = await prisma.user.findFirst({
    where: {
      userRoles: {
        some: {
          role: {
            name: "TRAINER",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!trainer) {
    throw new Error("No TRAINER user found. Run npm run seed:workout first.");
  }

  return trainer;
};

const pickClientProfileForTrainer = async (trainerId) => {
  const directLink = await prisma.trainerClient.findFirst({
    where: {
      trainerId: String(trainerId),
      status: "ACTIVE",
    },
    select: {
      clientId: true,
    },
    orderBy: {
      startedAt: "asc",
    },
  });

  if (directLink) {
    const profile = await prisma.clientProfile.findUnique({
      where: {
        clientId: directLink.clientId,
      },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (profile) {
      return profile;
    }
  }

  const profile = await prisma.clientProfile.findFirst({
    select: {
      id: true,
      clientId: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!profile) {
    throw new Error(
      "No ClientProfile found. Run npm run seed:client-profile first.",
    );
  }

  await prisma.trainerClient.upsert({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(profile.clientId),
      },
    },
    update: {
      status: "ACTIVE",
      startedAt: new Date(),
    },
    create: {
      trainerId: String(trainerId),
      clientId: String(profile.clientId),
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  return profile;
};

const ensurePortions = async () => {
  const portions = await prisma.foodPortion.findMany({
    where: {
      food: {
        isArchived: false,
      },
    },
    select: {
      id: true,
      foodId: true,
      label: true,
      grams: true,
      food: {
        select: {
          id: true,
          name: true,
          baseGrams: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
          isArchived: true,
        },
      },
    },
  });

  if (portions.length < 12) {
    throw new Error(
      "Not enough active portions. Run npm run seed:foods first.",
    );
  }

  return portions;
};

const buildDayItems = (portions, dayIndex) => {
  const itemCount = randomInt(3, 5);
  const usedPortionIds = new Set();
  const sortOrderByMealTime = new Map();
  const items = [];

  for (let i = 0; i < itemCount; i += 1) {
    let selected = null;
    let attempts = 0;

    while (!selected && attempts < 25) {
      const candidate = pickRandom(portions);
      if (!usedPortionIds.has(candidate.id)) {
        selected = candidate;
        usedPortionIds.add(candidate.id);
      }
      attempts += 1;
    }

    if (!selected) {
      selected = pickRandom(portions);
    }

    const mealTime = MEAL_TIMES[(dayIndex + i) % MEAL_TIMES.length];
    const sortOrder = sortOrderByMealTime.get(mealTime) || 0;
    sortOrderByMealTime.set(mealTime, sortOrder + 1);

    const quantity = pickRandom(QUANTITIES);
    const gramsPerPortion = Number(selected.grams || 0);
    const baseGrams = Number(selected.food.baseGrams || 100);
    const factor = baseGrams > 0 ? (gramsPerPortion / baseGrams) * quantity : 0;

    items.push({
      foodId: selected.foodId,
      portionId: selected.id,
      quantity,
      mealTime,
      sortOrder,
      note: `Seed scratch item for ${mealTime.toLowerCase()}`,
      foodNameSnapshot: selected.food.name,
      portionLabelSnapshot: selected.label,
      gramsPerPortion,
      caloriesSnapshot: Number(selected.food.calories) * factor,
      proteinSnapshot: Number(selected.food.protein) * factor,
      carbsSnapshot: Number(selected.food.carbs) * factor,
      fatSnapshot: Number(selected.food.fat) * factor,
    });
  }

  return items;
};

const createMealPlanFromScratch = async ({
  trainer,
  clientProfile,
  portions,
}) => {
  const completionRatio = clamp(
    Number(process.env.SEED_MEAL_COMPLETION_RATIO ?? 0.4),
    0,
    1,
  );

  const startDate = startOfDayUtc();
  const daysCount = Number(process.env.SEED_MEAL_PLAN_DAYS || 7);
  const endDate = addDaysUtc(startDate, daysCount - 1);

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.create({
      data: {
        sourceMealTemplateId: null,
        trainerId: trainer.id,
        clientProfileId: clientProfile.id,
        status: "ACTIVE",
        title: `Seed Scratch Plan ${new Date().toISOString().slice(0, 10)}`,
        notes: "Generated by seedMealPlanFromScratch.js",
        startDate,
        endDate,
        totalCount: 0,
        completedCount: 0,
        percentage: 0,
      },
      select: {
        id: true,
      },
    });

    let planTotalCount = 0;
    let planCompletedCount = 0;

    for (let dayIndex = 0; dayIndex < daysCount; dayIndex += 1) {
      const items = buildDayItems(portions, dayIndex);
      const dayTotalCount = items.length;
      planTotalCount += dayTotalCount;

      const day = await tx.mealPlanDay.create({
        data: {
          mealPlanId: plan.id,
          dayIndex,
          date: addDaysUtc(startDate, dayIndex),
          completedCount: 0,
          totalCount: dayTotalCount,
          percentage: 0,
        },
        select: {
          id: true,
        },
      });

      await tx.mealPlanItem.createMany({
        data: items.map((item) => ({
          mealPlanDayId: day.id,
          ...item,
        })),
      });

      const createdItems = await tx.mealPlanItem.findMany({
        where: {
          mealPlanDayId: day.id,
        },
        select: {
          id: true,
        },
      });

      const completionCountTarget = Math.floor(
        createdItems.length * completionRatio,
      );
      const completedItems = pickRandomSubset(
        createdItems,
        completionCountTarget,
      );

      if (completedItems.length) {
        await tx.mealCompletion.createMany({
          data: completedItems.map((item) => ({
            mealPlanItemId: item.id,
            clientId: clientProfile.clientId,
            completedAt: new Date(),
            note: "Seed completion",
          })),
          skipDuplicates: true,
        });
      }

      const dayCompletedCount = completedItems.length;
      planCompletedCount += dayCompletedCount;

      await tx.mealPlanDay.update({
        where: { id: day.id },
        data: {
          completedCount: dayCompletedCount,
          percentage: toRoundedPercentage(dayCompletedCount, dayTotalCount),
        },
      });
    }

    const planPercentage = toRoundedPercentage(
      planCompletedCount,
      planTotalCount,
    );

    await tx.mealPlan.update({
      where: {
        id: plan.id,
      },
      data: {
        totalCount: planTotalCount,
        completedCount: planCompletedCount,
        percentage: planPercentage,
      },
    });

    return {
      planId: plan.id,
      daysCount,
      totalCount: planTotalCount,
      completedCount: planCompletedCount,
      percentage: planPercentage,
    };
  }, TRANSACTION_OPTIONS);

  return result;
};

const main = async () => {
  const trainer = await pickTrainer();
  const clientProfile = await pickClientProfileForTrainer(trainer.id);
  const portions = await ensurePortions();

  const created = await createMealPlanFromScratch({
    trainer,
    clientProfile,
    portions,
  });

  console.log("Meal plan (from scratch) seed completed successfully");
  console.log(`Plan ID: ${created.planId}`);
  console.log(`Trainer: ${trainer.name || trainer.email || trainer.id}`);
  console.log(`Client profile: ${clientProfile.id}`);
  console.log(`Days: ${created.daysCount}`);
  console.log(`Total items: ${created.totalCount}`);
  console.log(`Completed items: ${created.completedCount}`);
  console.log(`Plan percentage: ${created.percentage}%`);
};

main()
  .catch((error) => {
    console.error("Meal plan from scratch seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
