import "dotenv/config";
import bcrypt from "bcrypt";
import process from "process";
import { prisma } from "../configs/db.js";

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
        name: exercise.name,
      },
    });

    const result =
      existing ||
      (await prisma.exercise.create({
        data: {
          trainerId,
          name: exercise.name,
          category: exercise.category,
          videoUrl: exercise.videoUrl,
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

const main = async () => {
  try {
    ensureDatabaseEnv();
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

    // 4. Create Sara (for invite flow demo)
    console.log("\nCreating Sara (for invite flow demo)...");
    const sara = await upsertUser(SARA_CLIENT);
    await attachRole(sara.id, "CLIENT");
    await createClientProfile(sara.id, SARA_CLIENT);
    await linkTrainerClient(ahmed.id, sara.id, "ACTIVE");
    await seedProgressMetrics(sara.id, 78.0);
    const sarConversation = await seedConversation(ahmed.id, sara.id);
    await seedMessages(ahmed.id, sara.id, sarConversation.id);
    console.log(`✓ Sara created and linked to Ahmed`);

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
      `  - 7 clients (6 demo + Sara) with profiles and relationships`,
    );
    console.log(`  - ${exercises.size} exercises`);
    console.log(`  - Progress metrics for all clients`);
    console.log(`  - Conversations and messages for all pairs\n`);
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();
