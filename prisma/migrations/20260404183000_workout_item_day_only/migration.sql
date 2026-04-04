-- Ensure every WorkoutItem is linked to a WorkoutDay.
INSERT INTO "WorkoutDay" ("id", "workoutId", "dayIndex", "date", "title", "createdAt")
SELECT gen_random_uuid(), w."id", 0, w."startDate", 'Day 1', NOW()
FROM "Workout" w
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkoutDay" wd WHERE wd."workoutId" = w."id"
);

UPDATE "WorkoutItem" wi
SET "workoutDayId" = wd."id"
FROM "WorkoutDay" wd
WHERE wd."workoutId" = wi."workoutId"
  AND wd."dayIndex" = 0
  AND wi."workoutDayId" IS NULL;

-- Remove old index + FK + column for direct workoutId linkage.
DROP INDEX IF EXISTS "WorkoutItem_workoutId_idx";

ALTER TABLE "WorkoutItem"
DROP CONSTRAINT IF EXISTS "WorkoutItem_workoutId_fkey";

ALTER TABLE "WorkoutItem"
ALTER COLUMN "workoutDayId" SET NOT NULL;

ALTER TABLE "WorkoutItem"
DROP COLUMN "workoutId";

-- Recreate the relation with cascade and enforce day order uniqueness.
ALTER TABLE "WorkoutItem"
DROP CONSTRAINT IF EXISTS "WorkoutItem_workoutDayId_fkey";

ALTER TABLE "WorkoutItem"
ADD CONSTRAINT "WorkoutItem_workoutDayId_fkey"
FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "WorkoutItem_workoutDayId_order_key" ON "WorkoutItem"("workoutDayId", "order");
