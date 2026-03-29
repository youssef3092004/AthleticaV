import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_MEAL_TIMES = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];
const ALLOWED_PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"];
const ALLOWED_SORT_FIELDS = [
  "createdAt",
  "startDate",
  "endDate",
  "updatedAt",
  "id",
];

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const parsePositiveNumber = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError(`${fieldName} must be a positive number`, 400);
  }
  return parsed;
};

const parseNonNegativeInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${fieldName} must be a non-negative integer`, 400);
  }
  return parsed;
};

const normalizeMealTime = (value) => {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();

  if (!ALLOWED_MEAL_TIMES.includes(normalized)) {
    throw new AppError("Invalid mealTime", 400);
  }

  return normalized;
};

const sanitizeOptionalString = (value, fieldName, maxLength = 1000) => {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;

  const parsed = String(value).trim();
  if (parsed.length > maxLength) {
    throw new AppError(
      `${fieldName} must be at most ${maxLength} characters`,
      400,
    );
  }

  return parsed;
};

const normalizePlanStatus = (value, fallback = "DRAFT") => {
  if (value === undefined || value === null) return fallback;

  const normalized = String(value).trim().toUpperCase();
  if (!ALLOWED_PLAN_STATUSES.includes(normalized)) {
    throw new AppError("Invalid meal plan status", 400);
  }

  return normalized;
};

const ensureDateRange = (startDate, endDate) => {
  if (endDate < startDate) {
    throw new AppError("endDate cannot be before startDate", 400);
  }
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const dateInRangeInclusive = (date, startDate, endDate) => {
  const dateTs = date.getTime();
  return dateTs >= startDate.getTime() && dateTs <= endDate.getTime();
};

const ensureUserExists = async (userId, label) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureTrainerClientRelationship = async (trainerId, clientId) => {
  const relation = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId,
        clientId,
      },
    },
    select: {
      status: true,
    },
  });

  if (!relation || relation.status !== "ACTIVE") {
    throw new AppError("Trainer-client relationship must be ACTIVE", 409);
  }
};

const ensureFoodIdsAndPortionPairs = async (allItems) => {
  const foodIds = Array.from(new Set(allItems.map((item) => item.foodId)));

  const foods = await prisma.food.findMany({
    where: {
      id: {
        in: foodIds,
      },
      isArchived: false,
    },
    select: {
      id: true,
      name: true,
      baseGrams: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
  });

  const foodById = new Map(foods.map((food) => [food.id, food]));
  if (foodById.size !== foodIds.length) {
    throw new AppError("One or more foods are missing or archived", 400);
  }

  const portionPairs = allItems.map((item) => ({
    id: item.portionId,
    foodId: item.foodId,
  }));

  const portions = await prisma.foodPortion.findMany({
    where: {
      OR: portionPairs,
    },
    select: {
      id: true,
      foodId: true,
      label: true,
      grams: true,
    },
  });

  const portionKey = (portionId, foodId) => `${portionId}:${foodId}`;
  const portionByPair = new Map(
    portions.map((portion) => [
      portionKey(portion.id, portion.foodId),
      portion,
    ]),
  );

  for (const item of allItems) {
    const key = portionKey(item.portionId, item.foodId);
    if (!portionByPair.has(key)) {
      throw new AppError(
        "Invalid portion: portion does not belong to the selected food",
        400,
      );
    }
  }

  return {
    foodById,
    portionByPair,
  };
};

const parseManualDays = (days, startDate, endDate) => {
  if (!Array.isArray(days) || days.length === 0) {
    throw new AppError("days must be a non-empty array", 400);
  }

  const dayIndexSet = new Set();
  const dateSet = new Set();

  const parsedDays = days.map((day, index) => {
    if (!day || typeof day !== "object") {
      throw new AppError(`days[${index}] must be an object`, 400);
    }

    const dayIndex = parseNonNegativeInteger(
      day.dayIndex,
      `days[${index}].dayIndex`,
    );
    if (dayIndexSet.has(dayIndex)) {
      throw new AppError("Duplicate dayIndex in meal plan days", 400);
    }
    dayIndexSet.add(dayIndex);

    const date = parseDateOnly(day.date, `days[${index}].date`);
    if (!dateInRangeInclusive(date, startDate, endDate)) {
      throw new AppError(
        "Meal plan day date must be inside the plan range",
        400,
      );
    }

    const dateKey = toDateKey(date);
    if (dateSet.has(dateKey)) {
      throw new AppError("Duplicate date in meal plan days", 400);
    }
    dateSet.add(dateKey);

    if (!Array.isArray(day.items) || day.items.length === 0) {
      throw new AppError(`days[${index}].items must be a non-empty array`, 400);
    }

    const slotSet = new Set();
    const items = day.items.map((item, itemIndex) => {
      if (!item || typeof item !== "object") {
        throw new AppError(
          `days[${index}].items[${itemIndex}] must be an object`,
          400,
        );
      }

      if (!item.foodId || !item.portionId) {
        throw new AppError(
          `days[${index}].items[${itemIndex}] foodId and portionId are required`,
          400,
        );
      }

      const mealTime = normalizeMealTime(item.mealTime);
      const sortOrder = parseNonNegativeInteger(
        item.sortOrder ?? 0,
        `days[${index}].items[${itemIndex}].sortOrder`,
      );

      const slotKey = `${mealTime}:${sortOrder}`;
      if (slotSet.has(slotKey)) {
        throw new AppError(
          `Duplicate meal slot ${slotKey} within dayIndex ${dayIndex}`,
          400,
        );
      }
      slotSet.add(slotKey);

      return {
        foodId: String(item.foodId),
        portionId: String(item.portionId),
        quantity: parsePositiveNumber(
          item.quantity ?? 1,
          `days[${index}].items[${itemIndex}].quantity`,
        ),
        mealTime,
        sortOrder,
      };
    });

    return {
      dayIndex,
      date,
      items,
    };
  });

  return parsedDays;
};

const findDuplicatePlan = async ({
  trainerId,
  clientId,
  startDate,
  endDate,
  sourceMealTemplateId,
  title,
}) => {
  const duplicate = await prisma.mealPlan.findFirst({
    where: {
      trainerId,
      clientId,
      startDate,
      endDate,
      sourceMealTemplateId: sourceMealTemplateId ?? null,
      title: title ?? null,
      status: {
        in: ["DRAFT", "ACTIVE"],
      },
    },
    select: {
      id: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return duplicate;
};

const buildSnapshotItem = (item, foodById, portionByPair) => {
  const food = foodById.get(item.foodId);
  const portion = portionByPair.get(`${item.portionId}:${item.foodId}`);

  return {
    foodId: item.foodId,
    portionId: item.portionId,
    quantity: item.quantity,
    mealTime: item.mealTime,
    sortOrder: item.sortOrder,
    foodNameSnapshot: food.name,
    portionLabelSnapshot: portion.label,
    gramsPerPortion: portion.grams,
    baseGramsSnapshot: food.baseGrams,
    caloriesSnapshot: food.calories,
    proteinSnapshot: food.protein,
    carbsSnapshot: food.carbs,
    fatSnapshot: food.fat,
  };
};

const getPlanByIdWithRelations = async (id) => {
  return prisma.mealPlan.findUnique({
    where: { id },
    select: {
      id: true,
      sourceMealTemplateId: true,
      trainerId: true,
      clientId: true,
      status: true,
      title: true,
      notes: true,
      startDate: true,
      endDate: true,
      generatedAt: true,
      createdAt: true,
      updatedAt: true,
      days: {
        orderBy: {
          dayIndex: "asc",
        },
        select: {
          id: true,
          dayIndex: true,
          date: true,
          items: {
            orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
            select: {
              id: true,
              foodId: true,
              portionId: true,
              quantity: true,
              mealTime: true,
              sortOrder: true,
              foodNameSnapshot: true,
              portionLabelSnapshot: true,
              gramsPerPortion: true,
              baseGramsSnapshot: true,
              caloriesSnapshot: true,
              proteinSnapshot: true,
              carbsSnapshot: true,
              fatSnapshot: true,
            },
          },
        },
      },
    },
  });
};

const ensureCanViewPlan = (access, plan) => {
  if (access.isPrivileged) return;

  const isTrainerOwner = String(access.userId) === String(plan.trainerId);
  const isClientOwner = String(access.userId) === String(plan.clientId);

  if (!isTrainerOwner && !isClientOwner) {
    throw new AppError("Forbidden", 403);
  }
};

export const createMealPlan = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const trainerId = req.body.trainerId || access.userId;
    const clientId = String(req.body.clientId || "").trim();
    if (!clientId) {
      return next(new AppError("clientId is required", 400));
    }

    ensureSameUserOrPrivileged(
      access,
      trainerId,
      "Forbidden: trainerId must match authenticated trainer",
    );

    await ensureUserExists(trainerId, "Trainer user");
    await ensureUserExists(clientId, "Client user");
    await ensureTrainerClientRelationship(trainerId, clientId);

    const startDate = parseDateOnly(req.body.startDate, "startDate");
    const endDate = parseDateOnly(req.body.endDate, "endDate");
    ensureDateRange(startDate, endDate);

    const sourceMealTemplateId = req.body.sourceMealTemplateId || null;
    const title = sanitizeOptionalString(req.body.title, "title", 200);
    const notes = sanitizeOptionalString(req.body.notes, "notes", 4000);
    const status = normalizePlanStatus(req.body.status, "DRAFT");
    const parsedDays = parseManualDays(req.body.days, startDate, endDate);

    const duplicate = await findDuplicatePlan({
      trainerId,
      clientId,
      startDate,
      endDate,
      sourceMealTemplateId,
      title,
    });

    if (duplicate) {
      const existing = await getPlanByIdWithRelations(duplicate.id);
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: existing,
      });
    }

    const allItems = parsedDays.flatMap((day) => day.items);
    const { foodById, portionByPair } =
      await ensureFoodIdsAndPortionPairs(allItems);

    const created = await prisma.$transaction(async (tx) => {
      const plan = await tx.mealPlan.create({
        data: {
          sourceMealTemplateId,
          trainerId,
          clientId,
          status,
          title,
          notes,
          startDate,
          endDate,
        },
        select: {
          id: true,
        },
      });

      for (const day of parsedDays) {
        const createdDay = await tx.mealPlanDay.create({
          data: {
            mealPlanId: plan.id,
            dayIndex: day.dayIndex,
            date: day.date,
          },
          select: { id: true },
        });

        if (day.items.length > 0) {
          await tx.mealPlanItem.createMany({
            data: day.items.map((item) => ({
              mealPlanDayId: createdDay.id,
              ...buildSnapshotItem(item, foodById, portionByPair),
            })),
          });
        }
      }

      return plan.id;
    });

    const payload = await getPlanByIdWithRelations(created);

    return res.status(201).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Duplicate day or meal slot detected", 409));
    }
    return next(error);
  }
};

export const createMealPlanFromTemplate = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const templateId = String(req.body.templateId || "").trim();
    const clientId = String(req.body.clientId || "").trim();
    if (!templateId || !clientId) {
      return next(new AppError("templateId and clientId are required", 400));
    }

    const startDate = parseDateOnly(req.body.startDate, "startDate");
    const endDate = parseDateOnly(req.body.endDate, "endDate");
    ensureDateRange(startDate, endDate);

    const title = sanitizeOptionalString(req.body.title, "title", 200);
    const notes = sanitizeOptionalString(req.body.notes, "notes", 4000);
    const status = normalizePlanStatus(req.body.status, "DRAFT");

    const template = await prisma.mealTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        trainerId: true,
        isArchived: true,
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
              },
            },
          },
        },
      },
    });

    if (!template) {
      return next(new AppError("Meal template not found", 404));
    }

    if (template.isArchived) {
      return next(
        new AppError("Cannot generate plan from archived template", 409),
      );
    }

    ensureSameUserOrPrivileged(
      access,
      template.trainerId,
      "Forbidden: template does not belong to this trainer",
    );

    await ensureUserExists(clientId, "Client user");
    await ensureTrainerClientRelationship(template.trainerId, clientId);

    if (template.days.length === 0) {
      return next(new AppError("Template has no days", 400));
    }

    for (const day of template.days) {
      const dayDate = addDays(startDate, day.dayIndex);
      if (!dateInRangeInclusive(dayDate, startDate, endDate)) {
        return next(
          new AppError(
            "Date range is too short for template day indexes. Extend endDate.",
            400,
          ),
        );
      }
    }

    const duplicate = await findDuplicatePlan({
      trainerId: template.trainerId,
      clientId,
      startDate,
      endDate,
      sourceMealTemplateId: template.id,
      title,
    });

    if (duplicate) {
      const existing = await getPlanByIdWithRelations(duplicate.id);
      return res.status(200).json({
        success: true,
        idempotent: true,
        data: existing,
      });
    }

    const allItems = template.days.flatMap((day) => day.items);
    const { foodById, portionByPair } =
      await ensureFoodIdsAndPortionPairs(allItems);

    const createdPlanId = await prisma.$transaction(async (tx) => {
      const plan = await tx.mealPlan.create({
        data: {
          sourceMealTemplateId: template.id,
          trainerId: template.trainerId,
          clientId,
          status,
          title,
          notes,
          startDate,
          endDate,
        },
        select: {
          id: true,
        },
      });

      for (const day of template.days) {
        const plannedDate = addDays(startDate, day.dayIndex);

        const createdDay = await tx.mealPlanDay.create({
          data: {
            mealPlanId: plan.id,
            dayIndex: day.dayIndex,
            date: plannedDate,
          },
          select: {
            id: true,
          },
        });

        if (day.items.length > 0) {
          await tx.mealPlanItem.createMany({
            data: day.items.map((item) => ({
              mealPlanDayId: createdDay.id,
              ...buildSnapshotItem(item, foodById, portionByPair),
            })),
          });
        }
      }

      return plan.id;
    });

    const payload = await getPlanByIdWithRelations(createdPlanId);

    return res.status(201).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Duplicate day or meal slot detected", 409));
    }
    return next(error);
  }
};

export const getMealPlanById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    const { id } = req.params;
    if (!id) {
      return next(new AppError("Meal plan ID is required", 400));
    }

    const plan = await getPlanByIdWithRelations(id);
    if (!plan) {
      return next(new AppError("Meal plan not found", 404));
    }

    ensureCanViewPlan(access, plan);

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
};

export const getClientMealPlans = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    const clientId = String(req.params.id || "").trim();
    if (!clientId) {
      return next(new AppError("Client ID is required", 400));
    }

    if (!access.isPrivileged && String(access.userId) !== clientId) {
      ensureHasAnyRole(access, ["TRAINER"], "Forbidden");
      const hasRelation = await prisma.trainerClient.findUnique({
        where: {
          trainerId_clientId: {
            trainerId: access.userId,
            clientId,
          },
        },
        select: {
          status: true,
        },
      });

      if (!hasRelation || hasRelation.status !== "ACTIVE") {
        return next(
          new AppError(
            "Forbidden: client is not assigned to this trainer",
            403,
          ),
        );
      }
    }

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "startDate",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const where = {
      clientId,
    };

    if (
      !access.isPrivileged &&
      access.roles.includes("TRAINER") &&
      access.userId !== clientId
    ) {
      where.trainerId = access.userId;
    }

    if (req.query.status) {
      where.status = normalizePlanStatus(req.query.status);
    }

    const [total, plans] = await prisma.$transaction([
      prisma.mealPlan.count({ where }),
      prisma.mealPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: {
          id: true,
          sourceMealTemplateId: true,
          trainerId: true,
          clientId: true,
          status: true,
          title: true,
          notes: true,
          startDate: true,
          endDate: true,
          generatedAt: true,
          createdAt: true,
          updatedAt: true,
          days: {
            select: {
              id: true,
              dayIndex: true,
              date: true,
              _count: {
                select: {
                  items: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: plans,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        sort,
        order,
      },
    });
  } catch (error) {
    return next(error);
  }
};
