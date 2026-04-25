import { prisma } from "../configs/db.js";

const toDateKey = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const fromDateKey = (key) => {
  if (!key) return null;
  return new Date(`${key}T00:00:00.000Z`);
};

const isCounterCompleted = (totalCount, completedCount) => {
  const total = Number(totalCount) || 0;
  const completed = Number(completedCount) || 0;

  if (total <= 0) return false;
  return completed >= total;
};

export const isDayCompleted = (plan, progress) => {
  if (!plan) return false;

  const hasWorkout = Boolean(plan.hasWorkout);
  const hasNutrition = Boolean(plan.hasNutrition);

  // Rest day with no required tasks is ignored by caller and should not affect streak.
  if (!hasWorkout && !hasNutrition) { 
    return false;
  }

  if (hasWorkout && !Boolean(progress?.workoutCompleted)) {
    return false;
  }

  if (hasNutrition && !Boolean(progress?.nutritionCompleted)) {
    return false;
  }

  return true;
};

const buildDayRows = ({ userId, workoutDays, mealDays }) => {
  const rowsByDate = new Map();

  const getOrCreate = (dateKey) => {
    let row = rowsByDate.get(dateKey);
    if (!row) {
      row = {
        userId,
        date: dateKey,
        hasWorkout: false,
        hasNutrition: false,
        workoutCompleted: true,
        nutritionCompleted: true,
      };
      rowsByDate.set(dateKey, row);
    }
    return row;
  };

  for (const day of workoutDays) {
    const dateKey = toDateKey(day.date);
    if (!dateKey) continue;

    const row = getOrCreate(dateKey);
    row.hasWorkout = true;
    row.workoutCompleted =
      row.workoutCompleted &&
      isCounterCompleted(day.totalCount, day.completedCount);
  }

  for (const day of mealDays) {
    const dateKey = toDateKey(day.date);
    if (!dateKey) continue;

    const row = getOrCreate(dateKey);
    row.hasNutrition = true;
    row.nutritionCompleted =
      row.nutritionCompleted &&
      isCounterCompleted(day.totalCount, day.completedCount);
  }

  return Array.from(rowsByDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
};

const calculateStreakFromRows = (rows, allowGracePeriod = false) => {
  const graceDays = allowGracePeriod ? 1 : 0;

  let currentStreak = 0;
  let longestStreak = 0;
  let lastCompletedDate = null;
  let remainingGrace = graceDays;

  for (const row of rows) {
    const plan = {
      hasWorkout: row.hasWorkout,
      hasNutrition: row.hasNutrition,
    };

    const progress = {
      workoutCompleted: row.workoutCompleted,
      nutritionCompleted: row.nutritionCompleted,
    };

    // Do not affect streak for empty plan days.
    if (!plan.hasWorkout && !plan.hasNutrition) {
      continue;
    }

    const completed = isDayCompleted(plan, progress);

    if (completed) {
      currentStreak += 1;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
      lastCompletedDate = row.date;
      remainingGrace = graceDays;
      continue;
    }

    if (remainingGrace > 0) {
      remainingGrace -= 1;
      continue;
    }

    currentStreak = 0;
    remainingGrace = graceDays;
  }

  return {
    currentStreak,
    longestStreak,
    lastCompletedDate,
  };
};

export const calculateUserStreak = async (userId, options = {}) => {
  const scopedUserId = String(userId);
  const allowGracePeriod = Boolean(options.allowGracePeriod);

  const [workoutDays, mealDays] = await Promise.all([
    prisma.workoutDay.findMany({
      where: {
        workout: {
          clientId: scopedUserId,
        },
      },
      select: {
        date: true,
        totalCount: true,
        completedCount: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
    prisma.mealPlanDay.findMany({
      where: {
        mealPlan: {
          clientProfile: {
            clientId: scopedUserId,
          },
        },
      },
      select: {
        date: true,
        totalCount: true,
        completedCount: true,
      },
      orderBy: {
        date: "asc",
      },
    }),
  ]);

  const rows = buildDayRows({
    userId: scopedUserId,
    workoutDays,
    mealDays,
  });

  const { currentStreak, longestStreak, lastCompletedDate } =
    calculateStreakFromRows(rows, allowGracePeriod);

  const dayPlans = rows.map((row) => ({
    userId: scopedUserId,
    date: fromDateKey(row.date),
    hasWorkout: row.hasWorkout,
    hasNutrition: row.hasNutrition,
  }));

  const dayProgresses = rows.map((row) => ({
    userId: scopedUserId,
    date: fromDateKey(row.date),
    workoutCompleted: row.hasWorkout ? row.workoutCompleted : false,
    nutritionCompleted: row.hasNutrition ? row.nutritionCompleted : false,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.dayPlan.deleteMany({
      where: {
        userId: scopedUserId,
      },
    });

    if (dayPlans.length > 0) {
      await tx.dayPlan.createMany({
        data: dayPlans,
      });
    }

    await tx.dayProgress.deleteMany({
      where: {
        userId: scopedUserId,
      },
    });

    if (dayProgresses.length > 0) {
      await tx.dayProgress.createMany({
        data: dayProgresses,
      });
    }

    await tx.userStreak.upsert({
      where: {
        userId: scopedUserId,
      },
      update: {
        currentStreak,
        longestStreak,
        lastCompletedDate: fromDateKey(lastCompletedDate),
      },
      create: {
        userId: scopedUserId,
        currentStreak,
        longestStreak,
        lastCompletedDate: fromDateKey(lastCompletedDate),
      },
    });
  });

  return {
    userId: scopedUserId,
    currentStreak,
    longestStreak,
    lastCompletedDate,
    totalPlannedDays: rows.length,
  };
};
