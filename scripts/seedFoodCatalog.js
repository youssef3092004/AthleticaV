import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

const FOOD_CATALOG = [
  {
    category: "Proteins",
    foods: [
      {
        name: "Chicken Breast",
        baseGrams: 100,
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 piece", grams: 120 },
          { label: "1 cup diced", grams: 140 },
        ],
      },
      {
        name: "Chicken Thigh",
        baseGrams: 100,
        calories: 209,
        protein: 26,
        carbs: 0,
        fat: 10.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 piece", grams: 95 },
        ],
      },
      {
        name: "Lean Beef",
        baseGrams: 100,
        calories: 250,
        protein: 26,
        carbs: 0,
        fat: 15,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 steak", grams: 180 },
        ],
      },
      {
        name: "Tuna",
        baseGrams: 100,
        calories: 132,
        protein: 29,
        carbs: 0,
        fat: 1,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 can drained", grams: 120 },
        ],
      },
      {
        name: "Salmon",
        baseGrams: 100,
        calories: 208,
        protein: 20,
        carbs: 0,
        fat: 13,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 fillet", grams: 170 },
        ],
      },
      {
        name: "Egg Whole",
        baseGrams: 100,
        calories: 143,
        protein: 13,
        carbs: 1.1,
        fat: 9.5,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 egg", grams: 50 },
          { label: "1 egg white", grams: 33 },
        ],
      },
      {
        name: "Turkey Breast",
        baseGrams: 100,
        calories: 135,
        protein: 30,
        carbs: 0,
        fat: 1,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 slice", grams: 30 },
        ],
      },
      {
        name: "Shrimp",
        baseGrams: 100,
        calories: 99,
        protein: 24,
        carbs: 0.2,
        fat: 0.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "10 medium", grams: 85 },
        ],
      },
      {
        name: "Cottage Cheese",
        baseGrams: 100,
        calories: 98,
        protein: 11,
        carbs: 3.4,
        fat: 4.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup", grams: 210 },
        ],
      },
    ],
  },
  {
    category: "Grains",
    foods: [
      {
        name: "White Rice Cooked",
        baseGrams: 100,
        calories: 130,
        protein: 2.7,
        carbs: 28,
        fat: 0.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 158 },
        ],
      },
      {
        name: "Brown Rice Cooked",
        baseGrams: 100,
        calories: 111,
        protein: 2.6,
        carbs: 23,
        fat: 0.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 195 },
        ],
      },
      {
        name: "Oats Dry",
        baseGrams: 100,
        calories: 389,
        protein: 16.9,
        carbs: 66.3,
        fat: 6.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup dry", grams: 81 },
          { label: "1 tbsp", grams: 8 },
        ],
      },
      {
        name: "Whole Wheat Bread",
        baseGrams: 100,
        calories: 247,
        protein: 13,
        carbs: 41,
        fat: 4.2,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 slice", grams: 30 },
        ],
      },
      {
        name: "Pasta Cooked",
        baseGrams: 100,
        calories: 131,
        protein: 5,
        carbs: 25,
        fat: 1.1,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 140 },
        ],
      },
      {
        name: "Quinoa Cooked",
        baseGrams: 100,
        calories: 120,
        protein: 4.4,
        carbs: 21.3,
        fat: 1.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 185 },
        ],
      },
      {
        name: "Corn Tortilla",
        baseGrams: 100,
        calories: 218,
        protein: 5.7,
        carbs: 44.6,
        fat: 2.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 tortilla", grams: 28 },
        ],
      },
    ],
  },
  {
    category: "Dairy",
    foods: [
      {
        name: "Greek Yogurt Low Fat",
        baseGrams: 100,
        calories: 73,
        protein: 9.9,
        carbs: 3.9,
        fat: 1.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup", grams: 245 },
        ],
      },
      {
        name: "Milk Low Fat",
        baseGrams: 100,
        calories: 47,
        protein: 3.4,
        carbs: 5,
        fat: 1.5,
        portions: [
          { label: "100ml", grams: 100 },
          { label: "1 cup", grams: 240 },
        ],
      },
      {
        name: "Cheddar Cheese",
        baseGrams: 100,
        calories: 403,
        protein: 25,
        carbs: 1.3,
        fat: 33,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 slice", grams: 28 },
        ],
      },
      {
        name: "Feta Cheese",
        baseGrams: 100,
        calories: 264,
        protein: 14,
        carbs: 4.1,
        fat: 21,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cube", grams: 30 },
        ],
      },
      {
        name: "Labneh",
        baseGrams: 100,
        calories: 150,
        protein: 8,
        carbs: 4,
        fat: 11,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 tbsp", grams: 15 },
        ],
      },
    ],
  },
  {
    category: "Vegetables",
    foods: [
      {
        name: "Broccoli",
        baseGrams: 100,
        calories: 35,
        protein: 2.4,
        carbs: 7.2,
        fat: 0.4,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup chopped", grams: 91 },
        ],
      },
      {
        name: "Spinach",
        baseGrams: 100,
        calories: 23,
        protein: 2.9,
        carbs: 3.6,
        fat: 0.4,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup raw", grams: 30 },
        ],
      },
      {
        name: "Cucumber",
        baseGrams: 100,
        calories: 15,
        protein: 0.7,
        carbs: 3.6,
        fat: 0.1,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup slices", grams: 104 },
        ],
      },
      {
        name: "Tomato",
        baseGrams: 100,
        calories: 18,
        protein: 0.9,
        carbs: 3.9,
        fat: 0.2,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 123 },
        ],
      },
      {
        name: "Sweet Potato",
        baseGrams: 100,
        calories: 86,
        protein: 1.6,
        carbs: 20.1,
        fat: 0.1,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 130 },
        ],
      },
      {
        name: "Carrot",
        baseGrams: 100,
        calories: 41,
        protein: 0.9,
        carbs: 9.6,
        fat: 0.2,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 61 },
        ],
      },
      {
        name: "Bell Pepper",
        baseGrams: 100,
        calories: 31,
        protein: 1,
        carbs: 6,
        fat: 0.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 119 },
        ],
      },
    ],
  },
  {
    category: "Fruits",
    foods: [
      {
        name: "Banana",
        baseGrams: 100,
        calories: 89,
        protein: 1.1,
        carbs: 22.8,
        fat: 0.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 118 },
        ],
      },
      {
        name: "Apple",
        baseGrams: 100,
        calories: 52,
        protein: 0.3,
        carbs: 13.8,
        fat: 0.2,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 182 },
        ],
      },
      {
        name: "Orange",
        baseGrams: 100,
        calories: 47,
        protein: 0.9,
        carbs: 11.8,
        fat: 0.1,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 medium", grams: 131 },
        ],
      },
      {
        name: "Strawberries",
        baseGrams: 100,
        calories: 32,
        protein: 0.7,
        carbs: 7.7,
        fat: 0.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup", grams: 152 },
        ],
      },
      {
        name: "Blueberries",
        baseGrams: 100,
        calories: 57,
        protein: 0.7,
        carbs: 14.5,
        fat: 0.3,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup", grams: 148 },
        ],
      },
      {
        name: "Dates",
        baseGrams: 100,
        calories: 282,
        protein: 2.5,
        carbs: 75,
        fat: 0.4,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 date", grams: 8 },
        ],
      },
      {
        name: "Mango",
        baseGrams: 100,
        calories: 60,
        protein: 0.8,
        carbs: 15,
        fat: 0.4,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup diced", grams: 165 },
        ],
      },
    ],
  },
  {
    category: "Healthy Fats",
    foods: [
      {
        name: "Avocado",
        baseGrams: 100,
        calories: 160,
        protein: 2,
        carbs: 8.5,
        fat: 14.7,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 half", grams: 68 },
        ],
      },
      {
        name: "Olive Oil",
        baseGrams: 100,
        calories: 884,
        protein: 0,
        carbs: 0,
        fat: 100,
        portions: [
          { label: "100ml", grams: 100 },
          { label: "1 tbsp", grams: 14 },
          { label: "1 tsp", grams: 5 },
        ],
      },
      {
        name: "Almonds",
        baseGrams: 100,
        calories: 579,
        protein: 21.2,
        carbs: 21.7,
        fat: 49.9,
        portions: [
          { label: "100g", grams: 100 },
          { label: "10 pieces", grams: 12 },
          { label: "1 tbsp", grams: 9 },
        ],
      },
      {
        name: "Peanut Butter",
        baseGrams: 100,
        calories: 588,
        protein: 25,
        carbs: 20,
        fat: 50,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 tbsp", grams: 16 },
        ],
      },
      {
        name: "Walnuts",
        baseGrams: 100,
        calories: 654,
        protein: 15.2,
        carbs: 13.7,
        fat: 65.2,
        portions: [
          { label: "100g", grams: 100 },
          { label: "7 halves", grams: 14 },
        ],
      },
    ],
  },
  {
    category: "Legumes",
    foods: [
      {
        name: "Lentils Cooked",
        baseGrams: 100,
        calories: 116,
        protein: 9,
        carbs: 20,
        fat: 0.4,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 198 },
        ],
      },
      {
        name: "Chickpeas Cooked",
        baseGrams: 100,
        calories: 164,
        protein: 8.9,
        carbs: 27.4,
        fat: 2.6,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 164 },
        ],
      },
      {
        name: "Black Beans Cooked",
        baseGrams: 100,
        calories: 132,
        protein: 8.9,
        carbs: 23.7,
        fat: 0.5,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 172 },
        ],
      },
      {
        name: "Kidney Beans Cooked",
        baseGrams: 100,
        calories: 127,
        protein: 8.7,
        carbs: 22.8,
        fat: 0.5,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 177 },
        ],
      },
      {
        name: "Fava Beans Cooked",
        baseGrams: 100,
        calories: 110,
        protein: 7.6,
        carbs: 19.7,
        fat: 0.4,
        portions: [
          { label: "100g", grams: 100 },
          { label: "1 cup cooked", grams: 170 },
        ],
      },
    ],
  },
];

