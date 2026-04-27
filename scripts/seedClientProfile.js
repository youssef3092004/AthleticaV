import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

/**
 * Seed script for populating test ClientProfile records
 * Creates diverse profiles with different fitness goals and metrics for demo/testing
 */

async function seedClientProfiles() {
  try {
    // Establish connection before starting operations
    try {
      await prisma.$connect();
      console.log("Database connected for ClientProfile seed");
    } catch (err) {
      console.error("Failed to connect to database:", err.message);
      throw err;
    }

    console.log("Starting ClientProfile seed...");

    // First, find the CLIENT role
    const clientRole = await prisma.role.findUnique({
      where: { name: "CLIENT" },
    });

    if (!clientRole) {
      console.log("⚠️  CLIENT role not found. Run seed:rbac first.");
      return;
    }

    // Get users with CLIENT role
    const clientUsers = await prisma.userRole.findMany({
      where: { roleId: clientRole.id },
      include: {
        user: true,
      },
      take: 5,
    });

    if (clientUsers.length === 0) {
      console.log(
        "⚠️  No CLIENT users found. Run seed:all first to create test users.",
      );
      return;
    }

    const clients = clientUsers.map((ur) => ur.user);

    // Define diverse profile templates
    const profileTemplates = [
      {
        clientId: clients[0]?.id,
        age: 28,
        heightCm: 175,
        weightKg: 72,
        fitnessGoal: "Weight Loss",
        medicalConditions: "None",
      },
      {
        clientId: clients[1]?.id,
        age: 35,
        heightCm: 168,
        weightKg: 65,
        fitnessGoal: "Muscle Gain",
        medicalConditions: "Mild knee pain",
      },
      {
        clientId: clients[2]?.id,
        age: 42,
        heightCm: 180,
        weightKg: 85,
        fitnessGoal: "General Fitness",
        medicalConditions: "None",
      },
      {
        clientId: clients[3]?.id,
        age: 26,
        heightCm: 162,
        weightKg: 58,
        fitnessGoal: "Endurance",
        medicalConditions: "Asthma",
      },
      {
        clientId: clients[4]?.id,
        age: 38,
        heightCm: 178,
        weightKg: 78,
        fitnessGoal: "Strength Training",
        medicalConditions: "None",
      },
    ];

    const updatedProfiles = [];
    let upsertCount = 0;

    for (const profile of profileTemplates) {
      if (!profile.clientId) {
        console.log(
          "⚠️  Skipping profile: clientId not found (not enough clients)",
        );
        continue;
      }

      const result = await prisma.clientProfile.upsert({
        where: { clientId: profile.clientId },
        update: profile,
        create: profile,
      });

      updatedProfiles.push(result);
      upsertCount++;
      console.log(
        `✓ Profile seeded for client ${profile.clientId} - Goal: ${profile.fitnessGoal}`,
      );
    }

    console.log(`\n✅ Seed complete! ${upsertCount} client profiles seeded.`);
    console.log("\nProfile Summary:");
    updatedProfiles.forEach((p) => {
      const bmi = (
        p.weightKg /
        ((p.heightCm / 100) * (p.heightCm / 100))
      ).toFixed(1);
      console.log(
        `  - Client ${p.clientId}: Age ${p.age}, Goal: ${p.fitnessGoal}, BMI: ${bmi}`,
      );
    });
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedClientProfiles();
