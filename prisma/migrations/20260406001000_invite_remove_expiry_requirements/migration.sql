-- Make invite client metadata optional and remove expiry.
ALTER TABLE "TrainerClientInvite"
  ALTER COLUMN "clientName" DROP NOT NULL,
  ALTER COLUMN "clientPhone" DROP NOT NULL;

DROP INDEX IF EXISTS "TrainerClientInvite_clientPhone_status_expiresAt_idx";
DROP INDEX IF EXISTS "TrainerClientInvite_expiresAt_idx";

ALTER TABLE "TrainerClientInvite"
  DROP COLUMN IF EXISTS "expiresAt";

CREATE INDEX IF NOT EXISTS "TrainerClientInvite_clientPhone_status_idx"
ON "TrainerClientInvite"("clientPhone", "status");
