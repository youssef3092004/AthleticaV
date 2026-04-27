# SCHEMA MIGRATION GUIDE - Critical Breaking Changes

## Overview

This guide covers all breaking changes from the comprehensive code review refactoring. **Deployment requires updating all affected code.**

---

## CRITICAL: Program Model Changes

### Change Summary

The `Program` model no longer stores `trainerId` and `clientId`. These must be derived from the `TrainerClient` relationship.

### What Changed

```prisma
# ❌ BEFORE
model Program {
  trainerId       String
  clientId        String
  trainerClientId String
  trainer         User @relation(...)
  client          User @relation(...)
  trainerClient   TrainerClient @relation(...)
}

# ✅ AFTER
model Program {
  trainerClientId String
  trainerClient   TrainerClient @relation(...)
}
```

### Impact: BREAKING ⚠️

### Code Updates Required

**Option A: Use TrainerClient relation** (recommended)

```javascript
// ❌ OLD
const program = await prisma.program.findUnique({
  where: { id: programId },
  include: { trainer: true, client: true },
});

console.log(program.trainer.name);
console.log(program.client.name);

// ✅ NEW
const program = await prisma.program.findUnique({
  where: { id: programId },
  include: {
    trainerClient: {
      include: { trainer: true, client: true },
    },
  },
});

console.log(program.trainerClient.trainer.name);
console.log(program.trainerClient.client.name);
```

**Option B: Flatten in response** (if you want to keep API unchanged)

```javascript
function flattenProgram(program) {
  return {
    id: program.id,
    startDate: program.startDate,
    endDate: program.endDate,
    trainerId: program.trainerClient.trainerId,
    clientId: program.trainerClient.clientId,
    trainer: program.trainerClient.trainer,
    client: program.trainerClient.client,
  };
}
```

### Affected Files

Search for these patterns and update:

```bash
grep -r "program.trainer" controllers/
grep -r "program.client" controllers/
grep -r "program.trainerId" controllers/
grep -r "program.clientId" controllers/
grep -r "where.*trainerId.*clientId.*programId" controllers/
```

**Specific Controllers to Check**:

- [controllers/program.js](controllers/program.js)
- [controllers/mealPlan.js](controllers/mealPlan.js)
- [controllers/workout.js](controllers/workout.js)
- [controllers/transaction.js](controllers/transaction.js)
- [controllers/activityLog.js](controllers/activityLog.js)

### Test Cases

```javascript
// ✅ This should work
await prisma.program.findUnique({
  where: { id },
  include: { trainerClient: { include: { trainer: true, client: true } } },
});

// ✅ This should work
await prisma.program.updateMany({
  where: { trainerClientId },
  data: { status: "ARCHIVED" },
});

// ❌ This will FAIL (field no longer exists)
await prisma.program.findUnique({
  where: { id },
  include: { trainer: true }, // ERROR: Invalid include path
});
```

---

## CRITICAL: Message Read Status Changes

### Change Summary

`Message.isRead` boolean replaced with proper `MessageRead` junction table.

### What Changed

```prisma
# ❌ BEFORE
model Message {
  isRead Boolean @default(false)
}

# ✅ AFTER
model Message {
  reads MessageRead[]  // Junction table
}

model MessageRead {
  messageId String @unique
  readerId  String
  readAt    DateTime
  message   Message @relation(...)
}
```

### Impact: BREAKING ⚠️

### Code Updates Required

```javascript
// ❌ OLD: Simple boolean check
const unreadMessages = await prisma.message.findMany({
  where: {
    conversationId,
    isRead: false
  }
});

// ✅ NEW: Proper read tracking
const unreadMessages = await prisma.message.findMany({
  where: {
    conversationId,
    reads: {
      none: {
        readerId: currentUserId
      }
    }
  }
});

// ❌ OLD: Mark as read
await prisma.message.update({
  where: { id: messageId },
  data: { isRead: true }
});

// ✅ NEW: Track who read it and when
await prisma.messageRead.create({
  data: {
    messageId,
    readerId: currentUserId
  }
});

// ❌ OLD: Check if read
if (message.isRead) { ... }

// ✅ NEW: Check if specific user read it
const isReadByUser = message.reads.some(r => r.readerId === userId);
if (isReadByUser) { ... }

// ✅ NEW: Get unread count per user
const unreadCount = await prisma.message.count({
  where: {
    conversationId,
    reads: {
      none: { readerId: userId }
    }
  }
});
```

