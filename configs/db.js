// Configs/db.js
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import process from "process";

const { PrismaClient } = pkg;

let prisma;

if (process.env.NODE_ENV === "production") {
  // Prisma / Production
  const adapter = new PrismaPg({
    connectionString: process.env.PRISMA_URL,
  });
  prisma = new PrismaClient({ adapter });
  console.log("Using Prisma (production)");
} else {
  // Local PostgreSQL / Development
  const adapter = new PrismaPg({
    connectionString: process.env.PRISMA_URL,
  });
  prisma = new PrismaClient({ adapter });
  console.log("Using Local PostgreSQL (development)");
}

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database connection failed", err);
    process.exit(1);
  }
}

export { prisma };