const keyOf = (name) => String(name).trim().toLowerCase();
const portionKeyOf = (foodId, label) =>
  `${String(foodId)}:${String(label).trim().toLowerCase()}`;

const seedFoodCatalog = async () => {
  let categoryCount = 0;
  let foodCreatedCount = 0;
  let foodUpdatedCount = 0;
  let portionCreatedCount = 0;
  let portionUpdatedCount = 0;

  for (const categoryEntry of FOOD_CATALOG) {
    const createdOrExistingCategory = await prisma.foodCategory.upsert({
      where: { name: categoryEntry.category },
      update: {},
      create: { name: categoryEntry.category },
      select: { id: true, name: true },
    });

    const existingFoods = await prisma.food.findMany({
      where: { categoryId: createdOrExistingCategory.id },
      select: { id: true, name: true },
    });

    const existingFoodByName = new Map(
      existingFoods.map((food) => [keyOf(food.name), food]),
    );

    const existingPortions = existingFoods.length
      ? await prisma.foodPortion.findMany({
          where: {
            foodId: {
              in: existingFoods.map((food) => food.id),
            },
          },
          select: {
            id: true,
            foodId: true,
            label: true,
          },
        })
      : [];

    const existingPortionByKey = new Map(
      existingPortions.map((portion) => [
        portionKeyOf(portion.foodId, portion.label),
        portion,
      ]),
    );

    await Promise.all(
      categoryEntry.foods.map(async (foodEntry) => {
        const existingFood = existingFoodByName.get(keyOf(foodEntry.name));

        const food = existingFood
          ? await prisma.food.update({
              where: { id: existingFood.id },
              data: {
                name: foodEntry.name,
                baseGrams: foodEntry.baseGrams,
                calories: foodEntry.calories,
                protein: foodEntry.protein,
                carbs: foodEntry.carbs,
                fat: foodEntry.fat,
                isArchived: false,
              },
              select: { id: true },
            })
          : await prisma.food.create({
              data: {
                categoryId: createdOrExistingCategory.id,
                name: foodEntry.name,
                baseGrams: foodEntry.baseGrams,
                calories: foodEntry.calories,
                protein: foodEntry.protein,
                carbs: foodEntry.carbs,
                fat: foodEntry.fat,
                isArchived: false,
              },
              select: { id: true },
            });

        if (existingFood) {
          foodUpdatedCount += 1;
        } else {
          foodCreatedCount += 1;
        }

        await Promise.all(
          foodEntry.portions.map(async (portion) => {
            const portionKey = portionKeyOf(food.id, portion.label);
            const existingPortion = existingPortionByKey.get(portionKey);

            if (existingPortion) {
              await prisma.foodPortion.update({
                where: { id: existingPortion.id },
                data: { grams: portion.grams },
                select: { id: true },
              });
              portionUpdatedCount += 1;
            } else {
              await prisma.foodPortion.create({
                data: {
                  foodId: food.id,
                  label: portion.label,
                  grams: portion.grams,
                },
                select: { id: true },
              });
              portionCreatedCount += 1;
            }
          }),
        );
      }),
    );

    categoryCount += 1;
  }

  console.log("Food catalog seed completed successfully");
  console.log(`Categories processed: ${categoryCount}`);
  console.log(`Foods created: ${foodCreatedCount}`);
  console.log(`Foods updated: ${foodUpdatedCount}`);
  console.log(`Portions created: ${portionCreatedCount}`);
  console.log(`Portions updated: ${portionUpdatedCount}`);
};

seedFoodCatalog()
  .catch((error) => {
    if (error?.code === "P2021") {
      console.error(
        "Food catalog seed failed: required tables are missing. Run Prisma migrations first (e.g. npx prisma migrate dev).",
      );
      process.exitCode = 1;
      return;
    }
    console.error("Food catalog seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