### Affected Files

- [controllers/message.js](controllers/message.js)
- [controllers/conversation.js](controllers/conversation.js)
- Any frontend code accessing `message.isRead`

### Migration Script

```javascript
// scripts/migrateMessageRead.js
export async function migrateMessageReadStatus() {
  // Get all messages that were marked as read
  const readMessages = await prisma.message.findMany({
    where: { isRead: true },
    include: {
      conversation: true,
    },
  });

  let created = 0;

  for (const message of readMessages) {
    // Assume the other party read it
    const readerId =
      message.senderId === message.conversation.trainerId
        ? message.conversation.clientId
        : message.conversation.trainerId;

    try {
      await prisma.messageRead.create({
        data: {
          messageId: message.id,
          readerId,
          readAt: new Date(), // Or from message metadata if available
        },
      });
      created++;
    } catch (err) {
      if (err.code !== "P2002") {
        // Unique constraint error
        throw err;
      }
    }
  }

  console.log(`✓ Created ${created} MessageRead records`);
}
```

---

## MAJOR: ClientIntake JSON → IntakeAnswer Refactor

### Change Summary

`ClientIntake.answers` was a free-form JSON blob. Now it's a structured `IntakeAnswer` table.

### What Changed

```prisma
# ❌ BEFORE
model ClientIntake {
  answers Json  // { "fitnessGoal": "WEIGHT_LOSS", "age": 25, ... }
}

# ✅ AFTER
model ClientIntake {
  answers IntakeAnswer[]  // Structured rows
}

model IntakeAnswer {
  question IntakeQuestionKey  // Enum: AGE, FITNESS_GOAL, etc.
  value    String
  intake   ClientIntake @relation(...)
}
```

### Impact: BREAKING ⚠️

### Code Updates Required

```javascript
// ❌ OLD: Access as JSON
const intake = await prisma.clientIntake.findUnique({
  where: { clientId },
});

const age = intake.answers.age;
const goal = intake.answers.primaryFitnessGoal;

// ✅ NEW: Access via relation
const intake = await prisma.clientIntake.findUnique({
  where: { clientId },
  include: { answers: true },
});

const ageAnswer = intake.answers.find((a) => a.question === "AGE");
const age = ageAnswer?.value;

const goalAnswer = intake.answers.find(
  (a) => a.question === "PRIMARY_FITNESS_GOAL",
);
const goal = goalAnswer?.value;

// ✅ BETTER: Use helper function
function getIntakeAnswer(intake, question) {
  return intake.answers.find((a) => a.question === question)?.value;
}

const age = getIntakeAnswer(intake, "AGE");
const goal = getIntakeAnswer(intake, "PRIMARY_FITNESS_GOAL");

// ✅ BETTER: Query directly for specific answer
const goalAnswer = await prisma.intakeAnswer.findUnique({
  where: {
    intakeId_question: {
      intakeId,
      question: "PRIMARY_FITNESS_GOAL",
    },
  },
});

const goal = goalAnswer?.value;

// ✅ Query by answer value
const clientsWithWeightLossGoal = await prisma.intakeAnswer.findMany({
  where: {
    question: "PRIMARY_FITNESS_GOAL",
    value: "WEIGHT_LOSS",
  },
  include: { intake: { include: { client: true } } },
});
```

### Affected Files

- [controllers/clientIntake.js](controllers/clientIntake.js)
- [controllers/clientProfile.js](controllers/clientProfile.js)
- Any queries/forms accessing intake answers

### Migration Script

