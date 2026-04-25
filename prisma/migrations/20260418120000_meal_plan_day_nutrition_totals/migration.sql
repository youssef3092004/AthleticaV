-- Add daily nutrition totals to meal plan days.
ALTER TABLE "MealPlanDay"
ADD COLUMN "totalCalories" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalFats" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill totals from completed meal items only.
UPDATE "MealPlanDay" AS mpd
SET
  "totalCalories" = agg.total_calories,
  "totalProtein" = agg.total_protein,
  "totalCarbs" = agg.total_carbs,
  "totalFats" = agg.total_fats
FROM (
  SELECT
    mpi."mealPlanDayId" AS day_id,
    COALESCE(ROUND(SUM(mpi."caloriesSnapshot")::numeric, 2)::double precision, 0) AS total_calories,
    COALESCE(ROUND(SUM(mpi."proteinSnapshot")::numeric, 2)::double precision, 0) AS total_protein,
    COALESCE(ROUND(SUM(mpi."carbsSnapshot")::numeric, 2)::double precision, 0) AS total_carbs,
    COALESCE(ROUND(SUM(mpi."fatSnapshot")::numeric, 2)::double precision, 0) AS total_fats
  FROM "MealPlanItem" AS mpi
  INNER JOIN "MealCompletion" AS mc
    ON mc."mealPlanItemId" = mpi."id"
  GROUP BY mpi."mealPlanDayId"
) AS agg
WHERE mpd."id" = agg.day_id;
