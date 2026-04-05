-- Allow TrainerClientInvite to store client registration history rows.
-- Remove single-row-per-trainer and single-row-per-code constraints.

DROP INDEX IF EXISTS "TrainerClientInvite_trainerId_key";
DROP INDEX IF EXISTS "TrainerClientInvite_inviteCodeId_key";

CREATE INDEX IF NOT EXISTS "TrainerClientInvite_trainerId_idx"
ON "TrainerClientInvite"("trainerId");

CREATE INDEX IF NOT EXISTS "TrainerClientInvite_inviteCodeId_idx"
ON "TrainerClientInvite"("inviteCodeId");

CREATE INDEX IF NOT EXISTS "TrainerClientInvite_usedByClientId_idx"
ON "TrainerClientInvite"("usedByClientId");
