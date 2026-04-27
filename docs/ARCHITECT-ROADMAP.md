# ATHLETICA MVP - 4-WEEK ARCHITECTURE ROADMAP

## Overview

This roadmap prioritizes the remaining architectural improvements identified in the comprehensive code review. It's structured to minimize disruption while systematically improving code quality and system reliability.

**Total Effort**: 4 weeks (20 working days)  
**Team Size**: 1-2 developers  
**Risk Level**: Medium (breaking changes required)

---

## WEEK 1: MIGRATION & VALIDATION INFRASTRUCTURE

### Monday: Schema Migration

**Tasks**:

1. Generate new Prisma migration
   ```bash
   npm run prisma:dev:migrate -- --name fix_schema_comprehensive
   ```
2. Test migration locally
   - Verify all schema changes apply
   - Check data integrity post-migration

3. Create backfill scripts for:
   - `ClientIntake.answers` JSON → `IntakeAnswer` rows
   - `Message.isRead` → `MessageRead` rows
   - `Conversation.trainerClientId` population

4. Document breaking schema changes in `MIGRATION_GUIDE.md`

**Deliverables**:

- ✅ Migration file in `prisma/migrations/`
- ✅ Backfill scripts in `scripts/`
- ✅ Breaking change documentation

**Tests**:

- [ ] Migrate local DB
- [ ] Backfill sample data
- [ ] Verify data integrity with SQL queries

---

### Tuesday: Input Validation Layer

**Setup Zod**:

```bash
npm install zod
```

**Create validation files**:

```
utils/validation/
├── index.js           (exports all schemas)
├── auth.schemas.js    (login, register)
├── trainer.schemas.js (program, workout, etc.)
├── client.schemas.js  (intake, progress, etc.)
└── shared.schemas.js  (pagination, errors)
```

**Example - TrainerClient Validation**:

```javascript
// utils/validation/trainer.schemas.js
import { z } from "zod";

export const createProgramSchema = z
  .object({
    trainerClientId: z.string().uuid(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: "endDate must be after startDate",
  });

export const adjustWalletSchema = z.object({
  delta: z.number().finite().not().equal(0),
  reason: z.string().max(255).optional(),
});
```

**Create middleware**:

```javascript
// middleware/validateBody.js
export const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    next(new AppError("Validation failed: " + error.message, 400));
  }
};
```

**Apply to routes**:

```javascript
// routes/program.js
router.post(
  "/",
  verifyToken,
  checkPermission("CREATE_PROGRAM"),
  validateBody(createProgramSchema),
  createProgram,
);
```

**Deliverables**:

- ✅ Zod schemas for all major entities
- ✅ Validation middleware
- ✅ Routes updated with validation

**Tests**:

- [ ] Invalid input rejected (e.g., invalid UUID)
- [ ] Valid input accepted
- [ ] Error messages helpful

---

### Wednesday-Thursday: Program Controller Updates

**Refactor controllers to use new schema**:

1. `controllers/program.js`:
   - Update queries: `program.trainerClient.trainer`, `program.trainerClient.client`
   - Fix all `program.trainerId` references

2. `controllers/mealPlan.js`:
   - Remove `trainer` relation (derive from `program`)
   - Update nutrition computation queries

3. `controllers/workout.js`:
   - Remove `clientId`, `trainerId` from `Workout` model
   - Derive from `program.trainerClient`

4. `controllers/conversation.js`:
   - Update to use `trainerClientId`
   - Add relationship validation

**Example Refactor**:

```javascript
// ❌ BEFORE
export const getProgram = async (req, res, next) => {
  const program = await prisma.program.findUnique({
    where: { id },
    include: { trainer: true, client: true },
  });
  // Access: program.trainer, program.client
};

// ✅ AFTER
export const getProgram = async (req, res, next) => {
  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      trainerClient: {
        include: { trainer: true, client: true },
      },
    },
  });
  // Access: program.trainerClient.trainer, .client
};
```

**Deliverables**:

- ✅ All controllers updated for new schema
- ✅ Tests passing with new queries
- ✅ No breaking API endpoints (if possible, add backward compat layer)

**Tests**:

- [ ] Create program: works
- [ ] Get program: returns trainer/client via trainerClient
- [ ] Update program: validates trainerClientId exists

---

### Friday: Integration Testing Setup

**Create integration test suite**:

