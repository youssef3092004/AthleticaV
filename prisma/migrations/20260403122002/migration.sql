/*
  Warnings:

  - Made the column `planId` on table `Subscription` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_planId_fkey";

-- DropIndex
DROP INDEX "Subscription_userId_key";

-- AlterTable
ALTER TABLE "ClientProfile" ALTER COLUMN "heightCm" SET DATA TYPE DECIMAL(6,2),
ALTER COLUMN "weightKg" SET DATA TYPE DECIMAL(6,2);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "currentPeriodStart" TIMESTAMP(3),
ALTER COLUMN "planId" SET NOT NULL,
ALTER COLUMN "trialStart" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "trialEnd" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "startDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "endDate" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ClientProfile_userId_idx" ON "ClientProfile"("userId");

-- CreateIndex
CREATE INDEX "ClientProfile_age_idx" ON "ClientProfile"("age");

-- CreateIndex
CREATE INDEX "ClientProfile_createdAt_idx" ON "ClientProfile"("createdAt");

-- CreateIndex
CREATE INDEX "ClientProfile_userId_createdAt_idx" ON "ClientProfile"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientProfile_userId_age_idx" ON "ClientProfile"("userId", "age");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
