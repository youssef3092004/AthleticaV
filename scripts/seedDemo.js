import "dotenv/config";
import bcrypt from "bcrypt";
import process from "process";
import { prisma } from "../configs/db.js";
import { recalcWorkoutDayAndSummary } from "../utils/workoutProgress.js";
import { recalcMealPlanDayAndSummary } from "../utils/mealPlanProgress.js";

// ============================================================================
// DEMO DATA: Fixed trainer (Ahmed) + 6 active clients + Sara (for invite flow)
// ============================================================================

const AHMED_TRAINER = {
  name: "Ahmed",
  phone: "+201000000001",
  email: "ahmed.trainer@athletica.demo",
  password: "AhmedTrainer@123",
  specialization: "Strength & Conditioning",
  bio: "Certified strength coach with 10+ years experience",
  hourlyRate: 50,
};

const DEMO_CLIENTS = [
  {
    name: "Fatima Mohamed",
    phone: "+201000000101",
    email: "fatima@athletica.demo",
    password: "Fatima@123",
    age: 28,
    goal: "Weight Loss",
    fitnessLevel: "Intermediate",
    injuries: "None",
  },
  {
    name: "Hassan Ali",
    phone: "+201000000102",
    email: "hassan@athletica.demo",
    password: "Hassan@123",
    age: 32,
    goal: "Muscle Gain",
    fitnessLevel: "Advanced",
    injuries: "None",
  },
  {
    name: "Layla Karim",
    phone: "+201000000103",
    email: "layla@athletica.demo",
    password: "Layla@123",
    age: 25,
    goal: "General Fitness",
    fitnessLevel: "Beginner",
    injuries: "None",
  },
  {
    name: "Omar Hani",
    phone: "+201000000104",
    email: "omar@athletica.demo",
    password: "Omar@123",
    age: 35,
    goal: "Strength",
    fitnessLevel: "Advanced",
    injuries: "None",
  },
  {
    name: "Noor Samir",
    phone: "+201000000105",
    email: "noor@athletica.demo",
    password: "Noor@123",
    age: 26,
    goal: "Endurance",
    fitnessLevel: "Intermediate",
    injuries: "None",
  },
  {
    name: "Zain Mahmoud",
    phone: "+201000000106",
    email: "zain@athletica.demo",
    password: "Zain@123",
    age: 29,
    goal: "Muscle Gain",
    fitnessLevel: "Intermediate",
    injuries: "Mild knee pain",
  },
];

const SARA_CLIENT = {
  name: "Sara Hassan",
  phone: "+201000000107",
  email: "sara@athletica.demo",
  password: "Sara@123",
  age: 24,
  goal: "Weight Loss",
  fitnessLevel: "Beginner",
  injuries: "None",
};

const EXERCISE_CATALOG = [
  {
    name: "Barbell Squat",
    category: "LEGS",
    videoUrl: "https://example.com/videos/squat",
    instructions: "Keep chest up and knees tracking.",
  },
  {
    name: "Barbell Bench Press",
    category: "CHEST",
    videoUrl: "https://example.com/videos/bench",
    instructions: "Keep shoulders retracted.",
  },
  {
    name: "Deadlift",
    category: "LEGS",
    videoUrl: "https://example.com/videos/deadlift",
    instructions: "Maintain neutral spine throughout.",
  },
  {
    name: "Lat Pulldown",
    category: "BACK",
    videoUrl: "https://example.com/videos/lat-pulldown",
    instructions: "Lead with elbows.",
  },
  {
    name: "Dumbbell Rows",
    category: "BACK",
    videoUrl: "https://example.com/videos/dumbbell-rows",
    instructions: "Control the eccentric phase.",
  },
  {
    name: "Dumbbell Shoulder Press",
    category: "SHOULDERS",
    videoUrl: "https://example.com/videos/shoulder-press",
    instructions: "Full range of motion.",
  },
];

