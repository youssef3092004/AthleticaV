-- Enforce deterministic ordering for meal plan items inside each day and meal slot.
WITH ranked AS (
	SELECT
		ctid,
		ROW_NUMBER() OVER (
			PARTITION BY "mealPlanDayId", "mealTime", "sortOrder"
			ORDER BY "createdAt" ASC, "id" ASC
		) AS rn
	FROM "MealPlanItem"
)
DELETE FROM "MealPlanItem"
WHERE ctid IN (
	SELECT ctid
	FROM ranked
	WHERE rn > 1
);

CREATE UNIQUE INDEX "MealPlanItem_mealPlanDayId_mealTime_sortOrder_key"
ON "MealPlanItem"("mealPlanDayId", "mealTime", "sortOrder");
