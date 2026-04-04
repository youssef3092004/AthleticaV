-- Add workout/day counters.
ALTER TABLE "Workout"
ADD COLUMN "totalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "WorkoutDay"
ADD COLUMN "totalCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "completedCount" INTEGER NOT NULL DEFAULT 0;

-- Create workout completion table.
CREATE TABLE "WorkoutCompletion" (
  "id" UUID NOT NULL,
  "workoutItemId" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,

  CONSTRAINT "WorkoutCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutCompletion_workoutItemId_key" ON "WorkoutCompletion"("workoutItemId");
CREATE INDEX "WorkoutCompletion_clientId_completedAt_idx" ON "WorkoutCompletion"("clientId", "completedAt");
CREATE INDEX "WorkoutCompletion_workoutItemId_idx" ON "WorkoutCompletion"("workoutItemId");

ALTER TABLE "WorkoutCompletion"
ADD CONSTRAINT "WorkoutCompletion_workoutItemId_fkey"
FOREIGN KEY ("workoutItemId") REFERENCES "WorkoutItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutCompletion"
ADD CONSTRAINT "WorkoutCompletion_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill day totals from existing workout items.
UPDATE "WorkoutDay" d
SET "totalCount" = src.total
FROM (
  SELECT "workoutDayId", COUNT(*)::INTEGER AS total
  FROM "WorkoutItem"
  GROUP BY "workoutDayId"
) src
WHERE d."id" = src."workoutDayId";

-- Backfill workout totals from day totals.
UPDATE "Workout" w
SET
  "totalCount" = src.total,
  "completedCount" = src.completed
FROM (
  SELECT
    "workoutId",
    COALESCE(SUM("totalCount"), 0)::INTEGER AS total,
    COALESCE(SUM("completedCount"), 0)::INTEGER AS completed
  FROM "WorkoutDay"
  GROUP BY "workoutId"
) src
WHERE w."id" = src."workoutId";