```javascript
// scripts/migrateIntakeAnswers.js
import { IntakeQuestionKey } from "@prisma/client";

export async function migrateIntakeAnswers() {
  const intakes = await prisma.clientIntake.findMany({
    where: { answers: { not: null } },
  });

  let created = 0;

  for (const intake of intakes) {
    if (!intake.answers || typeof intake.answers !== "object") {
      continue;
    }

    // Map old field names to enum values
    const answerMap = {
      age: "AGE",
      gender: "GENDER",
      height: "HEIGHT_CM",
      weight: "WEIGHT_KG",
      fitnessGoal: "PRIMARY_FITNESS_GOAL",
      primaryFitnessGoal: "PRIMARY_FITNESS_GOAL",
      goals: "PRIMARY_FITNESS_GOALS",
      // ... map all other fields
    };

    for (const [oldField, enumValue] of Object.entries(answerMap)) {
      const value = intake.answers[oldField];
      if (value !== undefined && value !== null) {
        try {
          await prisma.intakeAnswer.create({
            data: {
              intakeId: intake.id,
              question: enumValue,
              value: String(value),
            },
          });
          created++;
        } catch (err) {
          if (err.code !== "P2002") {
            // Unique constraint
            console.warn(`Failed to create answer:`, err.message);
          }
        }
      }
    }
  }

  console.log(`✓ Migrated ${created} intake answers`);
}
```

---

## IMPORTANT: Conversation → TrainerClient Coupling

### Change Summary

`Conversation` now requires `trainerClientId` to properly scope conversations to relationships.

### What Changed

```prisma
# ❌ BEFORE
model Conversation {
  trainerId String
  clientId  String
}

# ✅ AFTER
model Conversation {
  trainerClientId String
  trainerId       String  // Denormalized
  clientId        String  // Denormalized
  trainerClient   TrainerClient @relation(...)
}
```

### Impact: MAJOR CHANGE ⚠️

### Code Updates Required

```javascript
// ❌ OLD: No relationship validation
const conversation = await prisma.conversation.findUnique({
  where: { id: conversationId },
});

// ✅ NEW: Validates relationship exists and is active
const conversation = await prisma.conversation.findUnique({
  where: { id: conversationId },
  include: {
    trainerClient: true, // Check relationship status
  },
});

if (conversation.trainerClient.status !== "ACTIVE") {
  throw new Error("Relationship has ended, conversations are read-only");
}

// ✅ NEW: Find/create conversation for relationship
const conversation = await prisma.conversation.upsert({
  where: { trainerClientId },
  update: {},
  create: {
    trainerClientId,
    trainerId: trainerClient.trainerId,
    clientId: trainerClient.clientId,
  },
});
```

### Affected Files

- [controllers/conversation.js](controllers/conversation.js)
- [controllers/message.js](controllers/message.js)

### Migration Script

```javascript
// scripts/migrateConversations.js
export async function migrateConversationToTrainerClient() {
  // Populate trainerClientId from existing trainerId + clientId combo
  const conversations = await prisma.conversation.findMany();

  let updated = 0;

  for (const conv of conversations) {
    const trainerClient = await prisma.trainerClient.findFirst({
      where: {
        trainerId: conv.trainerId,
        clientId: conv.clientId,
      },
    });

    if (trainerClient) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          trainerClientId: trainerClient.id,
        },
      });
      updated++;
    } else {
      console.warn(
        `No TrainerClient found for conversation ${conv.id}: ` +
          `trainer=${conv.trainerId}, client=${conv.clientId}`,
      );
    }
  }

  console.log(`✓ Updated ${updated} conversations`);
}
```

---

## REMOVED: DayPlan & DayProgress Tables

### Change Summary

These tables stored computed data. Use queries instead.

### What Changed

```prisma
# ❌ REMOVED
model DayPlan { ... }
model DayProgress { ... }

# ✅ REPLACED BY: Computed queries
```

### Impact: BREAKING - Tables deleted ⚠️

### Code Updates Required

