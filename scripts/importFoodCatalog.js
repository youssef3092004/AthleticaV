import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import process from "process";

dotenv.config({ path: ".env.local" });
dotenv.config();

const { prisma } = await import("../configs/db.js");

const parseString = (value, fallback = "") => String(value ?? fallback).trim();

const parseNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be a finite number`);
  }
  return parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return fallback;
};

const readSeedFile = async (filePath) => {
  const absolutePath = path.resolve(filePath);
  const content = await fs.readFile(absolutePath, "utf-8");
  const parsed = JSON.parse(content);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Seed file must be a JSON object");
  }

  const foodCategories = Array.isArray(parsed.foodCategories)
    ? parsed.foodCategories
    : [];
  const foods = Array.isArray(parsed.foods) ? parsed.foods : [];

  return { absolutePath, foodCategories, foods };
};

const upsertCategories = async (categories) => {
  const sourceCategoryIdToDbCategoryId = new Map();
  let created = 0;
  let updated = 0;
  let matchedByName = 0;

  for (const category of categories) {
    const sourceId = parseString(category.id);
    const name = parseString(category.name);

    if (!sourceId) {
      throw new Error("Each food category must have id");
    }
    if (!name) {
      throw new Error(`Category ${sourceId} is missing name`);
    }

    const byId = await prisma.foodCategory.findUnique({
      where: { id: sourceId },
      select: { id: true, name: true },
    });

    if (byId) {
      const updatedCategory = await prisma.foodCategory.update({
        where: { id: sourceId },
        data: { name },
        select: { id: true },
      });
      sourceCategoryIdToDbCategoryId.set(sourceId, updatedCategory.id);
      updated += 1;
      continue;
    }

    const byName = await prisma.foodCategory.findUnique({
      where: { name },
      select: { id: true },
    });

    if (byName) {
      sourceCategoryIdToDbCategoryId.set(sourceId, byName.id);
      matchedByName += 1;
      continue;
    }

    const createdCategory = await prisma.foodCategory.create({
      data: {
        id: sourceId,
        name,
      },
      select: { id: true },
    });

    sourceCategoryIdToDbCategoryId.set(sourceId, createdCategory.id);
    created += 1;
  }

  return {
    sourceCategoryIdToDbCategoryId,
    summary: { created, updated, matchedByName },
  };
};

const upsertFoods = async (foods, sourceCategoryIdToDbCategoryId) => {
  let created = 0;
  let updated = 0;

  for (const food of foods) {
    const id = parseString(food.id);
    const sourceCategoryId = parseString(food.categoryId);
    const name = parseString(food.name);

    if (!id) {
      throw new Error("Each food must have id");
    }

    if (!sourceCategoryId) {
      throw new Error(`Food ${id} is missing categoryId`);
    }

    if (!name) {
      throw new Error(`Food ${id} is missing name`);
    }

    const dbCategoryId = sourceCategoryIdToDbCategoryId.get(sourceCategoryId);
    if (!dbCategoryId) {
      throw new Error(
        `Food ${id} references categoryId ${sourceCategoryId} that was not found in foodCategories`,
      );
    }

    const data = {
      categoryId: dbCategoryId,
      name,
      baseGrams: parseNumber(food.baseGrams, `Food ${id} baseGrams`),
      calories: parseNumber(food.calories, `Food ${id} calories`),
      protein: parseNumber(food.protein, `Food ${id} protein`),
      carbs: parseNumber(food.carbs, `Food ${id} carbs`),
      fat: parseNumber(food.fat, `Food ${id} fat`),
      isArchived: parseBoolean(food.isArchived, false),
    };

    const existing = await prisma.food.findUnique({
      where: { id },
      select: { id: true },
    });

    await prisma.food.upsert({
      where: { id },
      update: data,
      create: {
        id,
        ...data,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  return { created, updated };
};

const main = async () => {
  // Establish connection before starting operations
  try {
    await prisma.$connect();
    console.log("Database connected for Food catalog import");
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    throw err;
  }

  const defaultFilePath = "./prisma_seed_data.json";
  const filePath = process.argv[2] || defaultFilePath;

  const { absolutePath, foodCategories, foods } = await readSeedFile(filePath);

  const { sourceCategoryIdToDbCategoryId, summary: categoriesSummary } =
    await upsertCategories(foodCategories);

  const foodsSummary = await upsertFoods(foods, sourceCategoryIdToDbCategoryId);

  console.log("Food catalog import completed:");
  console.log(
    JSON.stringify(
      {
        source: absolutePath,
        foodCategories: {
          totalInFile: foodCategories.length,
          ...categoriesSummary,
        },
        foods: {
          totalInFile: foods.length,
          ...foodsSummary,
        },
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error("Food catalog import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
