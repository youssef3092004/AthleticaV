-- Create day-based workout template structure.
CREATE TABLE "WorkoutTemplateDay" (
  "id" UUID NOT NULL,
  "workoutTemplateId" UUID NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkoutTemplateDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutTemplateDay_workoutTemplateId_dayIndex_key" ON "WorkoutTemplateDay"("workoutTemplateId", "dayIndex");
CREATE INDEX "WorkoutTemplateDay_workoutTemplateId_idx" ON "WorkoutTemplateDay"("workoutTemplateId");

ALTER TABLE "WorkoutTemplateDay"
ADD CONSTRAINT "WorkoutTemplateDay_workoutTemplateId_fkey"
FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkoutTemplateItem" (
  "id" UUID NOT NULL,
  "workoutTemplateDayId" UUID NOT NULL,
  "exerciseId" UUID NOT NULL,
  "sets" INTEGER NOT NULL,
  "reps" INTEGER NOT NULL,
  "restSeconds" INTEGER NOT NULL,
  "order" INTEGER NOT NULL,
  "notes" TEXT,
  "tempo" TEXT,
  "rir" INTEGER,
  "rpe" DOUBLE PRECISION,

  CONSTRAINT "WorkoutTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutTemplateItem_workoutTemplateDayId_order_key" ON "WorkoutTemplateItem"("workoutTemplateDayId", "order");
CREATE INDEX "WorkoutTemplateItem_workoutTemplateDayId_idx" ON "WorkoutTemplateItem"("workoutTemplateDayId");
CREATE INDEX "WorkoutTemplateItem_exerciseId_idx" ON "WorkoutTemplateItem"("exerciseId");

ALTER TABLE "WorkoutTemplateItem"
ADD CONSTRAINT "WorkoutTemplateItem_workoutTemplateDayId_fkey"
FOREIGN KEY ("workoutTemplateDayId") REFERENCES "WorkoutTemplateDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkoutTemplateItem"
ADD CONSTRAINT "WorkoutTemplateItem_exerciseId_fkey"
FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
