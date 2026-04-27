import "dotenv/config";
import bcrypt from "bcrypt";
import process from "process";
import { prisma } from "../configs/db.js";

const TRAINER = {
  name: "Seed Trainer",
  phone: "+201000000111",
  email: "seed.trainer@athletica.local",
  password: "Trainer@123",
};

const CLIENT = {
  name: "Seed Client",
  phone: "+201000000222",
  email: "seed.client@athletica.local",
  password: "Client@123",
};

const WORKOUT_TEMPLATE_TITLE = "Starter Full Body Template";
const WORKOUT_WINDOW = {
  startDate: new Date("2026-04-01"),
  endDate: new Date("2026-04-30"),
};

const EXERCISES = [
  {
    name: "Barbell Bench Press",
    category: "CHEST",
    videoUrl: "https://example.com/videos/bench-press",
    instructions: "Keep shoulders retracted and control the eccentric phase.",
  },
  {
    name: "Lat Pulldown",
    category: "BACK",
    videoUrl: "https://example.com/videos/lat-pulldown",
    instructions: "Lead with elbows and avoid swinging the torso.",
  },
  {
    name: "Goblet Squat",
    category: "LEGS",
    videoUrl: "https://example.com/videos/goblet-squat",
    instructions: "Keep chest up and knees tracking over toes.",
  },
];

const WORKOUT_ITEMS = [
  {
    exerciseName: "Barbell Bench Press",
    sets: 4,
    reps: 8,
    restSeconds: 120,
    order: 0,
  },
  {
    exerciseName: "Lat Pulldown",
    sets: 4,
    reps: 10,
    restSeconds: 90,
    order: 1,
  },
  {
    exerciseName: "Goblet Squat",
    sets: 4,
    reps: 12,
    restSeconds: 90,
    order: 2,
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
      "Database URL is missing. Set one of PRISMA_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL before running seed:workout",
    );
  }
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
    },
    create: {
      name,
      phone,
      email,
      password: hashedPassword,
      isVerified: true,
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

const upsertTrainerClientLink = async (trainerId, clientId) => {
  return prisma.trainerClient.upsert({
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

const upsertProgram = async (trainerClientId) => {
  const existing = await prisma.program.findFirst({
    where: {
      trainerClientId,
      startDate: WORKOUT_WINDOW.startDate,
      endDate: WORKOUT_WINDOW.endDate,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.program.create({
    data: {
      trainerClientId,
      startDate: WORKOUT_WINDOW.startDate,
      endDate: WORKOUT_WINDOW.endDate,
    },
  });
};

const ensureExercises = async (trainerId) => {
  const byName = new Map();

  for (const exercise of EXERCISES) {
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

const upsertWorkoutTemplate = async (trainerId) => {
  const existing = await prisma.workoutTemplate.findFirst({
    where: {
      trainerId,
      title: WORKOUT_TEMPLATE_TITLE,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.workoutTemplate.create({
    data: {
      trainerId,
      title: WORKOUT_TEMPLATE_TITLE,
      level: "BEGINNER",
    },
  });
};

const upsertWorkout = async (programId, workoutTemplateId) => {
  const existing = await prisma.workout.findFirst({
    where: {
      programId,
      workoutTemplateId,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.workout.create({
    data: {
      programId,
      workoutTemplateId,
    },
  });
};

const ensureWorkoutDay = async (workoutId, date) => {
  const existing = await prisma.workoutDay.findUnique({
    where: {
      workoutId_dayIndex: {
        workoutId,
        dayIndex: 0,
      },
    },
    select: { id: true },
  });

  if (existing) return existing;

  return prisma.workoutDay.create({
    data: {
      workoutId,
      dayIndex: 0,
      date,
      title: "Day 1",
    },
    select: { id: true },
  });
};

const syncWorkoutItems = async (workoutId, workoutDayId, exercisesByName) => {
  await prisma.workoutItem.deleteMany({ where: { workoutDayId } });

  const data = WORKOUT_ITEMS.map((item) => {
    const exercise = exercisesByName.get(item.exerciseName);
    if (!exercise) {
      throw new Error(
        `Exercise '${item.exerciseName}' not found while seeding items`,
      );
    }

    return {
      workoutDayId,
      exerciseId: exercise.id,
      sets: item.sets,
      reps: item.reps,
      restSeconds: item.restSeconds,
      order: item.order,
      notes: null,
      tempo: null,
      rir: null,
      rpe: null,
    };
  });

  await prisma.workoutItem.createMany({ data });
};

const main = async () => {
  ensureDatabaseEnv();

  // Establish connection before starting operations
  try {
    await prisma.$connect();
    console.log("Database connected for Workout seed");
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    throw err;
  }

  const trainer = await upsertUser(TRAINER);
  const client = await upsertUser(CLIENT);

  await attachRoleIfExists(trainer.id, "TRAINER");
  await attachRoleIfExists(client.id, "CLIENT");

  const trainerClient = await upsertTrainerClientLink(trainer.id, client.id);

  const exercisesByName = await ensureExercises(trainer.id);
  const workoutTemplate = await upsertWorkoutTemplate(trainer.id);
  const program = await upsertProgram(trainerClient.id);
  const workout = await upsertWorkout(program.id, workoutTemplate.id);

  const workoutDay = await ensureWorkoutDay(
    workout.id,
    WORKOUT_WINDOW.startDate,
  );

  await syncWorkoutItems(workout.id, workoutDay.id, exercisesByName);

  console.log("Workout seed completed successfully");
  console.log(`Trainer: ${trainer.email}`);
  console.log(`Client: ${client.email}`);
  console.log(`Workout ID: ${workout.id}`);
};

main()
  .catch((error) => {
    console.error("Workout seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