const categoryToPrimaryMuscle = (category) => {
  const normalized = String(category || "").toUpperCase();
  if (normalized === "CHEST") return "chest";
  if (normalized === "BACK") return "back";
  if (normalized === "LEGS") return "quads";
  if (normalized === "SHOULDERS") return "shoulders";
  if (normalized === "ARMS") return "biceps";
  if (normalized === "CORE") return "core";
  if (normalized === "CARDIO") return "full body";
  return "other";
};

const categoryToMovementPattern = (category) => {
  const normalized = String(category || "").toUpperCase();
  if (normalized === "CHEST" || normalized === "SHOULDERS") return "Push";
  if (normalized === "BACK" || normalized === "ARMS") return "Pull";
  if (normalized === "LEGS") return "Squat";
  return "Other";
};

const ensureDatabaseEnv = () => {
  if (
    !process.env.PRISMA_URL &&
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_PRISMA_URL &&
    !process.env.POSTGRES_URL_NON_POOLING &&
    !process.env.POSTGRES_URL
  ) {
    throw new Error(
      "Database URL is missing. Set one of PRISMA_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL before running seed:demo",
    );
  }
};

const hashPassword = async (password) => {
  return bcrypt.hash(password, Number(process.env.SALT_ROUNDS || 10));
};

const upsertUser = async ({
  name,
  phone,
  email,
  password,
  isVerified = true,
}) => {
  const hashedPassword = await hashPassword(password);

  return prisma.user.upsert({
    where: { phone },
    update: {
      name,
      email,
      password: hashedPassword,
      isVerified,
    },
    create: {
      name,
      phone,
      email,
      password: hashedPassword,
      isVerified,
    },
    select: { id: true, name: true, phone: true, email: true },
  });
};

const attachRole = async (userId, roleName) => {
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

const linkTrainerClient = async (trainerId, clientId, status = "ACTIVE") => {
  return prisma.trainerClient.upsert({
    where: {
      trainerId_clientId: {
        trainerId,
        clientId,
      },
    },
    update: { status, startedAt: new Date() },
    create: {
      trainerId,
      clientId,
      status,
      startedAt: new Date(),
    },
    select: { id: true, status: true },
  });
};

const createExercises = async (trainerId) => {
  const byName = new Map();

  for (const exercise of EXERCISE_CATALOG) {
    const existing = await prisma.exercise.findFirst({
      where: {
        trainerId,
        name_en: exercise.name,
      },
    });

    const result =
      existing ||
      (await prisma.exercise.create({
        data: {
          trainerId,
          name_en: exercise.name,
          name_ar: null,
          primary_muscle: categoryToPrimaryMuscle(exercise.category),
          secondary_muscles: [],
          equipment: "other",
          difficulty: "beginner",
          exercise_type: "strength",
          classification: ["Compound"],
          movement_pattern: categoryToMovementPattern(exercise.category),
          fitness_goals: ["Strength"],
          workout_location: "gym",
          media_type: "video",
          media_url: exercise.videoUrl,
          video_url: exercise.videoUrl,
          tags: [String(exercise.category || "").toLowerCase()],
          is_default: false,
          priority: "Important",
          instructions: exercise.instructions,
        },
      }));

    byName.set(exercise.name, result);
  }

  return byName;
};

const createTrainerProfile = async (userId, data) => {
  const existing = await prisma.trainerProfile.findUnique({
    where: { trainerId: userId },
  });

  if (existing) return existing;

  return prisma.trainerProfile.create({
    data: {
      trainerId: userId,
      bio: data.bio,
      certifications: data.specialization,
    },
  });
};

const createClientProfile = async (userId, data) => {
  const existing = await prisma.clientProfile.findUnique({
    where: { clientId: userId },
  });

  if (existing) return existing;

  return prisma.clientProfile.create({
    data: {
      clientId: userId,
      age: data.age || null,
      heightCm: null,
      weightKg: null,
      fitnessGoal: data.goal || null,
      medicalConditions: data.injuries || null,
    },
  });
};

const seedProgressMetrics = async (clientId, startingWeight = 75.5) => {
  const existing = await prisma.progressMetric.count({
    where: { userId: clientId },
  });

  if (existing >= 2) return;

  const march1 = new Date("2026-03-01");
  const april6 = new Date("2026-04-06");

  await prisma.progressMetric.createMany({
    data: [
      {
        userId: clientId,
        metric: "WEIGHT",
        value: startingWeight,
        recordedAt: march1,
      },
      {
        userId: clientId,
        metric: "WEIGHT",
        value: startingWeight - 2.5,
        recordedAt: april6,
      },
    ],
    skipDuplicates: true,
  });
};

const seedConversation = async (trainerId, clientId) => {
  const existing = await prisma.conversation.findUnique({
    where: {
      trainerId_clientId: {
        trainerId,
        clientId,
      },
    },
  });

  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      trainerId,
      clientId,
    },
  });
};

