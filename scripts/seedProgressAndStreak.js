import "dotenv/config";
import bcrypt from "bcrypt";
import process from "process";
import { prisma } from "../configs/db.js";
import { calculateUserStreak } from "../utils/streakService.js";

const TRAINER = {
  name: "Progress Seed Trainer",
  phone: "+201011110000",
  email: "progress.seed.trainer@athletica.local",
  password: "Trainer@123",
};

const DEFAULTS = {
  clientsCount: 6,
  daysPerClient: 35,
  workoutItemsPerDay: 3,
  mealItemsPerDay: 4,
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

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pickMany = (items, count) => {
  if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, items.length));
};

const toPercentage = (completed, total) => {
  if (!total) return 0;
  return Number(((completed / total) * 100).toFixed(2));
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
      "Database URL is missing. Set one of PRISMA_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, or SUPABASE_URL.",
    );
  }
};

const parseConfig = () => {
  return {
    clientsCount: Number(
      process.env.SEED_PROGRESS_CLIENTS || DEFAULTS.clientsCount,
    ),
    daysPerClient: Number(
      process.env.SEED_PROGRESS_DAYS || DEFAULTS.daysPerClient,
    ),
    workoutItemsPerDay: Number(
      process.env.SEED_PROGRESS_WORKOUT_ITEMS || DEFAULTS.workoutItemsPerDay,
    ),
    mealItemsPerDay: Number(
      process.env.SEED_PROGRESS_MEAL_ITEMS || DEFAULTS.mealItemsPerDay,
    ),
  };
};

const upsertUser = async ({ name, phone, email, password }) => {
  const hashedPassword = await bcrypt.hash(
    password,
    Number(process.env.SALT_ROUNDS || 10),
  );

  return prisma.user.upsert({
    where: { phone },
    update: {
      name,
      email,
      password: hashedPassword,
      isVerified: true,
    },
    create: {
      name,
      phone,
      email,
      password: hashedPassword,
      isVerified: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
    },
  });
};

const attachRoleIfExists = async (userId, roleName) => {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.warn(`Role '${roleName}' not found. Run npm run seed:rbac first.`);
    return;
  }

  await prisma.userRole.createMany({
    data: [{ userId, roleId: role.id }],
    skipDuplicates: true,
  });
};

const ensureClientProfile = async (clientId) => {
  const existing = await prisma.clientProfile.findUnique({
    where: { clientId },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.clientProfile.create({
    data: {
      clientId,
      age: 27,
      fitnessGoal: "General fitness and consistency",
      dietaryNotes: "Auto-seeded profile",
    },
    select: { id: true },
  });
};

const ensureTrainerClientLink = async (trainerId, clientId) => {
  await prisma.trainerClient.upsert({
    where: {
      trainerId_clientId: {
        trainerId,
        clientId,
      },
    },
    update: {
      status: "ACTIVE",
      startedAt: new Date(),
    },
    create: {
      trainerId,
      clientId,
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });
};

const ensurePrerequisites = async () => {
  const exercises = await prisma.exercise.findMany({
    where: {
      is_default: true,
    },
    select: {
      id: true,
    },
    take: 50,
  });

  const fallbackExercises =
    exercises.length > 0
      ? exercises
      : await prisma.exercise.findMany({
          select: { id: true },
          take: 50,
        });

  if (!fallbackExercises.length) {
    throw new Error(
      "No exercises found. Run npm run seed:exercises:file before seeding progress.",
    );
  }

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
          name: true,
          baseGrams: true,
          calories: true,
          protein: true,
          carbs: true,
          fat: true,
        },
      },
    },
    take: 200,
  });

  if (!portions.length) {
    throw new Error("No food portions found. Run npm run seed:foods first.");
  }

  return {
    exercises: fallbackExercises,
    portions,
  };
};

const computeDailyCompletionPattern = (dayIndex) => {
  // Deterministic, varied behavior to test streak edges.
  const marker = dayIndex % 10;

  // Missed day (resets streak)
  if (marker === 5) {
    return {
      workoutFullyCompleted: false,
      nutritionFullyCompleted: false,
      workoutPartial: true,
      nutritionPartial: true,
    };
  }

  // Partial nutrition day
  if (marker === 7) {
    return {
      workoutFullyCompleted: true,
      nutritionFullyCompleted: false,
      workoutPartial: false,
      nutritionPartial: true,
    };
  }

  // Full completion day
  return {
    workoutFullyCompleted: true,
    nutritionFullyCompleted: true,
    workoutPartial: false,
    nutritionPartial: false,
  };
};

