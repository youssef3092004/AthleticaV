import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { getUserAccessContext } from "../utils/authz.js";

const parseDateParam = (dateStr) => {
  if (!dateStr) return new Date();

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD", 400);
  }

  // Set to start of day UTC
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const getDailySummary = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    if (!access?.userId) {
      throw new AppError("User not authenticated", 401);
    }

    const userId = String(access.userId);
    const { date } = req.query; // Optional: YYYY-MM-DD format

    const targetDate = parseDateParam(date);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get active meal plan
    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        clientId: userId,
        endDate: null, // or > today
      },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            carbs: true,
            protein: true,
            fat: true,
            calories: true,
          },
        },
      },
    });

    // Calculate target macros
    let targetCarbs = 0,
      targetProtein = 0,
      targetFat = 0,
      targetCalories = 0;

    if (mealPlan?.items) {
      mealPlan.items.forEach((item) => {
        targetCarbs += item.carbs || 0;
        targetProtein += item.protein || 0;
        targetFat += item.fat || 0;
        targetCalories += item.calories || 0;
      });
    }

    // Get completed meals for the day
    const completions = await prisma.mealCompletion.findMany({
      where: {
        clientId: userId,
        completedAt: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      select: {
        id: true,
        mealPlanItem: {
          select: {
            carbs: true,
            protein: true,
            fat: true,
            calories: true,
            mealType: true,
          },
        },
      },
    });

    // Calculate consumed macros
    let consumedCarbs = 0,
      consumedProtein = 0,
      consumedFat = 0,
      consumedCalories = 0;

    const mealsByType = {
      BREAKFAST: [],
      LUNCH: [],
      SNACK: [],
      DINNER: [],
      OTHERS: [],
    };

    completions.forEach((completion) => {
      const macro = completion.mealPlanItem;
      consumedCarbs += macro.carbs || 0;
      consumedProtein += macro.protein || 0;
      consumedFat += macro.fat || 0;
      consumedCalories += macro.calories || 0;

      const mealType = macro.mealType || "OTHERS";
      mealsByType[mealType].push({
        carbs: macro.carbs || 0,
        protein: macro.protein || 0,
        fat: macro.fat || 0,
        calories: macro.calories || 0,
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        date: targetDate.toISOString().split("T")[0],
        macros: {
          carbs: {
            consumed: Math.round(consumedCarbs),
            target: Math.round(targetCarbs),
            percentage:
              targetCarbs > 0
                ? Math.round((consumedCarbs / targetCarbs) * 100)
                : 0,
          },
          protein: {
            consumed: Math.round(consumedProtein),
            target: Math.round(targetProtein),
            percentage:
              targetProtein > 0
                ? Math.round((consumedProtein / targetProtein) * 100)
                : 0,
          },
          fat: {
            consumed: Math.round(consumedFat),
            target: Math.round(targetFat),
            percentage:
              targetFat > 0 ? Math.round((consumedFat / targetFat) * 100) : 0,
          },
          calories: {
            consumed: Math.round(consumedCalories),
            target: Math.round(targetCalories),
            percentage:
              targetCalories > 0
                ? Math.round((consumedCalories / targetCalories) * 100)
                : 0,
          },
        },
        mealsByType,
        totalCompletions: completions.length,
      },
    });
  } catch (error) {
    return next(error);
  }
};