const seedMessages = async (trainerId, clientId, conversationId) => {
  const existing = await prisma.message.count({
    where: { conversationId },
  });

  if (existing > 0) return;

  const messages = [
    {
      senderId: trainerId,
      text: "Welcome! Excited to start this journey with you.",
      isRead: true,
    },
    {
      senderId: clientId,
      text: "Thanks coach! Ready to get started.",
      isRead: true,
    },
    {
      senderId: trainerId,
      text: "Your form looked great on that last squat session!",
      isRead: true,
    },
    {
      senderId: clientId,
      text: "Felt strong! Any tips for next session?",
      isRead: false,
    },
  ];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    await prisma.message.create({
      data: {
        conversationId,
        senderId: msg.senderId,
        body: msg.text,
        isRead: msg.isRead,
        type: "TEXT",
        createdAt: new Date(Date.now() - (messages.length - i) * 3600000),
      },
    });
  }
};

const ensureWowWorkoutData = async (trainerId, clientId, exercisesByName) => {
  const squatExercise = exercisesByName.get("Barbell Squat");
  const benchExercise = exercisesByName.get("Barbell Bench Press");
  const rowExercise = exercisesByName.get("Dumbbell Rows");

  if (!squatExercise || !benchExercise || !rowExercise) {
    console.warn("Skipping wow workout seed: required exercises not found");
    return;
  }

  const workoutStart = new Date("2026-04-01");
  const workoutEnd = new Date("2026-04-14");

  let workout = await prisma.workout.findFirst({
    where: {
      trainerId,
      clientId,
      startDate: workoutStart,
      endDate: workoutEnd,
    },
    select: { id: true },
  });

  if (!workout) {
    workout = await prisma.workout.create({
      data: {
        trainerId,
        clientId,
        startDate: workoutStart,
        endDate: workoutEnd,
      },
      select: { id: true },
    });
  }

  const workoutDay = await prisma.workoutDay.upsert({
    where: {
      workoutId_dayIndex: {
        workoutId: workout.id,
        dayIndex: 0,
      },
    },
    update: {
      date: workoutStart,
      title: "Demo Wow Day",
    },
    create: {
      workoutId: workout.id,
      dayIndex: 0,
      date: workoutStart,
      title: "Demo Wow Day",
    },
    select: { id: true },
  });

  const seededItems = [
    {
      order: 0,
      exerciseId: squatExercise.id,
      sets: 4,
      reps: 8,
      restSeconds: 120,
    },
    {
      order: 1,
      exerciseId: benchExercise.id,
      sets: 4,
      reps: 10,
      restSeconds: 90,
    },
    {
      order: 2,
      exerciseId: rowExercise.id,
      sets: 4,
      reps: 12,
      restSeconds: 90,
    },
  ];

  for (const item of seededItems) {
    await prisma.workoutItem.upsert({
      where: {
        workoutDayId_order: {
          workoutDayId: workoutDay.id,
          order: item.order,
        },
      },
      update: {
        exerciseId: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        restSeconds: item.restSeconds,
      },
      create: {
        workoutDayId: workoutDay.id,
        exerciseId: item.exerciseId,
        sets: item.sets,
        reps: item.reps,
        restSeconds: item.restSeconds,
        order: item.order,
      },
    });
  }

  const squatItem = await prisma.workoutItem.findUnique({
    where: {
      workoutDayId_order: {
        workoutDayId: workoutDay.id,
        order: 0,
      },
    },
    select: { id: true },
  });

  if (squatItem) {
    await prisma.workoutCompletion.upsert({
      where: {
        workoutItemId: squatItem.id,
      },
      update: {
        clientId,
        loggedWeightKg: 60,
        note: "Demo wow seed: squat 60kg",
        completedAt: new Date(),
      },
      create: {
        workoutItemId: squatItem.id,
        clientId,
        loggedWeightKg: 60,
        note: "Demo wow seed: squat 60kg",
        completedAt: new Date(),
      },
    });
  }

  await recalcWorkoutDayAndSummary(workoutDay.id);
};

