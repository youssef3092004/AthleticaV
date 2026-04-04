import { prisma } from "../configs/db.js";

export const recalcWorkoutSummary = async (workoutId, tx = prisma) => {
  const scopedWorkoutId = String(workoutId);

  const aggregate = await tx.workoutDay.aggregate({
    where: {
      workoutId: scopedWorkoutId,
    },
    _sum: {
      totalCount: true,
      completedCount: true,
    },
  });

  const totalCount = aggregate._sum.totalCount ?? 0;
  const completedCount = aggregate._sum.completedCount ?? 0;

  await tx.workout.update({
    where: { id: scopedWorkoutId },
    data: {
      totalCount,
      completedCount,
    },
  });
};

export const recalcWorkoutDayAndSummary = async (workoutDayId, tx = prisma) => {
  const scopedDayId = String(workoutDayId);

  const dayMeta = await tx.workoutDay.findUnique({
    where: { id: scopedDayId },
    select: {
      id: true,
      workoutId: true,
    },
  });

  if (!dayMeta) {
    return;
  }

  const [totalCount, completedCount] = await Promise.all([
    tx.workoutItem.count({
      where: { workoutDayId: scopedDayId },
    }),
    tx.workoutCompletion.count({
      where: {
        workoutItem: {
          workoutDayId: scopedDayId,
        },
      },
    }),
  ]);

  await tx.workoutDay.update({
    where: { id: scopedDayId },
    data: {
      totalCount,
      completedCount,
    },
  });

  await recalcWorkoutSummary(dayMeta.workoutId, tx);
};
