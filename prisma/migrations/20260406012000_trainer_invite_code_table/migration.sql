-- Create dedicated invite code table and relate invites to it.

-- CreateTable
CREATE TABLE "TrainerInviteCode" (
    "id" UUID NOT NULL,
    "trainerId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "totalClients" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrainerInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainerInviteCode_trainerId_key" ON "TrainerInviteCode"("trainerId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerInviteCode_code_key" ON "TrainerInviteCode"("code");

-- AddForeignKey
ALTER TABLE "TrainerInviteCode" ADD CONSTRAINT "TrainerInviteCode_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add inviteCode relation field on existing invites.
ALTER TABLE "TrainerClientInvite" ADD COLUMN "inviteCodeId" UUID;

-- Backfill dedicated codes from existing invites and hydrate totalClients.
WITH trainer_client_counts AS (
  SELECT
    "trainerId",
    COUNT(*)::INTEGER AS "totalClients"
  FROM "TrainerClient"
  GROUP BY "trainerId"
)
INSERT INTO "TrainerInviteCode" (
  "id",
  "trainerId",
  "code",
  "totalClients"
)
SELECT
  tci."id",
  tci."trainerId",
  tci."code",
  COALESCE(tcc."totalClients", 0)
FROM "TrainerClientInvite" tci
LEFT JOIN trainer_client_counts tcc
  ON tcc."trainerId" = tci."trainerId"
ON CONFLICT ("trainerId") DO NOTHING;

UPDATE "TrainerClientInvite" tci
SET "inviteCodeId" = tic."id"
FROM "TrainerInviteCode" tic
WHERE tic."trainerId" = tci."trainerId";

ALTER TABLE "TrainerClientInvite"
  ALTER COLUMN "inviteCodeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "TrainerClientInvite_inviteCodeId_idx" ON "TrainerClientInvite"("inviteCodeId");

-- AddForeignKey
ALTER TABLE "TrainerClientInvite" ADD CONSTRAINT "TrainerClientInvite_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "TrainerInviteCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