const ensureWowMealData = async (trainerId, clientId) => {
  const clientProfile = await prisma.clientProfile.findUnique({
    where: { clientId },
    select: { id: true },
  });

  if (!clientProfile) {
    console.warn("Skipping wow meal seed: client profile not found");
    return;
  }

  const portions = await prisma.foodPortion.findMany({
    where: {
      food: {
        isArchived: false,
      },
    },
    orderBy: {
      id: "asc",
    },
    take: 3,
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
  });

  if (portions.length < 3) {
    console.warn("Skipping wow meal seed: not enough active food portions");
    return;
  }

  const startDate = new Date("2026-04-01");
  const endDate = new Date("2026-04-07");

  let plan = await prisma.mealPlan.findFirst({
    where: {
      trainerId,
      clientProfileId: clientProfile.id,
      title: "Demo Wow Meal Plan",
    },
    select: { id: true },
  });

  if (!plan) {
    plan = await prisma.mealPlan.create({
      data: {
        sourceMealTemplateId: null,
        trainerId,
        clientProfileId: clientProfile.id,
        status: "ACTIVE",
        title: "Demo Wow Meal Plan",
        notes: "Demo wow seed",
        startDate,
        endDate,
      },
      select: { id: true },
    });
  }

  await prisma.mealPlanDay.deleteMany({
    where: {
      mealPlanId: plan.id,
    },
  });

  const day = await prisma.mealPlanDay.create({
    data: {
      mealPlanId: plan.id,
      dayIndex: 0,
      date: startDate,
      totalCount: 0,
      completedCount: 0,
      percentage: 0,
    },
    select: { id: true },
  });

  const mealTimes = ["BREAKFAST", "LUNCH", "DINNER"];
  const createdItems = [];

  for (let i = 0; i < portions.length; i += 1) {
    const portion = portions[i];
    const quantity = 1;
    const baseGrams = Number(portion.food.baseGrams || 100);
    const gramsPerPortion = Number(portion.grams || 0);
    const factor = baseGrams > 0 ? (gramsPerPortion / baseGrams) * quantity : 0;

    const item = await prisma.mealPlanItem.create({
      data: {
        mealPlanDayId: day.id,
        foodId: portion.foodId,
        portionId: portion.id,
        quantity,
        mealTime: mealTimes[i],
        sortOrder: 0,
        note: "Demo wow seed item",
        foodNameSnapshot: portion.food.name,
        portionLabelSnapshot: portion.label,
        gramsPerPortion,
        caloriesSnapshot: Number(portion.food.calories) * factor,
        proteinSnapshot: Number(portion.food.protein) * factor,
        carbsSnapshot: Number(portion.food.carbs) * factor,
        fatSnapshot: Number(portion.food.fat) * factor,
      },
      select: { id: true },
    });

    createdItems.push(item);
  }

  await prisma.mealCompletion.createMany({
    data: createdItems.slice(0, 2).map((item) => ({
      mealPlanItemId: item.id,
      clientId,
      completedAt: new Date(),
      note: "Demo wow seed completion",
    })),
    skipDuplicates: true,
  });

  await recalcMealPlanDayAndSummary(day.id);
};

