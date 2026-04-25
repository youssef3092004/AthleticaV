import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { pagination } from "../utils/pagination.js";
import { recalcMealPlanSummary } from "../utils/mealPlanProgress.js";
import {
  ensureHasAnyRole,
  ensureSameUserOrPrivileged,
  getUserAccessContext,
} from "../utils/authz.js";

const ALLOWED_PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];
const ALLOWED_SORT_FIELDS = ["createdAt", "updatedAt", "id"];

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

const parseDateOnly = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new Date(parsed.toISOString().slice(0, 10));
};

const parseOptionalBoolean = (value, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1";
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

const addDays = (date, days) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + Number(days));
  return copy;
};

const ensurePlanAccess = (access, trainerId, message = "Forbidden") => {
  if (!access.isPrivileged) {
    ensureSameUserOrPrivileged(access, trainerId, message);
  }
};

const resolveTrainerScopeId = (req, access) => {
  const fromParams = req.params?.trainerId;
  const fromQuery = req.query?.trainerId;
  const fromUserTrainerId = req.user?.trainerId;
  const fallbackUserId = access.userId;

  const resolved =
    fromParams || fromQuery || fromUserTrainerId || fallbackUserId;
  if (!resolved) {
    throw new AppError("trainerId is required", 400);
  }

  ensurePlanAccess(
    access,
    resolved,
    "Forbidden: you can only view your own trainer plans",
  );

  return String(resolved);
};

const resolveClientProfile = async ({ clientProfileId, clientId }) => {
  if (clientProfileId) {
    const profile = await prisma.clientProfile.findUnique({
      where: { id: String(clientProfileId) },
      select: { id: true, clientId: true },
    });

    if (!profile) {
      throw new AppError("Client profile not found", 404);
    }

    return profile;
  }

  if (clientId) {
    const profile = await prisma.clientProfile.findUnique({
      where: { clientId: String(clientId) },
      select: { id: true, clientId: true },
    });

    if (!profile) {
      throw new AppError("Client profile not found", 404);
    }

    return profile;
  }

  throw new AppError("clientProfileId or clientId is required", 400);
};

const ensureUserExists = async (userId, label = "User") => {
  const user = await prisma.user.findUnique({
    where: { id: String(userId) },
    select: { id: true },
  });

  if (!user) {
    throw new AppError(`${label} not found`, 404);
  }
};

const ensureTrainerClientRelationship = async (trainerId, clientId) => {
  const link = await prisma.trainerClient.findUnique({
    where: {
      trainerId_clientId: {
        trainerId: String(trainerId),
        clientId: String(clientId),
      },
    },
    select: { id: true },
  });

  if (!link) {
    throw new AppError("Trainer-client relationship not found", 404);
  }
};

