-- Create enums for billing/subscriptions/appointments.
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED');
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- Extend existing MessageType enum for file attachments.
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'FILE';

-- Core monetization tables.
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceEgp" DECIMAL(10,2) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialStart" DATE,
    "trialEnd" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Client personalization profile.
CREATE TABLE "ClientProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "age" INTEGER,
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "fitnessGoal" TEXT,
    "medicalConditions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- In-app notifications.
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Scheduling/appointments.
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- Existing table extensions from pilot brief.
ALTER TABLE "TrainerClient"
    ADD COLUMN "monthlyPrice" DECIMAL(10,2),
    ADD COLUMN "notes" TEXT;

ALTER TABLE "MealPlanItem"
    ADD COLUMN "mealType" TEXT;

ALTER TABLE "Message"
    ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;

-- Unique constraints.
CREATE UNIQUE INDEX "Plan_name_billingCycle_key" ON "Plan"("name", "billingCycle");
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");
CREATE UNIQUE INDEX "ClientProfile_userId_key" ON "ClientProfile"("userId");

-- New indexes for pilot performance.
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");
CREATE INDEX "Subscription_status_trialEnd_idx" ON "Subscription"("status", "trialEnd");
CREATE INDEX "Subscription_status_endDate_idx" ON "Subscription"("status", "endDate");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
CREATE INDEX "Appointment_trainerId_idx" ON "Appointment"("trainerId");
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");
CREATE INDEX "Appointment_trainerId_scheduledAt_idx" ON "Appointment"("trainerId", "scheduledAt");
CREATE INDEX "Appointment_clientId_scheduledAt_idx" ON "Appointment"("clientId", "scheduledAt");
CREATE INDEX "TrainerClient_trainerId_idx" ON "TrainerClient"("trainerId");
CREATE INDEX "TrainerClient_clientId_idx" ON "TrainerClient"("clientId");
CREATE INDEX "Exercise_trainerId_idx" ON "Exercise"("trainerId");
CREATE INDEX "WorkoutTemplate_trainerId_idx" ON "WorkoutTemplate"("trainerId");
CREATE INDEX "Workout_workoutTemplateId_idx" ON "Workout"("workoutTemplateId");
CREATE INDEX "Workout_clientId_idx" ON "Workout"("clientId");
CREATE INDEX "Workout_trainerId_idx" ON "Workout"("trainerId");
CREATE INDEX "WorkoutItem_exerciseId_idx" ON "WorkoutItem"("exerciseId");
CREATE INDEX "MealPlanItem_mealType_idx" ON "MealPlanItem"("mealType");
CREATE INDEX "Conversation_trainerId_idx" ON "Conversation"("trainerId");
CREATE INDEX "Conversation_clientId_idx" ON "Conversation"("clientId");
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_isRead_idx" ON "Message"("isRead");
CREATE INDEX "Transaction_clientId_idx" ON "Transaction"("clientId");
CREATE INDEX "Transaction_trainerId_idx" ON "Transaction"("trainerId");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX "Payout_trainerId_idx" ON "Payout"("trainerId");
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- Foreign keys.
ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
    ADD CONSTRAINT "Subscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientProfile"
    ADD CONSTRAINT "ClientProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_trainerId_fkey"
    FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