```javascript
// ❌ OLD: Query table directly
const dayProgress = await prisma.dayProgress.findUnique({
  where: { userId_date: { userId, date } },
});

console.log(dayProgress.workoutCompleted);
console.log(dayProgress.nutritionCompleted);

// ✅ NEW: Compute from completion records
async function getDayProgress(userId, date) {
  // Get all workouts for the day
  const workoutItems = await prisma.workoutItem.findMany({
    where: {
      day: {
        workout: {
          program: { trainerClient: { clientId: userId } },
        },
        date: { equals: date },
      },
    },
  });

  // Get completions for those items
  const completions = await prisma.workoutCompletion.findMany({
    where: {
      workoutItemId: { in: workoutItems.map((i) => i.id) },
    },
  });

  // Compute completion status
  const workoutCompleted =
    workoutItems.length > 0 && completions.length === workoutItems.length;

  // Similar for meals/nutrition...

  return {
    workoutCompleted,
    nutritionCompleted,
    date,
  };
}

// Usage
const progress = await getDayProgress(userId, new Date());
```

### Affected Files

- Any code querying `DayProgress` or `DayPlan`
- Streak calculation logic
- Dashboard queries

### Helper Functions

```javascript
// services/dayProgress.service.js

export async function getWorkoutDayProgress(userId, date) {
  const itemIds = (
    await prisma.workoutItem.findMany({
      where: {
        day: {
          workout: {
            program: { trainerClient: { clientId: userId } },
          },
          date: { equals: date },
        },
      },
      select: { id: true },
    })
  ).map((i) => i.id);

  if (!itemIds.length) return null;

  const completions = await prisma.workoutCompletion.count({
    where: { workoutItemId: { in: itemIds } },
  });

  return {
    total: itemIds.length,
    completed: completions,
    percentage: Math.round((completions / itemIds.length) * 100),
  };
}

export async function getNutritionDayProgress(userId, date) {
  // Similar logic for meals...
}
```

---

## MINOR: Model Name Consistency

### Change Summary

Fixed: `quotation` → `Quotation` (capitalization)

### What Changed

```prisma
# ❌ BEFORE
model quotation { ... }

# ✅ AFTER
model Quotation { ... }
```

### Code Updates

```javascript
// ❌ OLD
const quote = await prisma.quotation.findUnique(...);

// ✅ NEW
const quote = await prisma.Quotation.findUnique(...);
```

---

## Added: New Fields

### TrainerWallet.totalEarned

```javascript
// NEW: Track lifetime earnings
const wallet = await prisma.trainerWallet.findUnique({
  where: { trainerId },
});

console.log(wallet.balance); // Current balance
console.log(wallet.totalEarned); // Lifetime earnings
```

### ActivityLog.action (now enum)

```javascript
// ❌ OLD: Free-form string
await prisma.activityLog.create({
  data: {
    action: "trainer_wallet_adjusted", // Type-unsafe
  },
});

// ✅ NEW: Enum
await prisma.activityLog.create({
  data: {
    action: ActivityLogActionType.USER_WALLET_ADJUSTED, // Type-safe
  },
});
```

---

## Testing Checklist

Before deployment, verify:

- [ ] All `program.trainer` references updated
- [ ] All `program.client` references updated
- [ ] `Message.isRead` queries converted to `reads` relation
- [ ] `ClientIntake.answers` JSON queries converted
- [ ] `DayProgress`/`DayPlan` queries replaced with computed logic
- [ ] `Conversation` queries include `trainerClientId`
- [ ] Migration scripts tested on dev database
- [ ] Integration tests passing
- [ ] No type errors with new schema

---

## Rollback Plan

If issues arise after deployment:

1. **Revert code changes** (git revert)
2. **Keep new schema** (can't easily drop tables)
3. **Use compat queries** that handle both old/new data structures

```javascript
// Backward compat example
async function getProgramTrainer(programId) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      trainerClient: { include: { trainer: true } },
    },
  });

  // Will work even if old code tries to access program.trainerId
  return program.trainerClient?.trainer;
}
```

---

## Need Help?

Questions about migration? Check:

- [CODE-REVIEW-FIXES-APPLIED.md](./CODE-REVIEW-FIXES-APPLIED.md) - Full context
- [ARCHITECT-ROADMAP.md](./ARCHITECT-ROADMAP.md) - Implementation timeline
- Prisma docs: https://www.prisma.io/docs/