```
tests/
├── setup.js          (test database, fixtures)
├── auth.test.js      (login, logout, token expiry)
├── program.test.js   (CRUD with new schema)
├── wallet.test.js    (atomic increment/decrement)
└── fixtures/         (seeded test data)
```

**Example - Wallet Atomic Test**:

```javascript
import { describe, it, expect } from "vitest";
import { prisma } from "../configs/db.js";

describe("Wallet Atomic Operations", () => {
  it("should increment wallet atomically", async () => {
    const trainerId = "test-trainer-id";

    // Create initial wallet
    await prisma.trainerWallet.create({
      data: { trainerId, balance: 100 },
    });

    // Concurrent increments
    await Promise.all([
      prisma.trainerWallet.update({
        where: { trainerId },
        data: { balance: { increment: 50 } },
      }),
      prisma.trainerWallet.update({
        where: { trainerId },
        data: { balance: { increment: 50 } },
      }),
    ]);

    // Should be 200, not 150 (race condition)
    const wallet = await prisma.trainerWallet.findUnique({
      where: { trainerId },
    });
    expect(wallet.balance).toBe(200);
  });
});
```

**Setup**:

```bash
npm install --save-dev vitest @vitest/ui
```

**Deliverables**:

- ✅ Integration test framework set up
- ✅ Initial test suite for critical flows
- ✅ CI/CD ready (tests in GitHub Actions)

**Tests**:

- [ ] Tests run: `npm test`
- [ ] Critical flows covered: auth, program, wallet
- [ ] Passes locally with new schema

---

## WEEK 2: SERVICE LAYER EXTRACTION

### Monday-Tuesday: Service Layer Foundation

**Create service directory**:

```
services/
├── index.js               (exports all services)
├── trainerClient.service.js
├── program.service.js
├── wallet.service.js
├── mealPlan.service.js
└── workout.service.js
```

**Example - TrainerClient Service**:

```javascript
// services/trainerClient.service.js

export class TrainerClientService {
  /**
   * Create a new trainer-client relationship
   * Returns error if relationship already exists
   */
  async createRelationship(trainerId, clientId) {
    return prisma.trainerClient.create({
      data: {
        trainerId,
        clientId,
        status: "ACTIVE",
      },
    });
  }

  /**
   * Get client dashboard (single query for all needed data)
   * Replaces 5+ separate requests
   */
  async getClientDashboard(clientId) {
    return prisma.trainerClient.findMany({
      where: { clientId },
      include: {
        programs: {
          where: {
            /* current program only */
          },
          include: {
            workouts: {
              /* today's workout */
            },
            mealPlans: {
              /* today's meals */
            },
          },
        },
        conversation: {
          /* unread count */
        },
      },
    });
  }

  /**
   * End relationship with cascade: archive programs, read-only conversations
   */
  async endRelationship(trainerClientId) {
    return prisma.$transaction(async (tx) => {
      // Update relationship
      const relationship = await tx.trainerClient.update({
        where: { id: trainerClientId },
        data: { status: "ENDED" },
      });

      // Archive active programs
      await tx.program.updateMany({
        where: { trainerClientId },
        data: { status: "ARCHIVED" },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: trainerId,
          action: "TRAINER_CLIENT_ENDED",
        },
      });

      return relationship;
    });
  }
}

export const trainerClientService = new TrainerClientService();
```

**Refactor Controllers**:

```javascript
// ❌ BEFORE: Business logic in controller
export const createProgram = async (req, res, next) => {
  try {
    const validated = createProgramSchema.parse(req.body);

    const program = await prisma.program.create({
      data: {
        trainerClientId: validated.trainerClientId,
        startDate: validated.startDate,
        endDate: validated.endDate,
      },
    });

    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
};

// ✅ AFTER: Thin controller
import { programService } from "../services/program.service.js";

export const createProgram = async (req, res, next) => {
  try {
    const validated = createProgramSchema.parse(req.body);
    const program = await programService.create(validated);
    res.json({ success: true, data: program });
  } catch (error) {
    next(error);
  }
};
```

**Deliverables**:

- ✅ Services extracted for all entities
- ✅ Controllers refactored to use services
- ✅ Business logic centralized

**Tests**:

- [ ] Services work independently (unit tests)
- [ ] Controllers properly delegate to services
- [ ] Integration still passes

---

### Wednesday-Thursday: Business Logic Layer

