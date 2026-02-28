/*
  Warnings:

  - You are about to drop the column `expiresAt` on the `BlacklistedToken` table. All the data in the column will be lost.
  - Added the required column `expiredAt` to the `BlacklistedToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BlacklistedToken" DROP COLUMN "expiresAt",
ADD COLUMN     "expiredAt" TIMESTAMP(3) NOT NULL;