const main = async () => {
  try {
    ensureDatabaseEnv();

    // Establish connection before starting operations
    try {
      await prisma.$connect();
      console.log("Database connected for Demo seed");
    } catch (err) {
      console.error("Failed to connect to database:", err.message);
      throw err;
    }

    console.log("\n=== Seeding Demo Data ===\n");

    // 1. Create Ahmed (trainer)
    console.log("Creating trainer Ahmed...");
    const ahmed = await upsertUser(AHMED_TRAINER);
    await attachRole(ahmed.id, "TRAINER");
    await createTrainerProfile(ahmed.id, AHMED_TRAINER);
    console.log(`✓ Ahmed created: ${ahmed.phone} / ${ahmed.email}`);

    // 2. Create exercises for Ahmed
    console.log("\nCreating exercises...");
    const exercises = await createExercises(ahmed.id);
    console.log(`✓ ${exercises.size} exercises created`);

    // 3. Create 6 demo clients
    console.log("\nCreating 6 demo clients...");
    const clients = [];
    for (const clientData of DEMO_CLIENTS) {
      const client = await upsertUser(clientData);
      await attachRole(client.id, "CLIENT");
      await createClientProfile(client.id, clientData);
      await linkTrainerClient(ahmed.id, client.id, "ACTIVE");
      clients.push(client);

      // Seed progress metrics with varied starting weights
      const startWeight = 70 + Math.random() * 20;
      await seedProgressMetrics(client.id, startWeight);

      // Seed conversation and messages
      const conversation = await seedConversation(ahmed.id, client.id);
      await seedMessages(ahmed.id, client.id, conversation.id);
    }
    console.log(`✓ ${clients.length} demo clients created and linked to Ahmed`);

    // 4. Ensure deterministic wow moment data for the first active demo client
    if (clients[0]) {
      await ensureWowWorkoutData(ahmed.id, clients[0].id, exercises);
      await ensureWowMealData(ahmed.id, clients[0].id);
      console.log(
        "✓ Wow moment workout/meal data guaranteed for demo client 1",
      );
    }

    // 5. Create Sara (for invite flow demo) without active trainer link
    console.log("\nCreating Sara (for invite flow demo)...");
    const sara = await upsertUser(SARA_CLIENT);
    await attachRole(sara.id, "CLIENT");
    await createClientProfile(sara.id, SARA_CLIENT);
    console.log("✓ Sara created (not linked) for live invite/activation story");

    console.log("\n=== Demo Seed Complete ===\n");
    console.log("Demo Credentials:");
    console.log(
      `  Trainer Ahmed: ${AHMED_TRAINER.phone} / ${AHMED_TRAINER.password}`,
    );
    console.log(
      `  Client 1: ${DEMO_CLIENTS[0].phone} / ${DEMO_CLIENTS[0].password}`,
    );
    console.log(`  Sara: ${SARA_CLIENT.phone} / ${SARA_CLIENT.password}`);
    console.log("\nCreated:");
    console.log(`  - 1 trainer (Ahmed) with profile`);
    console.log(
      `  - 6 active linked demo clients + Sara unlinked for invite story`,
    );
    console.log(`  - ${exercises.size} exercises`);
    console.log(`  - Progress metrics for all clients`);
    console.log(`  - Conversations/messages for active demo pairs`);
    console.log(`  - Guaranteed wow examples: Squat 60kg and meals 2/3\n`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();