const seedClientProgress = async ({
  trainer,
  client,
  clientProfile,
  config,
  exercises,
  portions,
}) => {
  const startDate = startOfDayUtc(
    addDaysUtc(new Date(), -config.daysPerClient + 1),
  );

  const workout = await prisma.workout.create({
    data: {
      trainerId: trainer.id,
      clientId: client.id,
      startDate,
      endDate: addDaysUtc(startDate, config.daysPerClient - 1),
      totalCount: 0,
      completedCount: 0,
    },
    select: { id: true },
  });

  const mealPlan = await prisma.mealPlan.create({
    data: {
      trainerId: trainer.id,
      clientProfileId: clientProfile.id,
      status: "ACTIVE",
      title: `Bulk Progress Plan - ${client.name}`,
      notes: "Generated by seedProgressAndStreak",
      startDate,
      endDate: addDaysUtc(startDate, config.daysPerClient - 1),
      totalCount: 0,
      completedCount: 0,
      percentage: 0,
    },
    select: { id: true },
  });

  let workoutTotalCount = 0;
  let workoutCompletedCount = 0;
  let mealTotalCount = 0;
  let mealCompletedCount = 0;

  for (let dayIndex = 0; dayIndex < config.daysPerClient; dayIndex += 1) {
    const date = addDaysUtc(startDate, dayIndex);
    const hasWorkout = dayIndex % 6 !== 2; // some nutrition-only days
    const hasNutrition = dayIndex % 11 !== 3; // some workout-only days

    const pattern = computeDailyCompletionPattern(dayIndex);

    if (hasWorkout) {
      const day = await prisma.workoutDay.create({
        data: {
          workoutId: workout.id,
          dayIndex,
          date,
          title: `Day ${dayIndex + 1}`,
          totalCount: config.workoutItemsPerDay,
          completedCount: 0,
        },
        select: { id: true },
      });

      const selectedExercises = pickMany(exercises, config.workoutItemsPerDay);

      const items = await Promise.all(
        selectedExercises.map((exercise, index) =>
          prisma.workoutItem.create({
            data: {
              workoutDayId: day.id,
              exerciseId: exercise.id,
              sets: randomInt(3, 5),
              reps: randomInt(6, 12),
              restSeconds: randomInt(45, 120),
              order: index,
              notes: "Seeded workout item",
            },
            select: { id: true },
          }),
        ),
      );

      workoutTotalCount += items.length;

      const completeAll = pattern.workoutFullyCompleted;
      const partial = pattern.workoutPartial;
      const completionTarget = completeAll
        ? items.length
        : partial
          ? Math.max(1, Math.floor(items.length / 2))
          : 0;

      const completedItems = pickMany(items, completionTarget);

      if (completedItems.length > 0) {
        await prisma.workoutCompletion.createMany({
          data: completedItems.map((item) => ({
            workoutItemId: item.id,
            clientId: client.id,
            completedAt: new Date(),
            loggedSets: randomInt(2, 5),
            loggedReps: randomInt(8, 30),
            loggedWeightKg: randomInt(40, 100),
            note: "Seed completion",
          })),
          skipDuplicates: true,
        });
      }

      workoutCompletedCount += completedItems.length;

      await prisma.workoutDay.update({
        where: { id: day.id },
        data: {
          completedCount: completedItems.length,
        },
      });
    }

    if (hasNutrition) {
      const day = await prisma.mealPlanDay.create({
        data: {
          mealPlanId: mealPlan.id,
          dayIndex,
          date,
          totalCount: config.mealItemsPerDay,
          completedCount: 0,
          percentage: 0,
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFats: 0,
        },
        select: { id: true },
      });

      const selectedPortions = pickMany(portions, config.mealItemsPerDay);
      const itemIds = [];

      for (let i = 0; i < selectedPortions.length; i += 1) {
        const portion = selectedPortions[i];
        const quantity = randomInt(1, 2);
        const factor =
          portion.food.baseGrams > 0
            ? (Number(portion.grams) / Number(portion.food.baseGrams)) *
              quantity
            : 0;

        const created = await prisma.mealPlanItem.create({
          data: {
            mealPlanDayId: day.id,
            foodId: portion.foodId,
            portionId: portion.id,
            quantity,
            mealTime: ["BREAKFAST", "LUNCH", "DINNER", "EVENING_SNACK"][i % 4],
            sortOrder: i,
            note: "Seed meal item",
            foodNameSnapshot: portion.food.name,
            portionLabelSnapshot: portion.label,
            gramsPerPortion: Number(portion.grams),
            caloriesSnapshot: Number(portion.food.calories) * factor,
            proteinSnapshot: Number(portion.food.protein) * factor,
            carbsSnapshot: Number(portion.food.carbs) * factor,
            fatSnapshot: Number(portion.food.fat) * factor,
          },
          select: {
            id: true,
            caloriesSnapshot: true,
            proteinSnapshot: true,
            carbsSnapshot: true,
            fatSnapshot: true,
          },
        });

        itemIds.push(created);
      }

      mealTotalCount += itemIds.length;

      const completeAll = pattern.nutritionFullyCompleted;
      const partial = pattern.nutritionPartial;
      const completionTarget = completeAll
        ? itemIds.length
        : partial
          ? Math.max(1, Math.floor(itemIds.length / 2))
          : 0;

      const completedItems = pickMany(itemIds, completionTarget);

      if (completedItems.length > 0) {
        await prisma.mealCompletion.createMany({
          data: completedItems.map((item) => ({
            mealPlanItemId: item.id,
            clientId: client.id,
            completedAt: new Date(),
            note: "Seed meal completion",
          })),
          skipDuplicates: true,
        });
      }

      mealCompletedCount += completedItems.length;

      const nutritionTotals = completedItems.reduce(
        (acc, item) => {
          acc.totalCalories += Number(item.caloriesSnapshot || 0);
          acc.totalProtein += Number(item.proteinSnapshot || 0);
          acc.totalCarbs += Number(item.carbsSnapshot || 0);
          acc.totalFats += Number(item.fatSnapshot || 0);
          return acc;
        },
        { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFats: 0 },
      );

      await prisma.mealPlanDay.update({
        where: { id: day.id },
        data: {
          completedCount: completedItems.length,
          percentage: toPercentage(completedItems.length, itemIds.length),
          totalCalories: Number(nutritionTotals.totalCalories.toFixed(2)),
          totalProtein: Number(nutritionTotals.totalProtein.toFixed(2)),
          totalCarbs: Number(nutritionTotals.totalCarbs.toFixed(2)),
          totalFats: Number(nutritionTotals.totalFats.toFixed(2)),
        },
      });
    }
  }

  await prisma.workout.update({
    where: { id: workout.id },
    data: {
      totalCount: workoutTotalCount,
      completedCount: workoutCompletedCount,
    },
  });

  await prisma.mealPlan.update({
    where: { id: mealPlan.id },
    data: {
      totalCount: mealTotalCount,
      completedCount: mealCompletedCount,
      percentage: toPercentage(mealCompletedCount, mealTotalCount),
    },
  });

  const streak = await calculateUserStreak(client.id);

  return {
    clientId: client.id,
    workoutId: workout.id,
    mealPlanId: mealPlan.id,
    streak,
  };
};