**Implement complex flows in services**:

1. **Program State Machine**:

   ```javascript
   // PENDING_CREATION → ACTIVE → COMPLETED → ARCHIVED
   const validTransitions = {
     ACTIVE: ["COMPLETED", "ARCHIVED"],
     COMPLETED: ["ARCHIVED"],
     ARCHIVED: [],
   };
   ```

2. **Wallet Enforcement**:

   ```javascript
   // Ensure wallet never goes negative
   async updateBalance(trainerId, delta) {
     const wallet = await prisma.trainerWallet.findUnique(...);
     if (wallet.balance + delta < 0) {
       throw new Error('Insufficient balance');
     }
     return prisma.trainerWallet.update({
       data: { balance: { increment: delta } }
     });
   }
   ```

3. **Conversation Access Control**:
   ```javascript
   // Only allow message in active TrainerClient relationship
   async sendMessage(senderId, conversationId, body) {
     const conv = await prisma.conversation.findUnique({
       include: { trainerClient: true }
     });

     if (conv.trainerClient.status !== 'ACTIVE') {
       throw new Error('Relationship ended, cannot message');
     }

     return prisma.message.create({...});
   }
   ```

**Deliverables**:

- ✅ Business logic rules implemented as service methods
- ✅ Complex flows have clear entry points
- ✅ Error handling centralized

**Tests**:

- [ ] Service methods tested independently
- [ ] Complex flows tested end-to-end
- [ ] Error cases covered

---

### Friday: RBAC Caching

**Install Redis client**:

```bash
npm install ioredis
```

**Implement permission cache**:

```javascript
// services/rbac.service.js

const redis = new Redis(process.env.REDIS_URL);
const CACHE_TTL = 5 * 60; // 5 minutes

export async function getUserPermissions(userId) {
  const cached = await redis.get(`permissions:${userId}`);
  if (cached) return JSON.parse(cached);

  const roles = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  const permissions = roles.flatMap((r) =>
    r.role.rolePermissions.map((rp) => rp.permission.key),
  );

  await redis.setex(
    `permissions:${userId}`,
    CACHE_TTL,
    JSON.stringify(permissions),
  );

  return permissions;
}

export async function invalidateUserCache(userId) {
  await redis.del(`permissions:${userId}`);
}
```

**Invalidate on role changes**:

```javascript
// When RolePermission is created/deleted
await invalidateUserCache(rolePermission.role.userRoles[*].userId);
```

**Deliverables**:

- ✅ Permission caching implemented
- ✅ Cache invalidation on role changes
- ✅ Performance improvement (5-10x faster authorization checks)

**Tests**:

- [ ] Cache hits reduce DB queries
- [ ] Cache invalidation works
- [ ] Stale permissions not used

---

## WEEK 3: DATABASE OPTIMIZATION & CLEANUP

### Monday: Index Verification

**Run explain plans on critical queries**:

```sql
-- Check if queries use indexes
EXPLAIN ANALYZE
SELECT * FROM "ProgressMetric"
WHERE "userId" = $1 AND "recordedAt" BETWEEN $2 AND $3;

EXPLAIN ANALYZE
SELECT * FROM "BlacklistedToken"
WHERE "expiredAt" < NOW();
```

**Verify all indexes are in place**:

```bash
npm run prisma:dev:studio  # Visual inspection
```

**Deliverables**:

- ✅ Index usage verified with EXPLAIN plans
- ✅ Performance baseline established

---

### Tuesday: Computed Fields Documentation

**Document how to replace removed tables**:

```
docs/COMPUTED-FIELDS.md
```

**Example**: DayProgress → Computed

```javascript
// Instead of: const dayProgress = await prisma.dayProgress.findUnique(...)

// Do this:
async function isWorkoutDayComplete(userId, date) {
  const completedCount = await prisma.workoutCompletion.count({
    where: {
      workoutItem: {
        day: {
          workout: {
            program: {
              trainerClient: { clientId: userId },
            },
          },
          date: {
            equals: date,
          },
        },
      },
    },
  });

  const totalCount = await prisma.workoutItem.count({
    where: {
      day: {
        workout: {
          program: {
            trainerClient: { clientId: userId },
          },
        },
        date: { equals: date },
      },
    },
  });

  return completedCount === totalCount;
}
```

**Deliverables**:

- ✅ Migration guide for removed tables
- ✅ Replacement query examples
- ✅ Performance considerations documented

---

### Wednesday-Thursday: Async Job Infrastructure

**Set up cron jobs for maintenance**:

```bash
npm install node-cron
```

**Create job scheduler**:

```javascript
// services/jobs.service.js

import cron from "node-cron";
import { cleanupExpiredTokens } from "../scripts/cleanupBlacklistedTokens.js";

// Daily 3 AM: Clean up expired tokens
cron.schedule("0 3 * * *", async () => {
  try {
    const count = await cleanupExpiredTokens();
    console.log(`✓ Cleaned up ${count} expired tokens`);
  } catch (error) {
    console.error("Token cleanup failed:", error);
    // Alert on-call engineer
  }
});

// Weekly: Archive old activity logs
cron.schedule("0 0 * * 0", async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const archived = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: thirtyDaysAgo } },
  });

  console.log(`✓ Archived ${archived.count} old activity logs`);
});

export function startJobScheduler() {
  console.log("Job scheduler started");
}
```

**Start in server**:

```javascript
// server.js
import { startJobScheduler } from "./services/jobs.service.js";

startJobScheduler();
```

**Deliverables**:

- ✅ Cron jobs set up and tested
- ✅ Monitoring/alerting in place
- ✅ Database cleanup automated

**Tests**:

- [ ] Jobs run on schedule
- [ ] Jobs log completion/errors
- [ ] No concurrent job execution

---

### Friday: Data Quality Checks

**Create data integrity checks**:

```javascript
// scripts/dataIntegrityCheck.js

export async function checkDataIntegrity() {
  const issues = [];

  // 1. Programs with missing TrainerClient
  const orphanedPrograms = await prisma.program.findMany({
    where: {
      trainerClient: null,
    },
  });
  if (orphanedPrograms.length) {
    issues.push(`${orphanedPrograms.length} programs missing TrainerClient`);
  }

  // 2. Wallets with negative balance
  const negativeWallets = await prisma.trainerWallet.findMany({
    where: { balance: { lt: 0 } },
  });
  if (negativeWallets.length) {
    issues.push(`${negativeWallets.length} wallets with negative balance`);
  }

  // 3. IntakeAnswers with invalid questions
  const invalidAnswers = await prisma.intakeAnswer.findMany({
    where: {
      question: { notIn: Object.values(IntakeQuestionKey) },
    },
  });
  if (invalidAnswers.length) {
    issues.push(
      `${invalidAnswers.length} intake answers with invalid questions`,
    );
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}
```

**Deliverables**:

- ✅ Data integrity check script
- ✅ Can be run regularly to detect issues
- ✅ Reports actionable errors

---

## WEEK 4: TESTING & FINALIZATION

### Monday-Tuesday: E2E Test Suite

**Create full trainer-client flow test**:

```javascript
// tests/e2e/trainerClientFlow.test.js

describe('Trainer-Client Coaching Flow', () => {
  it('should complete full coaching cycle', async () => {
    // 1. Trainer registers
    const trainer = await registerTrainer({...});

    // 2. Trainer creates invite code
    const inviteCode = await createInviteCode(trainer.id);

    // 3. Client registers with invite
    const client = await registerClient({...}, inviteCode);

    // 4. System creates TrainerClient relationship
    const relationship = await getTrainerClientRelationship(trainer.id, client.id);
    expect(relationship.status).toBe('ACTIVE');

    // 5. Trainer creates program
    const program = await createProgram({
      trainerClientId: relationship.id,
      startDate: today,
      endDate: addDays(today, 30)
    });

    // 6. Trainer creates workout plan
    const workout = await createWorkout({
      programId: program.id
    });

    // 7. Client completes workout item
    await completeWorkoutItem({
      itemId: workout.days[0].items[0].id
    });

    // 8. Client gets dashboard
    const dashboard = await getClientDashboard(client.id);
    expect(dashboard.programs[0].workouts[0].completedCount).toBe(1);

    // 9. Trainer ends relationship
    await endTrainerClientRelationship(relationship.id);

    // 10. Conversation becomes read-only
    const canMessage = await canSendMessage(trainer.id, relationship.id);
    expect(canMessage).toBe(false);
  });
});
```

**Deliverables**:

- ✅ E2E tests for critical flows
- ✅ Tests run in CI/CD
- ✅ Regression detection

