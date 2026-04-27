import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { getUserAccessContext } from "../utils/authz.js";
import { calculateUserStreak } from "../utils/streakService.js";

export const getCurrentStreak = async (req, res, next) => {
  try {
    const access = await getUserAccessContext(req);

    if (!access?.userId) {
      throw new AppError("User not authenticated", 401);
    }

    const userId = String(access.userId);

    // Recalculate streak from workoutDays and mealPlanDays
    const streakData = await calculateUserStreak(userId);

    // Get DayProgress records for current month calendar
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const dayProgresses = await prisma.dayProgress.findMany({
      where: {
        userId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        date: true,
        workoutCompleted: true,
        nutritionCompleted: true,
      },
      orderBy: { date: "asc" },
    });

    // Build calendar data
    const workoutDays = [];
    for (
      let i = 1;
      i <= new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      i++
    ) {
      const date = new Date(now.getFullYear(), now.getMonth(), i);
      const dateStr = date.toISOString().split("T")[0];

      const progress = dayProgresses.find(
        (p) => p.date.toISOString().split("T")[0] === dateStr,
      );

      workoutDays.push({
        date: dateStr,
        workoutCompleted: progress?.workoutCompleted || false,
        nutritionCompleted: progress?.nutritionCompleted || false,
        dayOfWeek: date.toLocaleDateString("en-US", { weekday: "short" }),
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        lastCompletedDate: streakData.lastCompletedDate,
        month: now.toLocaleString("en-US", { month: "long", year: "numeric" }),
        workoutDays,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Called from workoutCompletion controller when workout is marked complete.
 * Recalculates streaks based on all workouts + meals for the user.
 * This is centralized in streakService for consistency.
 */
export const updateStreakOnCompletion = async (userId) => {
  try {
    // Use streakService to recalculate from source data (workoutDays + mealPlanDays)
    // This ensures streaks are always consistent with actual plan completion
    await calculateUserStreak(String(userId), { allowGracePeriod: false });
  } catch (error) {
    console.error("Error updating streak:", error);
    // Don't throw - streak update should not block workout completion
  }
};
