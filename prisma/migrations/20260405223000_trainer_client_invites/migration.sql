-- CreateEnum
CREATE TYPE "TrainerClientInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TrainerClientInvite" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "usedByClientId" UUID,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "clientEmail" TEXT,
    "code" TEXT NOT NULL,
    "status" "TrainerClientInviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerClientInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainerClientInvite_code_key" ON "TrainerClientInvite"("code");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_trainerId_status_createdAt_idx" ON "TrainerClientInvite"("trainerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_trainerId_clientPhone_status_idx" ON "TrainerClientInvite"("trainerId", "clientPhone", "status");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_clientPhone_status_expiresAt_idx" ON "TrainerClientInvite"("clientPhone", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_expiresAt_idx" ON "TrainerClientInvite"("expiresAt");

-- AddForeignKey
ALTER TABLE "TrainerClientInvite" ADD CONSTRAINT "TrainerClientInvite_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerClientInvite" ADD CONSTRAINT "TrainerClientInvite_usedByClientId_fkey" FOREIGN KEY ("usedByClientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
