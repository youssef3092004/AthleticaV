-- Align Exercise model with real exercise dataset shape
-- and preserve existing rows by mapping old columns.

-- Make trainer relation optional to support default/global exercises.
ALTER TABLE "Exercise" DROP CONSTRAINT IF EXISTS "Exercise_trainerId_fkey";
ALTER TABLE "Exercise" ALTER COLUMN "trainerId" DROP NOT NULL;

-- Rename old columns used in current API.
ALTER TABLE "Exercise" RENAME COLUMN "name" TO "name_en";
ALTER TABLE "Exercise" RENAME COLUMN "videoUrl" TO "video_url";

-- Add new real-data columns.
ALTER TABLE "Exercise"
  ADD COLUMN IF NOT EXISTS "name_ar" TEXT,
  ADD COLUMN IF NOT EXISTS "primary_muscle" TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS "secondary_muscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "equipment" TEXT DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS "difficulty" TEXT DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS "exercise_type" TEXT DEFAULT 'strength',
  ADD COLUMN IF NOT EXISTS "classification" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "movement_pattern" TEXT DEFAULT 'Other',
  ADD COLUMN IF NOT EXISTS "fitness_goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "workout_location" TEXT DEFAULT 'gym',
  ADD COLUMN IF NOT EXISTS "media_type" TEXT DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS "media_url" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'Important',
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill from old enum category + old videoUrl where possible.
UPDATE "Exercise"
SET "primary_muscle" = CASE "category"
  WHEN 'CHEST' THEN 'chest'
  WHEN 'BACK' THEN 'back'
  WHEN 'LEGS' THEN 'quads'
  WHEN 'ARMS' THEN 'biceps'
  WHEN 'SHOULDERS' THEN 'shoulders'
  WHEN 'CORE' THEN 'core'
  WHEN 'CARDIO' THEN 'full body'
  ELSE 'other'
END
WHERE "primary_muscle" IS NULL OR "primary_muscle" = 'other';

UPDATE "Exercise"
SET "movement_pattern" = CASE "category"
  WHEN 'CHEST' THEN 'Push'
  WHEN 'SHOULDERS' THEN 'Push'
  WHEN 'BACK' THEN 'Pull'
  WHEN 'ARMS' THEN 'Pull'
  WHEN 'LEGS' THEN 'Squat'
  WHEN 'CORE' THEN 'Core'
  WHEN 'CARDIO' THEN 'Conditioning'
  ELSE 'Other'
END
WHERE "movement_pattern" IS NULL OR "movement_pattern" = 'Other';

UPDATE "Exercise"
SET "media_url" = COALESCE(NULLIF("video_url", ''), 'https://example.com/exercises/placeholder')
WHERE "media_url" IS NULL OR "media_url" = '';

-- Remove obsolete enum column after backfill.
ALTER TABLE "Exercise" DROP COLUMN IF EXISTS "category";
DROP TYPE IF EXISTS "Category";

-- Enforce required fields.
ALTER TABLE "Exercise" ALTER COLUMN "name_en" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "primary_muscle" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "secondary_muscles" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "equipment" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "difficulty" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "exercise_type" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "classification" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "movement_pattern" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "fitness_goals" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "workout_location" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "media_type" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "media_url" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "tags" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "is_default" SET NOT NULL;
ALTER TABLE "Exercise" ALTER COLUMN "priority" SET NOT NULL;

-- Re-add FK with SetNull behavior.
ALTER TABLE "Exercise"
  ADD CONSTRAINT "Exercise_trainerId_fkey"
  FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Helpful search/filter indexes.
CREATE INDEX IF NOT EXISTS "Exercise_name_en_idx" ON "Exercise"("name_en");
CREATE INDEX IF NOT EXISTS "Exercise_primary_muscle_idx" ON "Exercise"("primary_muscle");
CREATE INDEX IF NOT EXISTS "Exercise_equipment_idx" ON "Exercise"("equipment");
CREATE INDEX IF NOT EXISTS "Exercise_difficulty_idx" ON "Exercise"("difficulty");
CREATE INDEX IF NOT EXISTS "Exercise_exercise_type_idx" ON "Exercise"("exercise_type");
CREATE INDEX IF NOT EXISTS "Exercise_workout_location_idx" ON "Exercise"("workout_location");
CREATE INDEX IF NOT EXISTS "Exercise_is_default_idx" ON "Exercise"("is_default");
CREATE INDEX IF NOT EXISTS "Exercise_priority_idx" ON "Exercise"("priority");
