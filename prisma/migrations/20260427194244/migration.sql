/*
  Warnings:

  - You are about to drop the column `answers` on the `ClientIntake` table. All the data in the column will be lost.
  - You are about to drop the column `completedCount` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `percentage` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `totalCount` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `trainerId` on the `MealPlan` table. All the data in the column will be lost.
  - You are about to drop the column `completedCount` on the `MealPlanDay` table. All the data in the column will be lost.
  - You are about to drop the column `percentage` on the `MealPlanDay` table. All the data in the column will be lost.
  - You are about to drop the column `totalCount` on the `MealPlanDay` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Program` table. All the data in the column will be lost.
  - You are about to drop the column `trainerId` on the `Program` table. All the data in the column will be lost.
  - You are about to drop the column `clientId` on the `Workout` table. All the data in the column will be lost.
  - You are about to drop the column `trainerId` on the `Workout` table. All the data in the column will be lost.
  - You are about to drop the column `completedCount` on the `WorkoutDay` table. All the data in the column will be lost.
  - You are about to drop the column `totalCount` on the `WorkoutDay` table. All the data in the column will be lost.
  - You are about to drop the `DayPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DayProgress` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `quotation` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[trainerClientId]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `action` on the `ActivityLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `trainerClientId` to the `Conversation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ActivityLogActionType" AS ENUM ('USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'PROGRAM_CREATED', 'PROGRAM_COMPLETED', 'WORKOUT_COMPLETED', 'MEAL_COMPLETED', 'TRAINER_CLIENT_INVITED', 'TRAINER_CLIENT_ACCEPTED', 'TRAINER_CLIENT_ENDED', 'MESSAGE_SENT', 'TRANSACTION_CREATED', 'PAYOUT_REQUESTED');

-- DropForeignKey
ALTER TABLE "DayPlan" DROP CONSTRAINT "DayPlan_userId_fkey";

-- DropForeignKey
ALTER TABLE "DayProgress" DROP CONSTRAINT "DayProgress_userId_fkey";

-- DropForeignKey
ALTER TABLE "MealPlan" DROP CONSTRAINT "MealPlan_trainerId_fkey";

-- DropForeignKey
ALTER TABLE "Program" DROP CONSTRAINT "Program_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Program" DROP CONSTRAINT "Program_trainerId_fkey";

-- DropForeignKey
ALTER TABLE "Workout" DROP CONSTRAINT "Workout_clientId_fkey";

-- DropForeignKey
ALTER TABLE "Workout" DROP CONSTRAINT "Workout_trainerId_fkey";

-- DropIndex
DROP INDEX "Conversation_trainerId_clientId_key";

-- DropIndex
DROP INDEX "MealPlan_trainerId_status_idx";

-- DropIndex
DROP INDEX "Message_conversationId_isRead_idx";

-- DropIndex
DROP INDEX "Program_trainerId_clientId_idx";

-- DropIndex
DROP INDEX "Program_trainerId_startDate_idx";

-- DropIndex
DROP INDEX "Workout_clientId_idx";

-- DropIndex
DROP INDEX "Workout_trainerId_idx";

-- AlterTable
ALTER TABLE "ActivityLog" DROP COLUMN "action",
ADD COLUMN     "action" "ActivityLogActionType" NOT NULL;

-- AlterTable
ALTER TABLE "ClientIntake" DROP COLUMN "answers";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "trainerClientId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "MealPlan" DROP COLUMN "completedCount",
DROP COLUMN "percentage",
DROP COLUMN "totalCount",
DROP COLUMN "trainerId";

-- AlterTable
ALTER TABLE "MealPlanDay" DROP COLUMN "completedCount",
DROP COLUMN "percentage",
DROP COLUMN "totalCount";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isRead";

-- AlterTable
ALTER TABLE "Program" DROP COLUMN "clientId",
DROP COLUMN "trainerId";

-- AlterTable
ALTER TABLE "TrainerWallet" ADD COLUMN     "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Workout" DROP COLUMN "clientId",
DROP COLUMN "trainerId";

-- AlterTable
ALTER TABLE "WorkoutDay" DROP COLUMN "completedCount",
DROP COLUMN "totalCount";

-- DropTable
DROP TABLE "DayPlan";

-- DropTable
DROP TABLE "DayProgress";

-- DropTable
DROP TABLE "quotation";

-- CreateTable
CREATE TABLE "UserPermission" (
    "userId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "grant" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("userId","permissionId")
);

-- CreateTable
CREATE TABLE "IntakeAnswer" (
    "id" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "question" "IntakeQuestionKey" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRead" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "readerId" UUID NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "quote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE INDEX "IntakeAnswer_intakeId_idx" ON "IntakeAnswer"("intakeId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeAnswer_intakeId_question_key" ON "IntakeAnswer"("intakeId", "question");

-- CreateIndex
CREATE INDEX "MessageRead_readerId_readAt_idx" ON "MessageRead"("readerId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRead_messageId_readerId_key" ON "MessageRead"("messageId", "readerId");

-- CreateIndex
CREATE INDEX "Quotation_trainerId_idx" ON "Quotation"("trainerId");

-- CreateIndex
CREATE INDEX "Quotation_clientId_idx" ON "Quotation"("clientId");

-- CreateIndex
CREATE INDEX "Quotation_trainerId_clientId_createdAt_idx" ON "Quotation"("trainerId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "BlacklistedToken_expiredAt_idx" ON "BlacklistedToken"("expiredAt");

-- CreateIndex
CREATE INDEX "Conversation_trainerClientId_idx" ON "Conversation"("trainerClientId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_trainerClientId_key" ON "Conversation"("trainerClientId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "ProgressMetric_userId_recordedAt_idx" ON "ProgressMetric"("userId", "recordedAt");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeAnswer" ADD CONSTRAINT "IntakeAnswer_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ClientIntake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_trainerClientId_fkey" FOREIGN KEY ("trainerClientId") REFERENCES "TrainerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRead" ADD CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
