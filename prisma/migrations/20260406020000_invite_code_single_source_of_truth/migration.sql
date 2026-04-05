-- Make TrainerInviteCode the single source of truth for invite code values.
-- Remove duplicated code storage from TrainerClientInvite and enforce one-to-one mapping.

DROP INDEX IF EXISTS "TrainerClientInvite_inviteCodeId_idx";
CREATE UNIQUE INDEX "TrainerClientInvite_inviteCodeId_key"
ON "TrainerClientInvite"("inviteCodeId");

DROP INDEX IF EXISTS "TrainerClientInvite_code_key";
ALTER TABLE "TrainerClientInvite" DROP COLUMN "code";
