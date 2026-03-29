/*
  Warnings:

  - You are about to drop the column `multiplier` on the `FoodPortion` table. All the data in the column will be lost.
  - You are about to drop the column `mealTemplateId` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `mealPlanId` on the `MealPlanItem` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[foodId,label]` on the table `FoodPortion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,foodId]` on the table `FoodPortion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[mealPlanDayId,mealTime,sortOrder]` on the table `MealPlanItem` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `baseGrams` to the `Food` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Food` table without a default value. This is not possible if the table is not empty.
  - Added the required column `grams` to the `FoodPortion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MealPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `baseGramsSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `caloriesSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carbsSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `foodNameSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gramsPerPortion` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mealPlanDayId` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `portionLabelSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proteinSnapshot` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MealPlanItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `MealTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "MealPlan" DROP CONSTRAINT "MealPlan_mealTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "MealPlanItem" DROP CONSTRAINT "MealPlanItem_mealPlanId_fkey";

-- DropForeignKey
ALTER TABLE "MealPlanItem" DROP CONSTRAINT "MealPlanItem_portionId_fkey";

-- AlterTable
ALTER TABLE "Food" ADD COLUMN     "baseGrams" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "FoodPortion" DROP COLUMN "multiplier",
ADD COLUMN     "grams" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "MealPlan" DROP COLUMN "mealTemplateId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "sourceMealTemplateId" UUID,
ADD COLUMN     "status" "MealPlanStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "title" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MealPlanItem" DROP COLUMN "mealPlanId",
ADD COLUMN     "baseGramsSnapshot" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "caloriesSnapshot" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "carbsSnapshot" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fatSnapshot" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "foodNameSnapshot" TEXT NOT NULL,
ADD COLUMN     "gramsPerPortion" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "mealPlanDayId" UUID NOT NULL,
ADD COLUMN     "portionLabelSnapshot" TEXT NOT NULL,
ADD COLUMN     "proteinSnapshot" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "MealTemplate" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "MealTemplateDay" (
    "id" UUID NOT NULL,
    "mealTemplateId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealTemplateDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealTemplateItem" (
    "id" UUID NOT NULL,
    "dayId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "portionId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mealTime" "MealTime" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanDay" (
    "id" UUID NOT NULL,
    "mealPlanId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealTemplateDay_mealTemplateId_idx" ON "MealTemplateDay"("mealTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "MealTemplateDay_mealTemplateId_dayIndex_key" ON "MealTemplateDay"("mealTemplateId", "dayIndex");

-- CreateIndex
CREATE INDEX "MealTemplateItem_dayId_idx" ON "MealTemplateItem"("dayId");

-- CreateIndex
CREATE INDEX "MealTemplateItem_foodId_idx" ON "MealTemplateItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "MealTemplateItem_dayId_mealTime_sortOrder_key" ON "MealTemplateItem"("dayId", "mealTime", "sortOrder");

-- CreateIndex
CREATE INDEX "MealPlanDay_mealPlanId_idx" ON "MealPlanDay"("mealPlanId");

-- CreateIndex
CREATE INDEX "MealPlanDay_date_idx" ON "MealPlanDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanDay_mealPlanId_dayIndex_key" ON "MealPlanDay"("mealPlanId", "dayIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanDay_mealPlanId_date_key" ON "MealPlanDay"("mealPlanId", "date");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Food_name_baseGrams_idx" ON "Food"("name", "baseGrams");

-- CreateIndex
CREATE INDEX "Food_isArchived_idx" ON "Food"("isArchived");

-- CreateIndex
CREATE INDEX "FoodPortion_foodId_idx" ON "FoodPortion"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_foodId_label_key" ON "FoodPortion"("foodId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_id_foodId_key" ON "FoodPortion"("id", "foodId");

-- CreateIndex
CREATE INDEX "MealPlan_sourceMealTemplateId_idx" ON "MealPlan"("sourceMealTemplateId");

-- CreateIndex
CREATE INDEX "MealPlan_clientId_status_startDate_idx" ON "MealPlan"("clientId", "status", "startDate");

-- CreateIndex
CREATE INDEX "MealPlan_trainerId_status_startDate_idx" ON "MealPlan"("trainerId", "status", "startDate");

-- CreateIndex
CREATE INDEX "MealPlan_startDate_endDate_idx" ON "MealPlan"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "MealPlanItem_mealPlanDayId_idx" ON "MealPlanItem"("mealPlanDayId");

-- CreateIndex
CREATE INDEX "MealPlanItem_foodId_idx" ON "MealPlanItem"("foodId");

-- CreateIndex
CREATE INDEX "MealPlanItem_mealTime_idx" ON "MealPlanItem"("mealTime");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanItem_mealPlanDayId_mealTime_sortOrder_key" ON "MealPlanItem"("mealPlanDayId", "mealTime", "sortOrder");

-- CreateIndex
CREATE INDEX "MealTemplate_trainerId_idx" ON "MealTemplate"("trainerId");

-- CreateIndex
CREATE INDEX "MealTemplate_trainerId_isArchived_idx" ON "MealTemplate"("trainerId", "isArchived");

-- CreateIndex
CREATE INDEX "ProgressMetric_userId_idx" ON "ProgressMetric"("userId");

-- AddForeignKey
ALTER TABLE "MealTemplateDay" ADD CONSTRAINT "MealTemplateDay_mealTemplateId_fkey" FOREIGN KEY ("mealTemplateId") REFERENCES "MealTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealTemplateItem" ADD CONSTRAINT "MealTemplateItem_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "MealTemplateDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealTemplateItem" ADD CONSTRAINT "MealTemplateItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealTemplateItem" ADD CONSTRAINT "MealTemplateItem_portionId_foodId_fkey" FOREIGN KEY ("portionId", "foodId") REFERENCES "FoodPortion"("id", "foodId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_sourceMealTemplateId_fkey" FOREIGN KEY ("sourceMealTemplateId") REFERENCES "MealTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_mealPlanDayId_fkey" FOREIGN KEY ("mealPlanDayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_portionId_foodId_fkey" FOREIGN KEY ("portionId", "foodId") REFERENCES "FoodPortion"("id", "foodId") ON DELETE RESTRICT ON UPDATE CASCADE;
