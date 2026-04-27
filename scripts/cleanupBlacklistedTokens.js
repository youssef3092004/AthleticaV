/**
 * Cleanup script for expired blacklisted tokens
 * Remove this from database periodically to prevent bloat
 *
 * Usage:
 *   npm run cleanup:tokens
 *   # Or run via node-cron in production
 */

import { PrismaClient } from "@prisma/client";
import process from "process";

const prisma = new PrismaClient();

export async function cleanupExpiredTokens() {
  try {
    const result = await prisma.blacklistedToken.deleteMany({
      where: {
        expiredAt: {
          lt: new Date(), // Remove all tokens that have already expired
        },
      },
    });

    console.log(`✓ Cleaned up ${result.count} expired blacklisted tokens`);
    return result.count;
  } catch (error) {
    console.error("❌ Error cleaning up blacklisted tokens:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run directly if called as script (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupExpiredTokens()
    .then(() => {
      console.log("Cleanup completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleanup failed:", error);
      process.exit(1);
    });
}
