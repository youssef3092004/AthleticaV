import { prisma } from "../configs/db.js";

const toRoundedPercentage = (completedCount, totalCount) => {
  if (!totalCount || totalCount <= 0) return 0;
  const raw = (Number(completedCount) / Number(totalCount)) * 100;
  return Number(raw.toFixed(2));
};

const toRoundedMacro = (value) => Number(Number(value || 0).toFixed(2));

export const recalcMealPlanSummary = async (mealPlanId, tx = prisma) => {
  const scopedPlanId = String(mealPlanId);

  const aggregate = await tx.mealPlanDay.aggregate({
    where: {
      mealPlanId: scopedPlanId,
    },
    _sum: {
      totalCount: true,
      completedCount: true,
    },
  });

  const totalCount = aggregate._sum.totalCount ?? 0;
  const completedCount = aggregate._sum.completedCount ?? 0;
  const percentage = toRoundedPercentage(completedCount, totalCount);

  await tx.mealPlan.update({
    where: { id: scopedPlanId },
    data: {
      totalCount,
      completedCount,
      percentage,
    },
  });
};

export const recalcMealPlanDayAndSummary = async (
  mealPlanDayId,
  tx = prisma,
) => {
  const scopedDayId = String(mealPlanDayId);

  const [dayMeta, totalCount, completedCount, completedNutrition] =
    await tx.$transaction([
      tx.mealPlanDay.findUnique({
        where: { id: scopedDayId },
        select: {
          id: true,
          mealPlanId: true,
        },
      }),
      tx.mealPlanItem.count({
        where: { mealPlanDayId: scopedDayId },
      }),
      tx.mealCompletion.count({
        where: {
          mealPlanItem: {
            mealPlanDayId: scopedDayId,
          },
        },
      }),
      tx.mealPlanItem.aggregate({
        where: {
          mealPlanDayId: scopedDayId,
          completion: {
            isNot: null,
          },
        },
        _sum: {
          caloriesSnapshot: true,
          proteinSnapshot: true,
          carbsSnapshot: true,
          fatSnapshot: true,
        },
      }),
    ]);

  if (!dayMeta) {
    return;
  }

  const percentage = toRoundedPercentage(completedCount, totalCount);
  const totalCalories = toRoundedMacro(
    completedNutrition._sum.caloriesSnapshot,
  );
  const totalProtein = toRoundedMacro(completedNutrition._sum.proteinSnapshot);
  const totalCarbs = toRoundedMacro(completedNutrition._sum.carbsSnapshot);
  const totalFats = toRoundedMacro(completedNutrition._sum.fatSnapshot);

  await tx.mealPlanDay.update({
    where: { id: scopedDayId },
    data: {
      totalCount,
      completedCount,
      percentage,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFats,
    },
  });

  await recalcMealPlanSummary(dayMeta.mealPlanId, tx);
};
