-- Add progress fields to meal plan and meal plan day.
ALTER TABLE "MealPlan"
ADD COLUMN "totalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "MealPlanDay"
ADD COLUMN "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill day-level percentage from existing counters.
UPDATE "MealPlanDay"
SET "percentage" = CASE
  WHEN "totalCount" > 0
    THEN ROUND(("completedCount"::numeric / "totalCount"::numeric) * 100, 2)::double precision
  ELSE 0
END;

-- Backfill plan-level totals and percentage from all days.
UPDATE "MealPlan" AS mp
SET
  "totalCount" = agg.total_count,
  "completedCount" = agg.completed_count,
  "percentage" = CASE
    WHEN agg.total_count > 0
      THEN ROUND((agg.completed_count::numeric / agg.total_count::numeric) * 100, 2)::double precision
    ELSE 0
  END
FROM (
  SELECT
    "mealPlanId",
    COALESCE(SUM("totalCount"), 0) AS total_count,
    COALESCE(SUM("completedCount"), 0) AS completed_count
  FROM "MealPlanDay"
  GROUP BY "mealPlanId"
) AS agg
WHERE mp."id" = agg."mealPlanId";
