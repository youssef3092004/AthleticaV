import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import process from "process";

dotenv.config({ path: ".env.local" });
dotenv.config();

const { prisma } = await import("../configs/db.js");

const getArgValue = (name) => {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => item.startsWith(prefix));
  if (!arg) return null;
  const parsed = arg.slice(prefix.length).trim();
  return parsed || null;
};

const parseString = (value, fallback = "") => String(value ?? fallback).trim();

const parseArray = (value, { lowercase = false } = {}) => {
  const items = Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  return lowercase ? items.map((item) => item.toLowerCase()) : items;
};

const DEFAULT_MEDIA_PLACEHOLDER = "exercises/images/placeholder.webp";

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["true", "1", "yes"].includes(normalized);
};

const toExerciseData = (raw, trainerIdOverride) => {
  const id = parseString(raw.id);
  if (!id) {
    throw new Error("Each exercise must include a non-empty id");
  }

  const nameEn = parseString(raw.name_en);
  if (!nameEn) {
    throw new Error(`Exercise ${id} is missing name_en`);
  }

  const primaryMuscle = parseString(raw.primary_muscle, "other").toLowerCase();

  const mediaUrl =
    parseString(raw.media_url) ||
    parseString(raw.video_url) ||
    DEFAULT_MEDIA_PLACEHOLDER;

  return {
    id,
    data: {
      trainerId: trainerIdOverride,
      name_en: nameEn,
      name_ar: parseString(raw.name_ar) || null,
      primary_muscle: primaryMuscle,
      secondary_muscles: parseArray(raw.secondary_muscles, { lowercase: true }),
      equipment: parseString(raw.equipment, "other").toLowerCase(),
      difficulty: parseString(raw.difficulty, "beginner").toLowerCase(),
      exercise_type: parseString(raw.exercise_type, "strength").toLowerCase(),
      classification: parseArray(raw.classification),
      movement_pattern: parseString(raw.movement_pattern, "Other"),
      fitness_goals: parseArray(raw.fitness_goals),
      workout_location: parseString(raw.workout_location, "gym").toLowerCase(),
      media_type: parseString(raw.media_type, "image").toLowerCase(),
      media_url: mediaUrl,
      video_url: parseString(raw.video_url) || null,
      tags: parseArray(raw.tags, { lowercase: true }),
      is_default: toBoolean(raw.is_default),
      priority: parseString(raw.priority, "Important"),
      instructions: null,
    },
  };
};

const importCatalog = async (jsonPath, trainerIdOverride) => {
  const absolutePath = path.resolve(jsonPath);
  const content = await fs.readFile(absolutePath, "utf-8");
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error("Input file must contain a JSON array of exercises");
  }

  let created = 0;
  let updated = 0;

  for (const item of parsed) {
    const { id, data } = toExerciseData(item, trainerIdOverride);

    const existing = await prisma.exercise.findUnique({
      where: { id },
      select: { id: true },
    });

    await prisma.exercise.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return {
    total: parsed.length,
    created,
    updated,
    source: absolutePath,
  };
};

const main = async () => {
  const defaultCatalogPath = "./01_athletica_mvp_database_v2.json";
  const filePathArg = process.argv[2] || defaultCatalogPath;

  const trainerIdOverride = getArgValue("trainerId");
  const summary = await importCatalog(filePathArg, trainerIdOverride);

  console.log("Exercise catalog import completed:");
  console.log(JSON.stringify(summary, null, 2));
};

main()
  .catch((error) => {
    console.error("Exercise catalog import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
