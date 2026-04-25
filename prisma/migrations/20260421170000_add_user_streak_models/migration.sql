-- Create DayPlan table
CREATE TABLE "DayPlan" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "hasWorkout" BOOLEAN NOT NULL DEFAULT false,
  "hasNutrition" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

-- Create DayProgress table
CREATE TABLE "DayProgress" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "workoutCompleted" BOOLEAN NOT NULL DEFAULT false,
  "nutritionCompleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DayProgress_pkey" PRIMARY KEY ("id")
);

-- Create UserStreak table
CREATE TABLE "UserStreak" (
  "userId" UUID NOT NULL,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "lastCompletedDate" DATE,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("userId")
);

-- Indexes and unique constraints
CREATE UNIQUE INDEX "DayPlan_userId_date_key" ON "DayPlan"("userId", "date");
CREATE INDEX "DayPlan_userId_date_idx" ON "DayPlan"("userId", "date");

CREATE UNIQUE INDEX "DayProgress_userId_date_key" ON "DayProgress"("userId", "date");
CREATE INDEX "DayProgress_userId_date_idx" ON "DayProgress"("userId", "date");

-- Foreign keys
ALTER TABLE "DayPlan"
ADD CONSTRAINT "DayPlan_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DayProgress"
ADD CONSTRAINT "DayProgress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserStreak"
ADD CONSTRAINT "UserStreak_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