const main = async () => {
  ensureDatabaseEnv();

  // Establish connection before starting operations
  try {
    await prisma.$connect();
    console.log("Database connected for Progress and Streak seed");
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    throw err;
  }

  const config = parseConfig();

  const trainer = await upsertUser(TRAINER);
  await attachRoleIfExists(trainer.id, "TRAINER");

  const { exercises, portions } = await ensurePrerequisites();

  console.log(
    `Seeding bulk progress for ${config.clientsCount} clients x ${config.daysPerClient} days...`,
  );

  const results = [];

  for (let i = 0; i < config.clientsCount; i += 1) {
    const clientSeed = {
      name: `Progress Seed Client ${i + 1}`,
      phone: `+20102222${String(i + 1).padStart(4, "0")}`,
      email: `progress.seed.client.${i + 1}@athletica.local`,
      password: "Client@123",
    };

    const client = await upsertUser(clientSeed);
    await attachRoleIfExists(client.id, "CLIENT");
    const clientProfile = await ensureClientProfile(client.id);
    await ensureTrainerClientLink(trainer.id, client.id);

    const seeded = await seedClientProgress({
      trainer,
      client,
      clientProfile,
      config,
      exercises,
      portions,
    });

    results.push(seeded);
    console.log(
      `Client ${i + 1}/${config.clientsCount} seeded. Streak: ${seeded.streak.currentStreak} (longest ${seeded.streak.longestStreak})`,
    );
  }

  console.log("\nBulk progress seeding complete.");
  console.table(
    results.map((row) => ({
      clientId: row.clientId,
      workoutId: row.workoutId,
      mealPlanId: row.mealPlanId,
      currentStreak: row.streak.currentStreak,
      longestStreak: row.streak.longestStreak,
      lastCompletedDate: row.streak.lastCompletedDate,
    })),
  );
};

main()
  .catch((error) => {
    console.error("seed:progress:bulk failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
