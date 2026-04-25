-- Create the new JSON-backed intake table.
CREATE TABLE "ClientIntake" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "answers" JSONB NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientIntake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientIntake_clientId_key" ON "ClientIntake"("clientId");
CREATE INDEX "ClientIntake_clientId_updatedAt_idx" ON "ClientIntake"("clientId", "updatedAt");

ALTER TABLE "ClientIntake"
ADD CONSTRAINT "ClientIntake_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one intake row per client from the legacy question-answer table.
INSERT INTO "ClientIntake" ("id", "clientId", "answers", "completedAt", "createdAt", "updatedAt")
SELECT
  MIN("id") AS "id",
  "clientId",
  jsonb_object_agg("questionKey", "answer" ORDER BY "questionKey") AS "answers",
  CASE
    WHEN COUNT(*) = 30 THEN MAX("updatedAt")
    ELSE NULL
  END AS "completedAt",
  MIN("createdAt") AS "createdAt",
  MAX("updatedAt") AS "updatedAt"
FROM "ClientIntakeAnswer"
GROUP BY "clientId";

DROP TABLE "ClientIntakeAnswer";