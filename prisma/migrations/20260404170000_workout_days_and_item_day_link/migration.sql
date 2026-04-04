-- Add WorkoutDay model.
CREATE TABLE "WorkoutDay" (
  "id" UUID NOT NULL,
  "workoutId" UUID NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutDay_workoutId_dayIndex_key" ON "WorkoutDay"("workoutId", "dayIndex");
CREATE UNIQUE INDEX "WorkoutDay_workoutId_date_key" ON "WorkoutDay"("workoutId", "date");
CREATE INDEX "WorkoutDay_workoutId_idx" ON "WorkoutDay"("workoutId");
CREATE INDEX "WorkoutDay_date_idx" ON "WorkoutDay"("date");

ALTER TABLE "WorkoutDay"
ADD CONSTRAINT "WorkoutDay_workoutId_fkey"
FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add optional link from WorkoutItem to WorkoutDay for day-based grouping.
ALTER TABLE "WorkoutItem"
ADD COLUMN "workoutDayId" UUID;

CREATE INDEX "WorkoutItem_workoutDayId_idx" ON "WorkoutItem"("workoutDayId");

ALTER TABLE "WorkoutItem"
ADD CONSTRAINT "WorkoutItem_workoutDayId_fkey"
FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill one day per workout so existing items can be linked safely.
INSERT INTO "WorkoutDay" ("id", "workoutId", "dayIndex", "date", "title", "createdAt")
SELECT gen_random_uuid(), w."id", 0, w."startDate", 'Day 1', NOW()
FROM "Workout" w
WHERE NOT EXISTS (
  SELECT 1 FROM "WorkoutDay" wd WHERE wd."workoutId" = w."id"
);

UPDATE "WorkoutItem" wi
SET "workoutDayId" = wd."id"
FROM "WorkoutDay" wd
WHERE wi."workoutId" = wd."workoutId"
  AND wd."dayIndex" = 0
  AND wi."workoutDayId" IS NULL;
