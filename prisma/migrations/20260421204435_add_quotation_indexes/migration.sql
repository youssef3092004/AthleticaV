/*
  Warnings:

  - You are about to drop the `qotation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "qotation";

-- CreateTable
CREATE TABLE "quotation" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "qote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_trainerId_idx" ON "quotation"("trainerId");

-- CreateIndex
CREATE INDEX "quotation_clientId_idx" ON "quotation"("clientId");

-- CreateIndex
CREATE INDEX "quotation_trainerId_clientId_createdAt_idx" ON "quotation"("trainerId", "clientId", "createdAt");
