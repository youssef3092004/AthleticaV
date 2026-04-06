-- DropIndex
DROP INDEX "Message_conversationId_idx";

-- DropIndex
DROP INDEX "Message_isRead_idx";

-- DropIndex
DROP INDEX "TrainerClientInvite_trainerId_idx";

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_isRead_idx" ON "Message"("conversationId", "isRead");
