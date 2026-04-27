import "dotenv/config";
import { prisma } from "../configs/db.js";
import process from "process";

const DEFAULT_PLANS = [
  { name: "starter", price: "500.00", billingCycle: "MONTHLY" },
  { name: "pro", price: "700.00", billingCycle: "MONTHLY" },
  { name: "elite", price: "1500.00", billingCycle: "MONTHLY" },
  { name: "starter", price: "5000.00", billingCycle: "ANNUAL" },
  { name: "pro", price: "7000.00", billingCycle: "ANNUAL" },
  { name: "elite", price: "15000.00", billingCycle: "ANNUAL" },
];

const main = async () => {
  // Establish connection before starting operations
  try {
    await prisma.$connect();
    console.log("Database connected for Plans seed");
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    throw err;
  }

  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: {
        name_billingCycle: {
          name: plan.name,
          billingCycle: plan.billingCycle,
        },
      },
      update: {
        price: plan.price,
        isActive: true,
      },
      create: {
        name: plan.name,
        price: plan.price,
        billingCycle: plan.billingCycle,
        isActive: true,
      },
    });
  }

  console.log("Plan seed completed successfully");
};

main()
  .catch((error) => {
    console.error("Plan seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
