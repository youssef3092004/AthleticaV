/*
  Warnings:

  - The values [CANCELLED] on the enum `MealPlanStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SNACK] on the enum `MealTime` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `createdAt` on the `ClientProfile` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ClientProfile` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `generatedAt` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `baseGramsSnapshot` on the `MealPlanItem` table. All the data in the column will be lost.
  - You are about to drop the column `mealType` on the `MealPlanItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[clientId]` on the table `ClientProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `clientId` to the `ClientProfile` table without a default value. This is not possible if the table is not empty.
  - Made the column `age` on table `ClientProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `heightCm` on table `ClientProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `weightKg` on table `ClientProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fitnessGoal` on table `ClientProfile` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `categoryId` to the `Food` table without a default value. This is not possible if the table is not empty.
  - Added the required column `clientProfileId` to the `MealPlan` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MealPlanStatus_new" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
ALTER TABLE "public"."MealPlan" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "MealPlan" ALTER COLUMN "status" TYPE "MealPlanStatus_new" USING ("status"::text::"MealPlanStatus_new");
ALTER TYPE "MealPlanStatus" RENAME TO "MealPlanStatus_old";
ALTER TYPE "MealPlanStatus_new" RENAME TO "MealPlanStatus";
DROP TYPE "public"."MealPlanStatus_old";
ALTER TABLE "MealPlan" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MealTime_new" AS ENUM ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'EVENING_SNACK');
ALTER TABLE "MealTemplateItem" ALTER COLUMN "mealTime" TYPE "MealTime_new" USING ("mealTime"::text::"MealTime_new");
ALTER TABLE "MealPlanItem" ALTER COLUMN "mealTime" TYPE "MealTime_new" USING ("mealTime"::text::"MealTime_new");
ALTER TYPE "MealTime" RENAME TO "MealTime_old";
ALTER TYPE "MealTime_new" RENAME TO "MealTime";
DROP TYPE "public"."MealTime_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "ClientProfile" DROP CONSTRAINT "ClientProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "MealPlan" DROP CONSTRAINT "MealPlan_clientId_fkey";

-- DropIndex
DROP INDEX "ClientProfile_age_idx";

-- DropIndex
DROP INDEX "ClientProfile_createdAt_idx";

-- DropIndex
DROP INDEX "ClientProfile_userId_age_idx";

-- DropIndex
DROP INDEX "ClientProfile_userId_createdAt_idx";

-- DropIndex
DROP INDEX "ClientProfile_userId_idx";

-- DropIndex
DROP INDEX "ClientProfile_userId_key";

-- DropIndex
DROP INDEX "Food_name_baseGrams_idx";

-- DropIndex
DROP INDEX "MealPlan_clientId_status_startDate_idx";

-- DropIndex
DROP INDEX "MealPlanItem_mealPlanDayId_idx";

-- DropIndex
DROP INDEX "MealPlanItem_mealPlanDayId_mealTime_sortOrder_key";

-- DropIndex
DROP INDEX "MealPlanItem_mealTime_idx";

-- DropIndex
DROP INDEX "MealPlanItem_mealType_idx";

-- DropIndex
DROP INDEX "MealTemplateItem_dayId_idx";

-- DropIndex
DROP INDEX "MealTemplateItem_dayId_mealTime_sortOrder_key";

-- AlterTable
ALTER TABLE "ClientProfile" DROP COLUMN "createdAt",
DROP COLUMN "userId",
ADD COLUMN     "clientId" UUID NOT NULL,
ADD COLUMN     "dietaryNotes" TEXT,
ADD COLUMN     "targetCalories" DOUBLE PRECISION,
ADD COLUMN     "targetCarbs" DOUBLE PRECISION,
ADD COLUMN     "targetFat" DOUBLE PRECISION,
ADD COLUMN     "targetProtein" DOUBLE PRECISION,
ALTER COLUMN "age" SET NOT NULL,
ALTER COLUMN "heightCm" SET NOT NULL,
ALTER COLUMN "heightCm" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "weightKg" SET NOT NULL,
ALTER COLUMN "weightKg" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "fitnessGoal" SET NOT NULL;

-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "categoryId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "MealPlan" DROP COLUMN "clientId",
DROP COLUMN "generatedAt",
ADD COLUMN     "clientProfileId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "MealPlanDay" ADD COLUMN     "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MealPlanItem" DROP COLUMN "baseGramsSnapshot",
DROP COLUMN "mealType";

-- AlterTable
ALTER TABLE "MealTemplate" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MealTemplateDay" ADD COLUMN     "label" TEXT;

-- CreateTable
CREATE TABLE "FoodCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealCompletion" (
    "id" UUID NOT NULL,
    "mealPlanItemId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "MealCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodCategory_name_key" ON "FoodCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MealCompletion_mealPlanItemId_key" ON "MealCompletion"("mealPlanItemId");

-- CreateIndex
CREATE INDEX "MealCompletion_clientId_completedAt_idx" ON "MealCompletion"("clientId", "completedAt");

-- CreateIndex
CREATE INDEX "MealCompletion_mealPlanItemId_idx" ON "MealCompletion"("mealPlanItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_clientId_key" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientProfile_clientId_idx" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "Food_categoryId_isArchived_idx" ON "Food"("categoryId", "isArchived");

-- CreateIndex
CREATE INDEX "MealPlan_clientProfileId_status_startDate_idx" ON "MealPlan"("clientProfileId", "status", "startDate");

-- CreateIndex
CREATE INDEX "MealPlanItem_mealPlanDayId_mealTime_idx" ON "MealPlanItem"("mealPlanDayId", "mealTime");

-- CreateIndex
CREATE INDEX "MealTemplate_isPublic_isArchived_idx" ON "MealTemplate"("isPublic", "isArchived");

-- CreateIndex
CREATE INDEX "MealTemplateItem_dayId_mealTime_idx" ON "MealTemplateItem"("dayId", "mealTime");

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCompletion" ADD CONSTRAINT "MealCompletion_mealPlanItemId_fkey" FOREIGN KEY ("mealPlanItemId") REFERENCES "MealPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCompletion" ADD CONSTRAINT "MealCompletion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
