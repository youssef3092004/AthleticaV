-- Keep only one invite code per trainer (oldest), and make it reusable.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "trainerId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "TrainerClientInvite"
)
DELETE FROM "TrainerClientInvite"
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

UPDATE "TrainerClientInvite"
SET
  "status" = 'PENDING',
  "usedAt" = NULL,
  "usedByClientId" = NULL;

CREATE UNIQUE INDEX "TrainerClientInvite_trainerId_key"
ON "TrainerClientInvite"("trainerId");
