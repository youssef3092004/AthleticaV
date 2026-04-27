import "dotenv/config";
import process from "process";
import { prisma } from "../configs/db.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toRoundedPercentage = (completedCount, totalCount) => {
  if (!totalCount || totalCount <= 0) return 0;
  return Number(((completedCount / totalCount) * 100).toFixed(2));
};
const pickRandomSubset = (items, count) => {
  if (count <= 0 || items.length === 0) return [];
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const TRANSACTION_OPTIONS = {
  maxWait: 10000,
  timeout: 30000,
};

const startOfDayUtc = (date = new Date()) => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
};

const addDaysUtc = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + Number(days));
  return copy;
};

const pickTrainer = async () => {
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
    throw new Error("No TRAINER user found. Run npm run seed:workout first.");
  }

  return trainer;
};

const pickClientProfileForTrainer = async (trainerId) => {
  const directLink = await prisma.trainerClient.findFirst({
    where: {
      trainerId: String(trainerId),
      status: "ACTIVE",
    },
    select: {
      clientId: true,
    },
    orderBy: {
      startedAt: "asc",
    },
  });

  if (directLink) {
    const profile = await prisma.clientProfile.findUnique({
      where: {
        clientId: directLink.clientId,
      },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (profile) {
      return profile;
    }
  }

  const profile = await prisma.clientProfile.findFirst({
    select: {
      id: true,
      clientId: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (!profile) {
    throw new Error(
      "No ClientProfile found. Run npm run seed:client-profile first.",
    );
  }

  await prisma.trainerClient.upsert({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(profile.clientId),
      },
    },
    update: {
      status: "ACTIVE",
      startedAt: new Date(),
    },
    create: {
      trainerId: String(trainerId),
      clientId: String(profile.clientId),
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  return profile;
};

const resolveTemplate = async (trainerId) => {
  const explicitId =
    process.env.SEED_MEAL_TEMPLATE_ID || process.env.TEMPLATE_ID;

  const template = explicitId
    ? await prisma.mealTemplate.findUnique({
        where: { id: String(explicitId) },
        select: {
          id: true,
          title: true,
          days: {
            orderBy: {
              dayIndex: "asc",
            },
            select: {
              dayIndex: true,
              items: {
                orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
                select: {
                  foodId: true,
                  portionId: true,
                  quantity: true,
                  mealTime: true,
                  sortOrder: true,
                  food: {
                    select: {
                      id: true,
                      name: true,
                      baseGrams: true,
                      calories: true,
                      protein: true,
                      carbs: true,
                      fat: true,
                      isArchived: true,
                    },
                  },
                  portion: {
                    select: {
                      id: true,
                      label: true,
                      grams: true,
                    },
                  },
                },
              },
            },
          },
        },
      })
    : await prisma.mealTemplate.findFirst({
        where: {
          trainerId: String(trainerId),
          isArchived: false,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          title: true,
          days: {
            orderBy: {
              dayIndex: "asc",
            },
            select: {
              dayIndex: true,
              items: {
                orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
                select: {
                  foodId: true,
                  portionId: true,
                  quantity: true,
                  mealTime: true,
                  sortOrder: true,
                  food: {
                    select: {
                      id: true,
                      name: true,
                      baseGrams: true,
                      calories: true,
                      protein: true,
                      carbs: true,
                      fat: true,
                      isArchived: true,
                    },
                  },
                  portion: {
                    select: {
                      id: true,
                      label: true,
                      grams: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

  if (!template) {
    throw new Error(
      "Meal template not found. Set SEED_MEAL_TEMPLATE_ID or run npm run seed:meal-template.",
    );
  }

  if (!template.days.length) {
    throw new Error("Template has no days.");
  }

  return template;
};

const createMealPlanFromTemplate = async ({
  trainer,
  clientProfile,
  template,
}) => {
  const completionRatio = clamp(
    Number(process.env.SEED_MEAL_COMPLETION_RATIO ?? 0.4),
    0,
    1,
  );

  const startDate = startOfDayUtc();
  const maxDayIndex = Math.max(...template.days.map((day) => day.dayIndex));
  const endDate = addDaysUtc(startDate, maxDayIndex);

  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.create({
      data: {
        sourceMealTemplateId: template.id,
        trainerId: trainer.id,
        clientProfileId: clientProfile.id,
        status: "ACTIVE",
        title: `Seed Plan From Template - ${template.title}`,
        notes: "Generated by seedMealPlanFromTemplate.js",
        startDate,
        endDate,
        totalCount: 0,
        completedCount: 0,
        percentage: 0,
      },
      select: {
        id: true,
      },
    });

    let planTotalCount = 0;
    let planCompletedCount = 0;

    for (const day of template.days) {
      const dayDate = addDaysUtc(startDate, day.dayIndex);
      const dayTotalCount = day.items.length;
      planTotalCount += dayTotalCount;

      const createdDay = await tx.mealPlanDay.create({
        data: {
          mealPlanId: plan.id,
          dayIndex: day.dayIndex,
          date: dayDate,
          completedCount: 0,
          totalCount: dayTotalCount,
          percentage: 0,
        },
        select: {
          id: true,
        },
      });

      if (day.items.length) {
        await tx.mealPlanItem.createMany({
          data: day.items.map((item) => {
            if (item.food.isArchived) {
              throw new Error(
                "Template contains archived food. Unarchive or update template.",
              );
            }

            const qty = Number(item.quantity || 1);
            const gramsPerPortion = Number(item.portion.grams || 0);
            const baseGrams = Number(item.food.baseGrams || 100);
            const factor =
              baseGrams > 0 ? (gramsPerPortion / baseGrams) * qty : 0;

            return {
              mealPlanDayId: createdDay.id,
              foodId: item.foodId,
              portionId: item.portionId,
              quantity: qty,
              mealTime: item.mealTime,
              sortOrder: item.sortOrder,
              note: null,
              foodNameSnapshot: item.food.name,
              portionLabelSnapshot: item.portion.label,
              gramsPerPortion,
              caloriesSnapshot: Number(item.food.calories) * factor,
              proteinSnapshot: Number(item.food.protein) * factor,
              carbsSnapshot: Number(item.food.carbs) * factor,
              fatSnapshot: Number(item.food.fat) * factor,
            };
          }),
        });
      }

      const createdItems = await tx.mealPlanItem.findMany({
        where: {
          mealPlanDayId: createdDay.id,
        },
        select: {
          id: true,
        },
      });

      const completionCountTarget = Math.floor(
        createdItems.length * completionRatio,
      );
      const completedItems = pickRandomSubset(
        createdItems,
        completionCountTarget,
      );

      if (completedItems.length) {
        await tx.mealCompletion.createMany({
          data: completedItems.map((item) => ({
            mealPlanItemId: item.id,
            clientId: clientProfile.clientId,
            completedAt: new Date(),
            note: "Seed completion",
          })),
          skipDuplicates: true,
        });
      }

      const dayCompletedCount = completedItems.length;
      planCompletedCount += dayCompletedCount;

      await tx.mealPlanDay.update({
        where: { id: createdDay.id },
        data: {
          completedCount: dayCompletedCount,
          percentage: toRoundedPercentage(dayCompletedCount, dayTotalCount),
        },
      });
    }

    const planPercentage = toRoundedPercentage(
      planCompletedCount,
      planTotalCount,
    );

    await tx.mealPlan.update({
      where: { id: plan.id },
      data: {
        totalCount: planTotalCount,
        completedCount: planCompletedCount,
        percentage: planPercentage,
      },
    });

    return {
      planId: plan.id,
      totalCount: planTotalCount,
      completedCount: planCompletedCount,
      percentage: planPercentage,
    };
  }, TRANSACTION_OPTIONS);

  return result;
};

const main = async () => {
  // Establish connection before starting operations
  try {
    await prisma.$connect();
    console.log("Database connected for Meal Plan from Template seed");
  } catch (err) {
    console.error("Failed to connect to database:", err.message);
    throw err;
  }

  const trainer = await pickTrainer();
  const clientProfile = await pickClientProfileForTrainer(trainer.id);
  const template = await resolveTemplate(trainer.id);

  const created = await createMealPlanFromTemplate({
    trainer,
    clientProfile,
    template,
  });

  console.log("Meal plan (from template) seed completed successfully");
  console.log(`Plan ID: ${created.planId}`);
  console.log(`Template ID: ${template.id}`);
  console.log(`Trainer: ${trainer.name || trainer.email || trainer.id}`);
  console.log(`Client profile: ${clientProfile.id}`);
  console.log(`Total items: ${created.totalCount}`);
  console.log(`Completed items: ${created.completedCount}`);
  console.log(`Plan percentage: ${created.percentage}%`);
};

main()
  .catch((error) => {
    console.error("Meal plan from template seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
