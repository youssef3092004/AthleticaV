-- Add free-form note support to meal plan items.
ALTER TABLE "MealPlanItem"
ADD COLUMN "note" TEXT;
