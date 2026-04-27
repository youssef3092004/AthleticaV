-- CreateEnum
CREATE TYPE "TrainerClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "TrainerClientInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkoutLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "MealTime" AS ENUM ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'EVENING_SNACK');

-- CreateEnum
CREATE TYPE "MealPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProgressMetricType" AS ENUM ('WEIGHT', 'BODY_FAT', 'MUSCLE');

-- CreateEnum
CREATE TYPE "IntakeQuestionKey" AS ENUM ('AGE', 'GENDER', 'HEIGHT_CM', 'WEIGHT_KG', 'PRIMARY_FITNESS_GOAL', 'GOAL_IMPORTANCE', 'TARGET_TIMELINE', 'FITNESS_LEVEL', 'PREVIOUS_PROGRAM_EXPERIENCE', 'PREVIOUS_TRAINER_EXPERIENCE', 'MEDICAL_CONDITIONS', 'CURRENT_MEDICATIONS', 'ST_INJURIES', 'DOCTOR_EXERCISE_RESTRICTION', 'EXPECTED_CHALLENGES', 'SLEEP_HOURS', 'STRESS_LEVEL', 'CURRENTLY_EXERCISING', 'TRAINING_DAYS_PER_WEEK', 'CURRENT_EXERCISE_TYPE', 'SESSION_DURATION_MINUTES', 'DAILY_DIET_DESCRIPTION', 'MEALS_PER_DAY', 'WATER_INTAKE_LITERS', 'FOOD_ALLERGIES_RESTRICTIONS', 'SPECIFIC_DIET', 'REALISTIC_TRAINING_DAYS', 'PREFERRED_WORKOUT_LOCATION', 'PREFERRED_WORKOUT_DURATION', 'PREFERRED_TRAINING_TYPE', 'DIET_OR_NUTRITION_PLAN', 'ACTIVITY_LEVEL', 'FITNESS_PREFERENCES', 'TYPICAL_EATING_DAY', 'TRAINING_TIME_COMMITMENT', 'MOTIVATION', 'MILESTONES_OR_DEADLINES', 'CURRENT_WEIGHT', 'CURRENT_HEIGHT', 'PRIMARY_FITNESS_GOALS');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'FILE');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "TransactionPaymentMode" AS ENUM ('PLATFORM', 'DIRECT');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('CLIENT_TO_TRAINER', 'TRAINER_TO_PLATFORM_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "CheckInPeriod" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileImage" TEXT NOT NULL DEFAULT 'https://cdn.pixabay.com/photo/2020/07/01/12/58/icon-5359553_640.png',
    "email" TEXT,
    "password" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "bio" TEXT,
    "certifications" TEXT,
    "yearsExperience" INTEGER,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientProfile" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "age" INTEGER,
    "heightCm" DECIMAL(65,30),
    "weightKg" DECIMAL(65,30),
    "fitnessGoal" TEXT,
    "medicalConditions" TEXT,
    "targetCalories" DOUBLE PRECISION,
    "targetProtein" DOUBLE PRECISION,
    "targetCarbs" DOUBLE PRECISION,
    "targetFat" DOUBLE PRECISION,
    "dietaryNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "TrainerClient" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "status" "TrainerClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "monthlyPrice" DECIMAL(10,2),
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainerClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "trainerClientId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerClientInvite" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "inviteCodeId" UUID NOT NULL,
    "usedByClientId" UUID,
    "clientName" TEXT,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "status" "TrainerClientInviteStatus" NOT NULL DEFAULT 'PENDING',
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerClientInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerInviteCode" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "totalClients" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainerInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "trainerId" UUID,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "primary_muscle" TEXT NOT NULL,
    "secondary_muscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "equipment" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "exercise_type" TEXT NOT NULL,
    "classification" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "movement_pattern" TEXT NOT NULL,
    "fitness_goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workout_location" TEXT NOT NULL,
    "media_type" TEXT NOT NULL,
    "media_url" TEXT NOT NULL,
    "video_url" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "level" "WorkoutLevel" NOT NULL DEFAULT 'BEGINNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateDay" (
    "id" UUID NOT NULL,
    "workoutTemplateId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutTemplateDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateItem" (
    "id" UUID NOT NULL,
    "workoutTemplateDayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "tempo" TEXT,
    "rir" INTEGER,
    "rpe" DOUBLE PRECISION,

    CONSTRAINT "WorkoutTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" UUID NOT NULL,
    "workoutTemplateId" UUID,
    "programId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutDay" (
    "id" UUID NOT NULL,
    "workoutId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutItem" (
    "id" UUID NOT NULL,
    "workoutDayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "restSeconds" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "tempo" TEXT,
    "rir" INTEGER,
    "rpe" DOUBLE PRECISION,

    CONSTRAINT "WorkoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutCompletion" (
    "id" UUID NOT NULL,
    "workoutItemId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedSets" INTEGER,
    "loggedReps" INTEGER,
    "loggedWeightKg" DOUBLE PRECISION,
    "performedSets" JSONB,
    "note" TEXT,

    CONSTRAINT "WorkoutCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseGrams" DOUBLE PRECISION NOT NULL,
    "calories" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodPortion" (
    "id" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "FoodPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealTemplate" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealTemplateDay" (
    "id" UUID NOT NULL,
    "mealTemplateId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT,
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
CREATE TABLE "MealPlan" (
    "id" UUID NOT NULL,
    "sourceMealTemplateId" UUID,
    "programId" UUID NOT NULL,
    "clientProfileId" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "status" "MealPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "title" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanDay" (
    "id" UUID NOT NULL,
    "mealPlanId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCalories" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProtein" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCarbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFats" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealPlanItem" (
    "id" UUID NOT NULL,
    "mealPlanDayId" UUID NOT NULL,
    "foodId" UUID NOT NULL,
    "portionId" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "mealTime" "MealTime" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "foodNameSnapshot" TEXT NOT NULL,
    "portionLabelSnapshot" TEXT NOT NULL,
    "gramsPerPortion" DOUBLE PRECISION NOT NULL,
    "caloriesSnapshot" DOUBLE PRECISION NOT NULL,
    "proteinSnapshot" DOUBLE PRECISION NOT NULL,
    "carbsSnapshot" DOUBLE PRECISION NOT NULL,
    "fatSnapshot" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealPlanItem_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "ProgressMetric" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "metric" "ProgressMetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" DATE NOT NULL,

    CONSTRAINT "ProgressMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "UserStreak" (
    "userId" UUID NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedDate" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStreak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ClientIntake" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "answers" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "kind" "TransactionKind" NOT NULL DEFAULT 'CLIENT_TO_TRAINER',
    "clientId" UUID,
    "trainerId" UUID NOT NULL,
    "programId" UUID,
    "planId" UUID,
    "subscriptionId" UUID,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "platformFee" DECIMAL(12,2) NOT NULL,
    "trainerAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentMode" "TransactionPaymentMode" NOT NULL DEFAULT 'PLATFORM',
    "directMethod" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "paymentToken" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerWallet" (
    "trainerId" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "TrainerWallet_pkey" PRIMARY KEY ("trainerId")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlacklistedToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlacklistedToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "qote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkIn" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "period" "CheckInPeriod" NOT NULL DEFAULT 'WEEKLY',
    "questions" JSONB NOT NULL,
    "answers" JSONB,
    "nextDueAt" TIMESTAMP(3),
    "lastAnsweredAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_billingCycle_key" ON "Plan"("name", "billingCycle");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_status_trialEnd_idx" ON "Subscription"("status", "trialEnd");

-- CreateIndex
CREATE INDEX "Subscription_status_endDate_idx" ON "Subscription"("status", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_trainerId_key" ON "TrainerProfile"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientProfile_clientId_key" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "ClientProfile_clientId_idx" ON "ClientProfile"("clientId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_trainerId_idx" ON "Appointment"("trainerId");

-- CreateIndex
CREATE INDEX "Appointment_clientId_idx" ON "Appointment"("clientId");

-- CreateIndex
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_trainerId_scheduledAt_idx" ON "Appointment"("trainerId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_clientId_scheduledAt_idx" ON "Appointment"("clientId", "scheduledAt");

-- CreateIndex
CREATE INDEX "TrainerClient_trainerId_idx" ON "TrainerClient"("trainerId");

-- CreateIndex
CREATE INDEX "TrainerClient_clientId_idx" ON "TrainerClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerClient_trainerId_clientId_key" ON "TrainerClient"("trainerId", "clientId");

-- CreateIndex
CREATE INDEX "Program_trainerId_clientId_idx" ON "Program"("trainerId", "clientId");

-- CreateIndex
CREATE INDEX "Program_trainerClientId_idx" ON "Program"("trainerClientId");

-- CreateIndex
CREATE INDEX "Program_startDate_endDate_idx" ON "Program"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Program_trainerId_startDate_idx" ON "Program"("trainerId", "startDate");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_trainerId_status_createdAt_idx" ON "TrainerClientInvite"("trainerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_trainerId_clientPhone_status_idx" ON "TrainerClientInvite"("trainerId", "clientPhone", "status");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_clientPhone_status_idx" ON "TrainerClientInvite"("clientPhone", "status");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_usedByClientId_idx" ON "TrainerClientInvite"("usedByClientId");

-- CreateIndex
CREATE INDEX "TrainerClientInvite_inviteCodeId_idx" ON "TrainerClientInvite"("inviteCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerInviteCode_trainerId_key" ON "TrainerInviteCode"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerInviteCode_code_key" ON "TrainerInviteCode"("code");

-- CreateIndex
CREATE INDEX "Exercise_name_en_idx" ON "Exercise"("name_en");

-- CreateIndex
CREATE INDEX "Exercise_primary_muscle_idx" ON "Exercise"("primary_muscle");

-- CreateIndex
CREATE INDEX "Exercise_equipment_idx" ON "Exercise"("equipment");

-- CreateIndex
CREATE INDEX "Exercise_difficulty_idx" ON "Exercise"("difficulty");

-- CreateIndex
CREATE INDEX "Exercise_exercise_type_idx" ON "Exercise"("exercise_type");

-- CreateIndex
CREATE INDEX "Exercise_workout_location_idx" ON "Exercise"("workout_location");

-- CreateIndex
CREATE INDEX "Exercise_is_default_idx" ON "Exercise"("is_default");

-- CreateIndex
CREATE INDEX "Exercise_priority_idx" ON "Exercise"("priority");

-- CreateIndex
CREATE INDEX "Exercise_trainerId_idx" ON "Exercise"("trainerId");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_trainerId_idx" ON "WorkoutTemplate"("trainerId");

-- CreateIndex
CREATE INDEX "WorkoutTemplateDay_workoutTemplateId_idx" ON "WorkoutTemplateDay"("workoutTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplateDay_workoutTemplateId_dayIndex_key" ON "WorkoutTemplateDay"("workoutTemplateId", "dayIndex");

-- CreateIndex
CREATE INDEX "WorkoutTemplateItem_workoutTemplateDayId_idx" ON "WorkoutTemplateItem"("workoutTemplateDayId");

-- CreateIndex
CREATE INDEX "WorkoutTemplateItem_exerciseId_idx" ON "WorkoutTemplateItem"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplateItem_workoutTemplateDayId_order_key" ON "WorkoutTemplateItem"("workoutTemplateDayId", "order");

-- CreateIndex
CREATE INDEX "Workout_workoutTemplateId_idx" ON "Workout"("workoutTemplateId");

-- CreateIndex
CREATE INDEX "Workout_programId_idx" ON "Workout"("programId");

-- CreateIndex
CREATE INDEX "Workout_clientId_idx" ON "Workout"("clientId");

-- CreateIndex
CREATE INDEX "Workout_trainerId_idx" ON "Workout"("trainerId");

-- CreateIndex
CREATE INDEX "WorkoutDay_workoutId_idx" ON "WorkoutDay"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutDay_date_idx" ON "WorkoutDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_workoutId_dayIndex_key" ON "WorkoutDay"("workoutId", "dayIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutDay_workoutId_date_key" ON "WorkoutDay"("workoutId", "date");

-- CreateIndex
CREATE INDEX "WorkoutItem_workoutDayId_idx" ON "WorkoutItem"("workoutDayId");

-- CreateIndex
CREATE INDEX "WorkoutItem_exerciseId_idx" ON "WorkoutItem"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutItem_workoutDayId_order_key" ON "WorkoutItem"("workoutDayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutCompletion_workoutItemId_key" ON "WorkoutCompletion"("workoutItemId");

-- CreateIndex
CREATE INDEX "WorkoutCompletion_clientId_completedAt_idx" ON "WorkoutCompletion"("clientId", "completedAt");

-- CreateIndex
CREATE INDEX "WorkoutCompletion_workoutItemId_idx" ON "WorkoutCompletion"("workoutItemId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodCategory_name_key" ON "FoodCategory"("name");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Food_categoryId_isArchived_idx" ON "Food"("categoryId", "isArchived");

-- CreateIndex
CREATE INDEX "Food_isArchived_idx" ON "Food"("isArchived");

-- CreateIndex
CREATE INDEX "FoodPortion_foodId_idx" ON "FoodPortion"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_foodId_label_key" ON "FoodPortion"("foodId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_id_foodId_key" ON "FoodPortion"("id", "foodId");

-- CreateIndex
CREATE INDEX "MealTemplate_trainerId_idx" ON "MealTemplate"("trainerId");

-- CreateIndex
CREATE INDEX "MealTemplate_isPublic_isArchived_idx" ON "MealTemplate"("isPublic", "isArchived");

-- CreateIndex
CREATE INDEX "MealTemplate_trainerId_isArchived_idx" ON "MealTemplate"("trainerId", "isArchived");

-- CreateIndex
CREATE INDEX "MealTemplateDay_mealTemplateId_idx" ON "MealTemplateDay"("mealTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "MealTemplateDay_mealTemplateId_dayIndex_key" ON "MealTemplateDay"("mealTemplateId", "dayIndex");

-- CreateIndex
CREATE INDEX "MealTemplateItem_dayId_mealTime_idx" ON "MealTemplateItem"("dayId", "mealTime");

-- CreateIndex
CREATE INDEX "MealTemplateItem_foodId_idx" ON "MealTemplateItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "MealTemplateItem_dayId_mealTime_sortOrder_key" ON "MealTemplateItem"("dayId", "mealTime", "sortOrder");

-- CreateIndex
CREATE INDEX "MealPlan_programId_idx" ON "MealPlan"("programId");

-- CreateIndex
CREATE INDEX "MealPlan_sourceMealTemplateId_idx" ON "MealPlan"("sourceMealTemplateId");

-- CreateIndex
CREATE INDEX "MealPlan_clientProfileId_status_idx" ON "MealPlan"("clientProfileId", "status");

-- CreateIndex
CREATE INDEX "MealPlan_trainerId_status_idx" ON "MealPlan"("trainerId", "status");

-- CreateIndex
CREATE INDEX "MealPlanDay_mealPlanId_idx" ON "MealPlanDay"("mealPlanId");

-- CreateIndex
CREATE INDEX "MealPlanDay_date_idx" ON "MealPlanDay"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanDay_mealPlanId_dayIndex_key" ON "MealPlanDay"("mealPlanId", "dayIndex");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanDay_mealPlanId_date_key" ON "MealPlanDay"("mealPlanId", "date");

-- CreateIndex
CREATE INDEX "MealPlanItem_mealPlanDayId_mealTime_idx" ON "MealPlanItem"("mealPlanDayId", "mealTime");

-- CreateIndex
CREATE INDEX "MealPlanItem_foodId_idx" ON "MealPlanItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlanItem_mealPlanDayId_mealTime_sortOrder_key" ON "MealPlanItem"("mealPlanDayId", "mealTime", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MealCompletion_mealPlanItemId_key" ON "MealCompletion"("mealPlanItemId");

-- CreateIndex
CREATE INDEX "MealCompletion_clientId_completedAt_idx" ON "MealCompletion"("clientId", "completedAt");

-- CreateIndex
CREATE INDEX "MealCompletion_mealPlanItemId_idx" ON "MealCompletion"("mealPlanItemId");

-- CreateIndex
CREATE INDEX "ProgressMetric_userId_idx" ON "ProgressMetric"("userId");

-- CreateIndex
CREATE INDEX "DayPlan_userId_date_idx" ON "DayPlan"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlan_userId_date_key" ON "DayPlan"("userId", "date");

-- CreateIndex
CREATE INDEX "DayProgress_userId_date_idx" ON "DayProgress"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayProgress_userId_date_key" ON "DayProgress"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ClientIntake_clientId_key" ON "ClientIntake"("clientId");

-- CreateIndex
CREATE INDEX "ClientIntake_clientId_updatedAt_idx" ON "ClientIntake"("clientId", "updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_trainerId_idx" ON "Conversation"("trainerId");

-- CreateIndex
CREATE INDEX "Conversation_clientId_idx" ON "Conversation"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_trainerId_clientId_key" ON "Conversation"("trainerId", "clientId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_conversationId_isRead_idx" ON "Message"("conversationId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_programId_key" ON "Transaction"("programId");

-- CreateIndex
CREATE INDEX "Transaction_kind_idx" ON "Transaction"("kind");

-- CreateIndex
CREATE INDEX "Transaction_programId_idx" ON "Transaction"("programId");

-- CreateIndex
CREATE INDEX "Transaction_planId_idx" ON "Transaction"("planId");

-- CreateIndex
CREATE INDEX "Transaction_subscriptionId_idx" ON "Transaction"("subscriptionId");

-- CreateIndex
CREATE INDEX "Transaction_clientId_idx" ON "Transaction"("clientId");

-- CreateIndex
CREATE INDEX "Transaction_trainerId_idx" ON "Transaction"("trainerId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_trainerId_status_createdAt_idx" ON "Transaction"("trainerId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionId_key" ON "Payment"("transactionId");

-- CreateIndex
CREATE INDEX "Payout_trainerId_idx" ON "Payout"("trainerId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BlacklistedToken_token_key" ON "BlacklistedToken"("token");

-- CreateIndex
CREATE INDEX "quotation_trainerId_idx" ON "quotation"("trainerId");

-- CreateIndex
CREATE INDEX "quotation_clientId_idx" ON "quotation"("clientId");

-- CreateIndex
CREATE INDEX "quotation_trainerId_clientId_createdAt_idx" ON "quotation"("trainerId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "checkIn_trainerId_isActive_nextDueAt_idx" ON "checkIn"("trainerId", "isActive", "nextDueAt");

-- CreateIndex
CREATE INDEX "checkIn_clientId_isActive_nextDueAt_idx" ON "checkIn"("clientId", "isActive", "nextDueAt");

-- CreateIndex
CREATE INDEX "checkIn_trainerId_clientId_createdAt_idx" ON "checkIn"("trainerId", "clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerClient" ADD CONSTRAINT "TrainerClient_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerClient" ADD CONSTRAINT "TrainerClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_trainerClientId_fkey" FOREIGN KEY ("trainerClientId") REFERENCES "TrainerClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerClientInvite" ADD CONSTRAINT "TrainerClientInvite_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerClientInvite" ADD CONSTRAINT "TrainerClientInvite_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "TrainerInviteCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerClientInvite" ADD CONSTRAINT "TrainerClientInvite_usedByClientId_fkey" FOREIGN KEY ("usedByClientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerInviteCode" ADD CONSTRAINT "TrainerInviteCode_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateDay" ADD CONSTRAINT "WorkoutTemplateDay_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateItem" ADD CONSTRAINT "WorkoutTemplateItem_workoutTemplateDayId_fkey" FOREIGN KEY ("workoutTemplateDayId") REFERENCES "WorkoutTemplateDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateItem" ADD CONSTRAINT "WorkoutTemplateItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_workoutTemplateId_fkey" FOREIGN KEY ("workoutTemplateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutDay" ADD CONSTRAINT "WorkoutDay_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutItem" ADD CONSTRAINT "WorkoutItem_workoutDayId_fkey" FOREIGN KEY ("workoutDayId") REFERENCES "WorkoutDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutItem" ADD CONSTRAINT "WorkoutItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_workoutItemId_fkey" FOREIGN KEY ("workoutItemId") REFERENCES "WorkoutItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutCompletion" ADD CONSTRAINT "WorkoutCompletion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPortion" ADD CONSTRAINT "FoodPortion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealTemplate" ADD CONSTRAINT "MealTemplate_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_mealPlanDayId_fkey" FOREIGN KEY ("mealPlanDayId") REFERENCES "MealPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealPlanItem" ADD CONSTRAINT "MealPlanItem_portionId_foodId_fkey" FOREIGN KEY ("portionId", "foodId") REFERENCES "FoodPortion"("id", "foodId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCompletion" ADD CONSTRAINT "MealCompletion_mealPlanItemId_fkey" FOREIGN KEY ("mealPlanItemId") REFERENCES "MealPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealCompletion" ADD CONSTRAINT "MealCompletion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressMetric" ADD CONSTRAINT "ProgressMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayProgress" ADD CONSTRAINT "DayProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStreak" ADD CONSTRAINT "UserStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientIntake" ADD CONSTRAINT "ClientIntake_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerWallet" ADD CONSTRAINT "TrainerWallet_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkIn" ADD CONSTRAINT "checkIn_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkIn" ADD CONSTRAINT "checkIn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
