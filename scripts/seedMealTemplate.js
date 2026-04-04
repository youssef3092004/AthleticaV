import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

const MEAL_TIMES = [
  "BREAKFAST",
  "MORNING_SNACK",
  "LUNCH",
  "AFTERNOON_SNACK",
  "DINNER",
  "EVENING_SNACK",
];

const QUANTITIES = [1, 1.5, 2];

const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const pickRandom = (arr) => arr[randomInt(0, arr.length - 1)];

const ensurePrerequisites = async () => {
  const trainer = await prisma.user.findFirst({
    where: {
      userRoles: {
        some: {
          role: {
            name: "TRAINER",
          },
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!trainer) {
    throw new Error(
      "No TRAINER user found. Run seed scripts that create trainer users first (e.g. npm run seed:workout).",
    );
  }

  const portions = await prisma.foodPortion.findMany({
    where: {
      food: {
        isArchived: false,
      },
    },
    select: {
      id: true,
      foodId: true,
      label: true,
      food: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (portions.length < 10) {
    throw new Error(
      "Not enough active food portions found. Run npm run seed:foods first.",
    );
  }

  return { trainer, portions };
};

const buildDayItems = (portions, dayIndex) => {
  const itemCount = randomInt(3, 5);
  const usedPortionIds = new Set();
  const sortOrderByMealTime = new Map();
  const items = [];

  for (let i = 0; i < itemCount; i += 1) {
    let selected = null;
    let attempts = 0;
    while (!selected && attempts < 25) {
      const candidate = pickRandom(portions);
      if (!usedPortionIds.has(candidate.id)) {
        selected = candidate;
        usedPortionIds.add(candidate.id);
      }
      attempts += 1;
    }

    if (!selected) {
      selected = pickRandom(portions);
    }

    const mealTime = MEAL_TIMES[(dayIndex + i) % MEAL_TIMES.length];
    const nextSortOrder = sortOrderByMealTime.get(mealTime) || 0;
    sortOrderByMealTime.set(mealTime, nextSortOrder + 1);

    items.push({
      foodId: selected.foodId,
      portionId: selected.id,
      quantity: pickRandom(QUANTITIES),
      mealTime,
      sortOrder: nextSortOrder,
      notes: `Seed item for ${mealTime.toLowerCase()}`,
    });
  }

  return items;
};

const main = async () => {
  const { trainer, portions } = await ensurePrerequisites();

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const title = `Seed Meal Template 7 Days ${timestamp}`;

  const createdTemplate = await prisma.$transaction(async (tx) => {
    const template = await tx.mealTemplate.create({
      data: {
        trainerId: trainer.id,
        title,
        description:
          "Auto-generated seed template with 7 days and 3-5 items per day.",
        isPublic: false,
      },
      select: {
        id: true,
        title: true,
      },
    });

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const day = await tx.mealTemplateDay.create({
        data: {
          mealTemplateId: template.id,
          dayIndex,
          label: `Day ${dayIndex + 1}`,
        },
        select: {
          id: true,
        },
      });

      const items = buildDayItems(portions, dayIndex);

      await tx.mealTemplateItem.createMany({
        data: items.map((item) => ({
          dayId: day.id,
          foodId: item.foodId,
          portionId: item.portionId,
          quantity: item.quantity,
          mealTime: item.mealTime,
          sortOrder: item.sortOrder,
          notes: item.notes,
        })),
      });
    }

    return template;
  });

  const summary = await prisma.mealTemplateDay.findMany({
    where: {
      mealTemplateId: createdTemplate.id,
    },
    orderBy: {
      dayIndex: "asc",
    },
    select: {
      dayIndex: true,
      _count: {
        select: {
          items: true,
        },
      },
    },
  });

  const counts = summary.map((day) => day._count.items);
  const average = counts.reduce((acc, value) => acc + value, 0) / counts.length;

  console.log("Meal template seed completed successfully");
  console.log(`Template ID: ${createdTemplate.id}`);
  console.log(`Title: ${createdTemplate.title}`);
  console.log(`Trainer: ${trainer.name || trainer.email || trainer.id}`);
  console.log(`Days: ${summary.length}`);
  console.log(`Items per day: ${counts.join(", ")}`);
  console.log(`Average items/day: ${average.toFixed(2)}`);
};

main()
  .catch((error) => {
    console.error("Meal template seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
