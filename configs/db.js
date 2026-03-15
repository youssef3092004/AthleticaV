// Configs/db.js
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import process from "process";

const { PrismaClient } = pkg;

const normalizeConnectionString = (rawConnectionString) => {
  if (!rawConnectionString) return rawConnectionString;

  try {
    const parsedUrl = new URL(rawConnectionString);
    const sslmode = parsedUrl.searchParams.get("sslmode");

    if (["prefer", "require", "verify-ca"].includes(sslmode)) {
      parsedUrl.searchParams.set("sslmode", "verify-full");
    }

    return parsedUrl.toString();
  } catch {
    return rawConnectionString;
  }
};

const connectionString = normalizeConnectionString(process.env.PRISMA_URL);

let prisma;

if (process.env.NODE_ENV === "production") {
  // Prisma / Production
  const adapter = new PrismaPg({
    connectionString,
  });
  prisma = new PrismaClient({ adapter });
  console.log("Using Prisma (production)");
} else {
  // Local PostgreSQL / Development
  const adapter = new PrismaPg({
    connectionString,
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
