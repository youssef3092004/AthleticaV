// Configs/db.js
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import process from "process";

const { PrismaClient } = pkg;

const globalForDb = globalThis;

const CONNECT_RETRIES = Number(process.env.DB_CONNECT_RETRIES || 5);
const CONNECT_RETRY_DELAY_MS = Number(
  process.env.DB_CONNECT_RETRY_DELAY_MS || 1500,
);
const WARMUP_QUERY_RETRIES = Number(process.env.DB_WARMUP_QUERY_RETRIES || 2);
const WARMUP_QUERY_RETRY_DELAY_MS = Number(
  process.env.DB_WARMUP_QUERY_RETRY_DELAY_MS || 500,
);

function normalizeConnectionString(rawConnectionString) {
  if (!rawConnectionString) return rawConnectionString;

  try {
    const parsedUrl = new URL(rawConnectionString);
    const sslmode = parsedUrl.searchParams.get("sslmode");

    // Keep current strong behavior explicit and future-proof against pg v9 changes.
    if (["prefer", "require", "verify-ca"].includes(sslmode)) {
      parsedUrl.searchParams.set("sslmode", "verify-full");
    }

    return parsedUrl.toString();
  } catch {
    return rawConnectionString;
  }
}

const rawConnectionString =
  process.env.PRISMA_URL ||
  process.env.SUPABASE_URL ||
  process.env.DATABASE_URL;

const connectionString = normalizeConnectionString(rawConnectionString);

if (!connectionString) {
  throw new Error(
    "Missing database connection string. Set PRISMA_URL, SUPABASE_URL, or DATABASE_URL.",
  );
}

const pool =
  globalForDb.pgPool ||
  new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS || 10000),
    connectionTimeoutMillis: Number(
      process.env.DB_POOL_CONNECTION_TIMEOUT_MS || 15000,
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: Number(
      process.env.DB_POOL_KEEP_ALIVE_DELAY_MS || 0,
    ),
  });

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error", err);
});

const adapter = globalForDb.prismaAdapter || new PrismaPg(pool);

const prisma =
  globalForDb.prisma ||
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableConnectionError(err) {
  const message = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toUpperCase();

  const retryableCodes = new Set(["P1001", "P1002", "P1017"]);
  if (retryableCodes.has(code)) return true;

  return (
    message.includes("failed to connect to upstream database") ||
    message.includes("can't reach database server") ||
    message.includes("timed out fetching a new connection") ||
    message.includes("connection terminated unexpectedly") ||
    message.includes("econnreset") ||
    message.includes("econnrefused")
  );
}

async function withRetry(task, retries, delayMs, operationLabel) {
  let lastError;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      return await task();
    } catch (err) {
      lastError = err;

      const canRetry =
        attempt <= retries && isRetryableConnectionError(lastError);
      if (!canRetry) {
        throw lastError;
      }

      const backoffMs = delayMs * attempt;
      console.warn(
        `${operationLabel} failed (attempt ${attempt}/${retries + 1}). Retrying in ${backoffMs}ms...`,
      );
      await sleep(backoffMs);
    }
  }

  throw lastError;
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
  globalForDb.prismaAdapter = adapter;
  globalForDb.prisma = prisma;
}

export async function connectDB() {
  try {
    await withRetry(
      () => prisma.$connect(),
      CONNECT_RETRIES,
      CONNECT_RETRY_DELAY_MS,
      "Database connect",
    );

    await withRetry(
      () => prisma.$queryRawUnsafe("SELECT 1"),
      WARMUP_QUERY_RETRIES,
      WARMUP_QUERY_RETRY_DELAY_MS,
      "Database warm-up query",
    );

    console.log("Database connected successfully");
  } catch (err) {
    console.error("Database connection failed", err);
    process.exit(1);
  }
}

export { prisma };