---

### Wednesday: Performance Benchmarks

**Measure before/after improvements**:

```javascript
// tests/performance.bench.js

import { bench } from 'vitest';

bench('Get client dashboard - v1 (new implementation)', async () => {
  await getClientDashboard(clientId);
});

bench('Create program with wallet transaction', async () => {
  await createProgram({...});
  await adjustWalletBalance({...});
});

bench('Query progress metrics with index', async () => {
  await queryProgressMetrics(userId, startDate, endDate);
});
```

**Run and compare**:

```bash
npm run bench
# Compare with previous baseline
```

**Deliverables**:

- ✅ Performance benchmarks established
- ✅ Baseline documentation
- ✅ Future optimizations tracked

---

### Thursday: Documentation & Knowledge Transfer

**Create developer guides**:

1. `docs/ARCHITECTURE.md` - System design overview
2. `docs/SCHEMA.md` - Updated schema documentation
3. `docs/API.md` - Endpoint documentation
4. `docs/MIGRATION.md` - Migration guide for deployments
5. `docs/TESTING.md` - How to write/run tests

**Example - ARCHITECTURE.md**:

```markdown
# Architecture Overview

## Layers

### Routes (`routes/`)

- Thin HTTP handling
- Auth/permission checks
- Input validation
- Call appropriate service

### Services (`services/`)

- All business logic
- Database transactions
- Error handling
- No HTTP knowledge

### Repositories (future optimization)

- All Prisma queries
- Query building helpers
- Cache integration

## Data Flow

Request → Route → Validate → Service → Repo → Prisma → DB
↓ ↓ ↓ ↓ ↓ ↓
Auth Schema Business Cache SQL PG
```

**Deliverables**:

- ✅ Comprehensive developer documentation
- ✅ Onboarding materials
- ✅ Architecture decisions documented

---

### Friday: Release & Deployment Plan

**Checklist before production deployment**:

- [ ] All tests passing (`npm test`)
- [ ] Performance benchmarks acceptable
- [ ] Data integrity checks pass
- [ ] Backup taken of production database
- [ ] Rollback plan documented
- [ ] Team trained on new architecture
- [ ] Monitoring alerts configured

**Deployment strategy** (zero-downtime):

```
1. Deploy new code (old + new code compatible)
2. Run migration: CREATE new tables (MessageRead, IntakeAnswer, etc.)
3. Run backfill scripts: Migrate data
4. Test: Verify both paths work
5. Update code: Remove old code paths
6. Monitor: Watch for errors 24 hours
7. Cleanup: Archive old tables after 1 week
```

**Deliverables**:

- ✅ Release notes
- ✅ Deployment checklist
- ✅ Rollback procedures
- ✅ Monitoring configured

---

## SUCCESS METRICS

By end of 4 weeks:

| Metric                | Target | Current | Status |
| --------------------- | ------ | ------- | ------ |
| Code coverage         | 70%    | 0%      | 🔴     |
| API response time     | <200ms | ~300ms  | 🟡     |
| DBqueries/request     | <3     | ~5-8    | 🔴     |
| Schema design score   | A      | D-      | 🔴     |
| Financial accuracy    | 100%   | 95%     | 🟡     |
| Data integrity issues | 0      | 3-5     | 🔴     |

---

## RESOURCE REQUIREMENTS

- **Backend Developer**: 1 full-time (primary implementer)
- **QA/Tester**: 0.5 full-time (review, write tests)
- **DevOps**: On-call for deployment + monitoring
- **Database Admin**: Code review for migrations

---

## RISKS & MITIGATION

| Risk                   | Impact   | Mitigation                       |
| ---------------------- | -------- | -------------------------------- |
| Breaking changes       | HIGH     | Thorough testing, staged rollout |
| Data loss              | CRITICAL | Backups, validation checks       |
| Performance regression | MEDIUM   | Benchmarking, index verification |
| Team knowledge gap     | MEDIUM   | Documentation, pair programming  |

---

## CONCLUSION

This 4-week roadmap transforms Athletica from "working but fragile" to "production-ready and maintainable". The foundation built here supports:

- Faster feature development (service layer)
- Higher reliability (atomic operations, proper schema)
- Better performance (indexes, caching)
- Easier scaling (clean architecture)

**Next Step**: Schedule kickoff meeting to confirm timeline and resource allocation.
