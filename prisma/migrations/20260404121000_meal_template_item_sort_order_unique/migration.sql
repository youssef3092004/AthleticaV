-- Enforce deterministic ordering inside each meal slot in a template day.
WITH ranked AS (
	SELECT
		ctid,
		ROW_NUMBER() OVER (
			PARTITION BY "dayId", "mealTime", "sortOrder"
			ORDER BY "createdAt" ASC, "id" ASC
		) AS rn
	FROM "MealTemplateItem"
)
DELETE FROM "MealTemplateItem"
WHERE ctid IN (
	SELECT ctid
	FROM ranked
	WHERE rn > 1
);

CREATE UNIQUE INDEX "MealTemplateItem_dayId_mealTime_sortOrder_key"
ON "MealTemplateItem"("dayId", "mealTime", "sortOrder");
