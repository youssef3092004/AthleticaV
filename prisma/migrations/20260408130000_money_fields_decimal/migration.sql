-- AlterTable
ALTER TABLE "Transaction"
  ALTER COLUMN "grossAmount" TYPE DECIMAL(12,2) USING ROUND("grossAmount"::numeric, 2),
  ALTER COLUMN "platformFee" TYPE DECIMAL(12,2) USING ROUND("platformFee"::numeric, 2),
  ALTER COLUMN "trainerAmount" TYPE DECIMAL(12,2) USING ROUND("trainerAmount"::numeric, 2);

-- AlterTable
ALTER TABLE "TrainerWallet"
  ALTER COLUMN "balance" TYPE DECIMAL(12,2) USING ROUND("balance"::numeric, 2),
  ALTER COLUMN "balance" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Payout"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);
