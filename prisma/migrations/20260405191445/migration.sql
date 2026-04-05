-- CreateEnum
CREATE TYPE "IntakeQuestionKey" AS ENUM ('DIET_OR_NUTRITION_PLAN', 'MEDICAL_CONDITIONS', 'ACTIVITY_LEVEL', 'FITNESS_PREFERENCES', 'TYPICAL_EATING_DAY', 'TRAINING_TIME_COMMITMENT', 'MOTIVATION', 'MILESTONES_OR_DEADLINES', 'CURRENT_WEIGHT', 'CURRENT_HEIGHT', 'PRIMARY_FITNESS_GOALS', 'PREVIOUS_PROGRAM_EXPERIENCE');

-- CreateTable
CREATE TABLE "ClientIntakeAnswer" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "questionKey" "IntakeQuestionKey" NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntakeAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientIntakeAnswer_trainerId_clientId_idx" ON "ClientIntakeAnswer"("trainerId", "clientId");

-- CreateIndex
CREATE INDEX "ClientIntakeAnswer_clientId_updatedAt_idx" ON "ClientIntakeAnswer"("clientId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIntakeAnswer_trainerId_clientId_questionKey_key" ON "ClientIntakeAnswer"("trainerId", "clientId", "questionKey");

-- AddForeignKey
ALTER TABLE "ClientIntakeAnswer" ADD CONSTRAINT "ClientIntakeAnswer_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntakeAnswer" ADD CONSTRAINT "ClientIntakeAnswer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