const ensureProgramForMealPlan = async (programId) => {
  if (!programId) {
    throw new AppError("programId is required", 400);
  }

  const program = await prisma.program.findUnique({
    where: { id: String(programId) },
    select: {
      id: true,
      trainerId: true,
      clientId: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!program) {
    throw new AppError("Program not found", 404);
  }

  return program;
};

const ensureSourceTemplate = async (templateId, trainerId, access) => {
  if (!templateId) return null;

  const template = await prisma.mealTemplate.findUnique({
    where: { id: String(templateId) },
    select: {
      id: true,
      trainerId: true,
      isPublic: true,
      isArchived: true,
    },
  });

  if (!template) {
    throw new AppError("Source meal template not found", 404);
  }

  if (template.isArchived) {
    throw new AppError("Source meal template is archived", 409);
  }

  const sameTrainer = String(template.trainerId) === String(trainerId);
  if (!sameTrainer && !template.isPublic && !access.isPrivileged) {
    throw new AppError("Forbidden: source template not accessible", 403);
  }

  return template.id;
};

const PLAN_LIST_SELECT = {
  id: true,
  sourceMealTemplateId: true,
  programId: true,
  clientProfileId: true,
  trainerId: true,
  status: true,
  totalCount: true,
  completedCount: true,
  percentage: true,
  title: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  program: {
    select: {
      id: true,
      startDate: true,
      endDate: true,
    },
  },
  sourceTemplate: {
    select: {
      id: true,
      title: true,
    },
  },
  clientProfile: {
    select: {
      id: true,
      clientId: true,
      targetCalories: true,
      targetProtein: true,
      targetCarbs: true,
      targetFat: true,
    },
  },
};

const PLAN_DETAILS_SELECT = {
  ...PLAN_LIST_SELECT,
  days: {
    orderBy: {
      dayIndex: "asc",
    },
    select: {
      id: true,
      mealPlanId: true,
      dayIndex: true,
      date: true,
      completedCount: true,
      totalCount: true,
      percentage: true,
      totalCalories: true,
      totalProtein: true,
      totalCarbs: true,
      totalFats: true,
      createdAt: true,
      items: {
        orderBy: [{ mealTime: "asc" }, { sortOrder: "asc" }],
        select: {
          id: true,
          mealPlanDayId: true,
          foodId: true,
          food: {
            select: {
              id: true,
              name: true,
            },
          },
          portionId: true,
          quantity: true,
          mealTime: true,
          sortOrder: true,
          foodNameSnapshot: true,
          portionLabelSnapshot: true,
          gramsPerPortion: true,
          caloriesSnapshot: true,
          proteinSnapshot: true,
          carbsSnapshot: true,
          fatSnapshot: true,
          createdAt: true,
          updatedAt: true,
          completion: {
            select: {
              id: true,
              completedAt: true,
              note: true,
              clientId: true,
            },
          },
        },
      },
    },
  },
};

export const createMealPlan = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const program = await ensureProgramForMealPlan(req.body.programId);
    const trainerId = program.trainerId;
    ensureSameUserOrPrivileged(
      access,
      trainerId,
      "Forbidden: trainerId must match authenticated trainer",
    );

    await ensureUserExists(trainerId, "Trainer user");

    const profile = await resolveClientProfile({
      clientProfileId: req.body.clientProfileId,
      clientId: req.body.clientId,
    });

    if (String(profile.clientId) !== String(program.clientId)) {
      return next(
        new AppError(
          "Client profile must belong to the same client as the selected program",
          409,
        ),
      );
    }

    await ensureUserExists(profile.clientId, "Client user");
    await ensureTrainerClientRelationship(trainerId, profile.clientId);

    const sourceMealTemplateId = await ensureSourceTemplate(
      req.body.sourceMealTemplateId || null,
      trainerId,
      access,
    );

    const title = sanitizeOptionalString(req.body.title, "title", 200);
    const notes = sanitizeOptionalString(req.body.notes, "notes", 4000);
    const status = normalizePlanStatus(req.body.status, "DRAFT");

    const created = await prisma.mealPlan.create({
      data: {
        sourceMealTemplateId,
        programId: program.id,
        trainerId,
        clientProfileId: profile.id,
        status,
        title,
        notes,
      },
      select: PLAN_LIST_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    return next(error);
  }
};

export const createMealPlanFromTemplate = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const program = await ensureProgramForMealPlan(req.body.programId);
    const trainerId = program.trainerId;
    ensureSameUserOrPrivileged(
      access,
      trainerId,
      "Forbidden: trainerId must match authenticated trainer",
    );

    await ensureUserExists(trainerId, "Trainer user");

    const templateId =
      req.params.templateId ||
      req.body.templateId ||
      req.body.sourceMealTemplateId;
    if (!templateId) {
      return next(new AppError("templateId is required", 400));
    }

    const profile = await resolveClientProfile({
      clientProfileId: req.body.clientProfileId,
      clientId: req.body.clientId,
    });

    if (String(profile.clientId) !== String(program.clientId)) {
      return next(
        new AppError(
          "Client profile must belong to the same client as the selected program",
          409,
        ),
      );
    }

    await ensureUserExists(profile.clientId, "Client user");
    await ensureTrainerClientRelationship(trainerId, profile.clientId);

    const startDate = program.startDate;

    const sourceMealTemplateId = await ensureSourceTemplate(
      templateId,
      trainerId,
      access,
    );

    const template = await prisma.mealTemplate.findUnique({
      where: { id: String(sourceMealTemplateId) },
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
      return next(new AppError("Meal template not found", 404));
    }

    if (template.days.length === 0) {
      return next(new AppError("Meal template has no days", 400));
    }

    const maxDayIndex = Math.max(...template.days.map((day) => day.dayIndex));
    const minRequiredEndDate = addDays(startDate, maxDayIndex);
    const endDate = program.endDate;

    ensureDateRange(startDate, endDate);
    if (endDate < minRequiredEndDate) {
      return next(
        new AppError(
          "endDate is too early for the template structure. Extend endDate.",
          400,
        ),
      );
    }

    const title =
      sanitizeOptionalString(req.body.title, "title", 200) ?? template.title;
    const notes = sanitizeOptionalString(req.body.notes, "notes", 4000);
    const status = normalizePlanStatus(req.body.status, "DRAFT");

    const createdPlanId = await prisma.$transaction(async (tx) => {
      const createdPlan = await tx.mealPlan.create({
        data: {
          sourceMealTemplateId,
          programId: program.id,
          trainerId,
          clientProfileId: profile.id,
          status,
          title,
          notes,
        },
        select: {
          id: true,
        },
      });

      for (const day of template.days) {
        const planDate = addDays(startDate, day.dayIndex);

        const createdDay = await tx.mealPlanDay.create({
          data: {
            mealPlanId: createdPlan.id,
            dayIndex: day.dayIndex,
            date: planDate,
            completedCount: 0,
            totalCount: day.items.length,
            totalCalories: 0,
            totalProtein: 0,
            totalCarbs: 0,
            totalFats: 0,
          },
          select: {
            id: true,
          },
        });

        if (day.items.length > 0) {
          await tx.mealPlanItem.createMany({
            data: day.items.map((item) => {
              if (item.food?.isArchived) {
                throw new AppError(
                  "Template contains archived food items. Update template first.",
                  409,
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
      }

      return createdPlan.id;
    });

    await recalcMealPlanSummary(createdPlanId);

    const created = await prisma.mealPlan.findUnique({
      where: { id: createdPlanId },
      select: PLAN_DETAILS_SELECT,
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return next(new AppError("Duplicate day or meal slot detected", 409));
    }
    return next(error);
  }
};

export const getMealPlans = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const { page, limit, skip, sort, order } = pagination(req, {
      defaultSort: "updatedAt",
      defaultOrder: "desc",
      defaultLimit: 20,
    });

    if (!ALLOWED_SORT_FIELDS.includes(sort)) {
      return next(new AppError("Invalid sort field", 400));
    }

    const trainerScopeId = resolveTrainerScopeId(req, access);

    const where = {};
    where.trainerId = trainerScopeId;

    if (req.query.clientProfileId) {
      where.clientProfileId = String(req.query.clientProfileId);
    }

    if (req.query.status) {
      where.status = normalizePlanStatus(req.query.status);
    }

    if (req.query.programId) {
      where.programId = String(req.query.programId);
    }

    if (req.query.startDate || req.query.endDate) {
      where.program = {};
      if (req.query.startDate) {
        where.program.startDate = {
          gte: parseDateOnly(req.query.startDate, "startDate"),
        };
      }
      if (req.query.endDate) {
        where.program.endDate = {
          lte: parseDateOnly(req.query.endDate, "endDate"),
        };
      }
    }

    const includeDays = parseOptionalBoolean(req.query.includeDays, false);

    const [total, plans] = await prisma.$transaction([
      prisma.mealPlan.count({ where }),
      prisma.mealPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort]: order,
        },
        select: includeDays ? PLAN_DETAILS_SELECT : PLAN_LIST_SELECT,
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

export const getMealPlanById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(
      access,
      ["TRAINER", "ADMIN", "OWNER", "DEVELOPER"],
      "Forbidden",
    );

    const planId = req.params.planId || req.params.id;
    if (!planId) {
      return next(new AppError("Meal plan ID is required", 400));
    }

    const plan = await prisma.mealPlan.findUnique({
      where: {
        id: String(planId),
      },
      select: PLAN_DETAILS_SELECT,
    });

    if (!plan) {
      return next(new AppError("Meal plan not found", 404));
    }

    ensurePlanAccess(
      access,
      plan.trainerId,
      "Forbidden: you can only view your own trainer plans",
    );

    return res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    return next(error);
  }
};

export const updateMealPlanById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const planId = req.params.planId || req.params.id;
    if (!planId) {
      return next(new AppError("Meal plan ID is required", 400));
    }

    const existing = await prisma.mealPlan.findUnique({
      where: { id: String(planId) },
      select: {
        id: true,
        programId: true,
        trainerId: true,
        clientProfile: {
          select: {
            clientId: true,
          },
        },
      },
    });

    if (!existing) {
      return next(new AppError("Meal plan not found", 404));
    }

    ensurePlanAccess(
      access,
      existing.trainerId,
      "Forbidden: plan does not belong to this trainer",
    );

    const data = {};

    if (req.body.title !== undefined) {
      data.title = sanitizeOptionalString(req.body.title, "title", 200);
    }

    if (req.body.notes !== undefined) {
      data.notes = sanitizeOptionalString(req.body.notes, "notes", 4000);
    }

    if (req.body.status !== undefined) {
      data.status = normalizePlanStatus(req.body.status);
    }

    if (req.body.programId !== undefined) {
      const program = await ensureProgramForMealPlan(req.body.programId);
      if (
        String(program.trainerId) !== String(existing.trainerId) ||
        String(program.clientId) !== String(existing.clientProfile.clientId)
      ) {
        return next(
          new AppError(
            "Program must belong to the same trainer and client",
            409,
          ),
        );
      }
      data.programId = program.id;
    }

    if (
      req.body.sourceMealTemplateId !== undefined &&
      req.body.sourceMealTemplateId !== null
    ) {
      data.sourceMealTemplateId = await ensureSourceTemplate(
        req.body.sourceMealTemplateId,
        existing.trainerId,
        access,
      );
    }

    if (req.body.sourceMealTemplateId === null) {
      data.sourceMealTemplateId = null;
    }

    const updated = await prisma.mealPlan.update({
      where: { id: existing.id },
      data,
      select: PLAN_LIST_SELECT,
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMealPlanById = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);
    ensureHasAnyRole(access, ["TRAINER"], "Forbidden: trainer role required");

    const planId = req.params.planId || req.params.id;
    if (!planId) {
      return next(new AppError("Meal plan ID is required", 400));
    }

    const plan = await prisma.mealPlan.findUnique({
      where: { id: String(planId) },
      select: {
        id: true,
        trainerId: true,
      },
    });

    if (!plan) {
      return next(new AppError("Meal plan not found", 404));
    }

    ensurePlanAccess(
      access,
      plan.trainerId,
      "Forbidden: plan does not belong to this trainer",
    );

    await prisma.mealPlan.delete({
      where: { id: plan.id },
    });

    return res.status(200).json({
      success: true,
      message: "Meal plan deleted",
    });
  } catch (error) {
    return next(error);
  }
};
