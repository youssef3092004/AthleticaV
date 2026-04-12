# Database Schema Overview

Visual guide to the AthleticaV database structure and relationships.

## Entity Relationship Map

### User & Authentication Layer

```
┌─────────────┐         ┌──────────┐         ┌────────────────┐
│   User      │◄────────┤ UserRole │────────►│   Role         │
│ (accounts)  │ many    │(junction)│ many    │ (TRAINER, etc) │
└─────────────┘         └──────────┘         └────────────────┘
      │                                              │
      │                                              │
      └──────────────────┬──────────────────────────┘
                         │
                    many-to-many
                    (roles via junction)
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
    ┌──▼──┐         ┌────▼────┐    ┌──────▼──────┐
    │     │         │          │    │             │
┌─────────────┐ ┌───────────────┐ ┌──────────────────┐
│ Permission  │ │ RolePermission│ │ UserPermission   │
│ (actions)   │ │ (Role→Perm)   │ │ (User overrides) │
└─────────────┘ └───────────────┘ └──────────────────┘

┌────────────────┐
│ BlacklistedToken│ ← Tracks logout tokens
└────────────────┘
```

### User Profiles Layer

```
┌──────────┐                    ┌─────────────┐
│  User    │◄───────┬──────────►│ TrainerProfile
│          │        │           │ (bio, rates)
└──────────┘        │           └─────────────┘
                    │
                    │
                    ├──────────►┌─────────────┐
                    │           │ ClientProfile
                    │           │ (metrics)
                    │           └─────────────┘
                    │
                    └──────────►┌──────────────┐
                                │ ClientIntake
                                │ (questionnaire)
                                └──────────────┘
```

### Coaching Relationship Layer

```
┌──────────────────────────────────────────────────────────────┐
│           TRAINER-CLIENT RELATIONSHIP FLOW                    │
└──────────────────────────────────────────────────────────────┘

Step 1 - Invitation
Step 2 - Acceptance
Step 3 - Coaching
Step 4 - End

         ┌───────────────────────────┐
         │ TrainerClientInvite       │
         │ (PENDING→ACCEPTED/EXPIRED)│
         └────────┬──────────────────┘
                  │
                  ▼ (client accepts)
         ┌────────────────────┐
         │ TrainerClient      │
         │ ACTIVE/PAUSED/ENDED│ ◄─── Enables meal/workout programs
         └────────────────────┘
```

**Key:** Only after TrainerClient exists can trainer create meals/workouts for client.

### Meal Planning Layer

```
┌─────────────────────────────────────┐
│ MEAL PLANNING SYSTEM                │
│ (Template Pattern + Custom Pattern) │
└─────────────────────────────────────┘

Template Path:
┌──────────────┐         ┌────────────────────┐
│ MealTemplate │────────►│ MealTemplateDay[]  │
│ (reusable)   │ 1:many  │ (structure)        │
└──────────────┘         │                   │
                         ├─ MealTemplateItem[]
                         │  (food references)
                         └────────────────────┘

Create from Template:
         ┌────────────┐
         │ MealPlan   │ ◄─── Trainer selects template
         │ (DRAFT)    │
         └────────────┘
              │
              ├─────────────► Copy template structure ───────────────┐
              │                                                      ▼
              │                                            ┌────────────────────┐
              │                                            │ MealPlanDay[]      │
              │                                            │ (populated from    │
              │                                            │  template days)    │
              │                                            │                    │
              │                                            ├─ MealPlanItem[]   │
              │                                            │  (populated from   │
              │                                            │   template items)  │
              │                                            └────────────────────┘
              │
              └─► Status changes: DRAFT → ACTIVE → COMPLETED/ARCHIVED

Completion Tracking:
         ┌──────────────────┐
         │ MealCompletion   │ ◄─── Client logs "I ate this"
         │ (what was eaten) │
         │ references       │
         │ MealPlanItem     │
         └──────────────────┘
              │
              └─► System calculates: % complete, macro hit, adherence
```

**Relations:**

```
MealPlan (1) ◄─── 1:many ───► MealPlanDay
MealPlanDay (1) ◄─── 1:many ───► MealPlanItem
MealPlanItem (1) ◄─── 1:many ───► MealCompletion (client logs)
MealGood item references Food from catalog
```

### Workout Programming Layer

```
┌──────────────────────────────────┐
│ WORKOUT SYSTEM (Same as Meals)   │
│ - Templates for quick setup      │
│ - Custom for personalization     │
│ - Progressive overload tracking  │
└──────────────────────────────────┘

Workout (1) ◄─── 1:many ───► WorkoutDay
WorkoutDay (1) ◄─── 1:many ───► WorkoutItem
WorkoutItem (1) ◄─── 1:many ───► WorkoutCompletion

WorkoutItem includes:
  • sets: number
  • reps: range (e.g., 8-10)
  • weight: number
  • progressionWeeks: [1, 3, 5] (when to increase)
  • progressionIncrement: number

WorkoutCompletion logs:
  • actualSets: [{reps, weight, rpe}]
  • exercises completed: true/false
  • form notes
```

### Messaging Layer

```
┌──────────────────────┐
│ Conversation         │ ◄─── Thread between 2 users
│ (trainer ↔ client)   │       (linked via TrainerClient)
└──────────────────────┘
         │
         ├─── 1:many ──► ┌──────────────┐
                         │ Message[]    │
                         │ (TEXT/IMAGE/ │
                         │  VIDEO/FILE) │
                         └──────────────┘
                              │
                              ├─ 1:many ──► ┌──────────────┐
                              │             │ MessageRead  │
                              │             │ (per user)   │
                              │             └──────────────┘
                              │
                              └─ Broadcast via WebSocket (Socket.IO)
```

### Progress Tracking Layer

```
┌─────────────────────┐
│ ProgressMetric[]    │ ◄─── Client logs weight/body fat/muscle
│ (timestamped data)  │      System calculates trends
└─────────────────────┘

Aggregated into:
  • Daily averages
  • Weekly trends (linear regression)
  • Monthly changes
  • Comparisons vs. baseline
  • Recommendations (e.g., plateau detected)
```

### Financial Layer

```
┌───────────────────────────────────────────┐
│ WALLET & PAYOUT SYSTEM                     │
└───────────────────────────────────────────┘

Session/Payment Event
         │
         ▼
    ┌────────────┐     Status: PENDING
    │Transaction │     (Awaiting processor)
    └────────────┘
         │
         │ Webhook from Stripe
         ▼
    Status: PAID
         │
         ▼
    ┌──────────────┐
    │TrainerWallet │ ◄─── Balance updated
    │ balance += $ │
    └──────────────┘
         │
         │ Trainer requests withdrawal
         ▼
    ┌───────┐
    │Payout │ ─► Status: PENDING (Stripe processing)
    └───────┘
         │
         │ Stripe settles (24-48h)
         ▼
    Status: COMPLETED
         │
         ▼
    TrainerWallet.balance -= amount
```

---

## Key Tables & Fields

### Users & Authentication

| Table                | Key Fields                                   | Purpose                              |
| -------------------- | -------------------------------------------- | ------------------------------------ |
| **User**             | id, email, passwordHash, firstName, lastName | Base account                         |
| **UserRole**         | userId, roleId                               | Assign roles to users                |
| **Role**             | id, name                                     | System roles (TRAINER, CLIENT, etc.) |
| **Permission**       | id, name, description                        | Granular actions (CREATE-MEAL_PLAN)  |
| **RolePermission**   | roleId, permissionId                         | Role → Permission mapping            |
| **UserPermission**   | userId, permissionId                         | Override permissions per user        |
| **BlacklistedToken** | token, expiresAt                             | Logout tracking                      |

### Profiles & Relationships

| Table                   | Key Fields                                             | Purpose                  |
| ----------------------- | ------------------------------------------------------ | ------------------------ |
| **TrainerProfile**      | trainerId, bio, specialty, hourlyRate, experienceLevel | Trainer details          |
| **ClientProfile**       | clientId, currentWeight, height, bodyFat%, goals       | Client fitness data      |
| **ClientIntake**        | clientId, answers[]                                    | Onboarding questionnaire |
| **TrainerClient**       | id, trainerId, clientId, status, startDate, endDate    | Active coaching          |
| **TrainerClientInvite** | id, trainerId, clientId, code, status, expiresAt       | Invitation workflow      |

### Meal Planning

| Table                | Key Fields                                          | Purpose                  |
| -------------------- | --------------------------------------------------- | ------------------------ |
| **MealPlan**         | id, trainerId, clientId, startDate, endDate, status | Meal program             |
| **MealPlanDay**      | id, mealPlanId, dayNumber, totalCalories, macros    | Daily totals             |
| **MealPlanItem**     | id, mealPlanDayId, foodId, servingSize, mealType    | Individual meals         |
| **MealTemplate**     | id, trainerId, name, description                    | Reusable template        |
| **MealTemplateDay**  | id, mealTemplateId, dayNumber                       | Template daily structure |
| **MealTemplateItem** | id, mealTemplateDayId, foodId, servingSize          | Template meals           |
| **MealCompletion**   | id, clientId, mealPlanItemId, timestamp             | Logged meals             |
| **Food**             | id, name, calories, protein, carbs, fats            | Food catalog             |

### Workouts

| Table                   | Key Fields                                         | Purpose                  |
| ----------------------- | -------------------------------------------------- | ------------------------ |
| **Workout**             | id, trainerId, clientId, startDate, endDate, level | Workout program          |
| **WorkoutDay**          | id, workoutId, dayNumber, isRestDay                | Daily structure          |
| **WorkoutItem**         | id, workoutDayId, exerciseId, sets, reps, weight   | Exercises                |
| **WorkoutTemplate**     | id, trainerId, name, level                         | Reusable template        |
| **WorkoutTemplateDay**  | id, workoutTemplateId, dayNumber                   | Template daily structure |
| **WorkoutTemplateItem** | id, workoutTemplateDayId, exerciseId, sets, reps   | Template exercises       |
| **WorkoutCompletion**   | id, clientId, workoutItemId, completedSets[]       | Logged workouts          |
| **Exercise**            | id, name, muscleGroups[], equipment, videoUrl      | Exercise catalog         |

### Messaging

| Table            | Key Fields                                             | Purpose              |
| ---------------- | ------------------------------------------------------ | -------------------- |
| **Conversation** | id, participant1Id, participant2Id, createdAt          | Message thread       |
| **Message**      | id, conversationId, senderId, type, content, timestamp | Messages             |
| **MessageRead**  | id, messageId, userId, readAt                          | Read status per user |

### Progress & Analytics

| Table              | Key Fields                                               | Purpose                |
| ------------------ | -------------------------------------------------------- | ---------------------- |
| **ProgressMetric** | id, clientId, type, value, recordedAt                    | Weight/BF%/muscle data |
| **ActivityLog**    | id, userId, resourceType, actionType, changes, timestamp | Audit trail            |

### Financial

| Table             | Key Fields                                     | Purpose             |
| ----------------- | ---------------------------------------------- | ------------------- |
| **Transaction**   | id, trainerId, amount, type, status, reference | Payment records     |
| **TrainerWallet** | id, trainerId, balance, totalEarned            | Earnings tracker    |
| **Payout**        | id, trainerId, amount, status, initiatedAt     | Withdrawal requests |

---

## Data Flow Examples

### Example 1: Trainer Creates & Client Logs Meal

```
1. Trainer Setup
   Trainer exists in User + TrainerProfile

2. Client Onboarded
   Client exists in User + ClientProfile
   TrainerClient(trainerId, clientId, status=ACTIVE) created

3. Trainer Creates Meal Plan
   POST /meal-plans
   → MealPlan(trainerId, clientId, status=DRAFT)

4. Trainer Populates From Template
   POST /meal-plans/:id/generate
   → Creates MealPlanDay for each template day
   → Creates MealPlanItem for each template item
   → Updates MealPlanDay.totalCalories (sum of items)

5. Trainer Activates Plan
   PATCH /meal-plans/:id
   → MealPlan.status = ACTIVE

6. Client Logs Meal Achievement
   PATCH /meal-plan-items/:id
   → Client marks mealItem as complete

7. System Tracks Adherence
   GET /meal-plans/:id/progress
   → Calculates: logged items / total items
   → Shows macro breakdown vs. target
   → Returns: 80% complete, hit 95g protein target
```

### Example 2: Authorization Check

```
1. Client requests:
   GET /meal-plans/:id
   Header: Authorization: Bearer JWT_TOKEN

2. verifyToken middleware:
   - Extracts JWT
   - Decodes: { id: "client-123", roles: ["CLIENT"] }
   - Checks BlacklistedToken table (not in blacklist)
   - Sets req.user = decoded token + role identity fields

3. Controller:
   - Fetches MealPlan from database
   - Gets user access context
   - Checks: Is clientId in token === MealPlan.clientId?
   - Or: Is trainer in token === MealPlan.trainerId?
   - If no match: 403 Forbidden
   - If match: Return plan data

Result: Client only sees their own plans, trainers see their clients' plans
```

### Example 3: Transaction Flow

```
1. Session completed (trainer-client interaction happened)
2. System records payment
   POST /transactions
   → Transaction(trainerId, amount=100, status=PENDING)

3. Payment processor (Stripe) confirms
   Webhook: /webhooks/stripe
   → Updates Transaction.status = PAID

4. Wallet updated
   → TrainerWallet.balance += 100
   → TrainerWallet.totalEarned += 100

5. Trainer requests payout
   POST /trainer-wallets/:id/withdraw
   → Payout(trainerId, amount=500, status=PENDING)
   → TrainerWallet.balance -= 500 (reserved)

6. Payout processes (Stripe settles in 24-48h)
   Webhook: /webhooks/stripe/payout-completed
   → Payout.status = COMPLETED

Result: Trainer's account credited with $500
```

---

## Constraints & Relationships

### Foreign Keys (Data Integrity)

```
User ──1:many──► UserRole ──many:1──► Role
User ──1:many──► UserPermission ──many:1──► Permission
Role ──many:many──► Permission (via RolePermission)

TrainerProfile.trainerId ──1:1──► User
ClientProfile.clientId ──1:1──► User

TrainerClient.trainerId ──many:1──► User (Trainer)
TrainerClient.clientId ──many:1──► User (Client)

MealPlan.trainerId ──many:1──► User
MealPlan.clientId ──many:1──► User
MealPlan ──1:many──► MealPlanDay ──1:many──► MealPlanItem

MealPlanItem.foodId ──many:1──► Food (catalog reference)

MealCompletion.clientId ──many:1──► User
MealCompletion.mealPlanItemId ──many:1──► MealPlanItem

[Same pattern for Workouts]

Message.conversationId ──many:1──► Conversation
Message.senderId ──many:1──► User
MessageRead.userId ──many:1──► User

ProgressMetric.clientId ──many:1──► User
Transaction.trainerId ──many:1──► User
Payout.trainerId ──many:1──► User
```

### Unique Constraints

```
User.email - unique (prevent duplicate accounts)
Role.name - unique (system-wide role names)
Conversation(participant1Id, participant2Id) - unique (prevent duplicate threads)
```

### Cascade Behavior

```
ON DELETE:
- User deleted → UserRole deleted → (roles kept)
- TrainerClient deleted → MealPlans/Workouts soft-deleted (status=ARCHIVED)
- MealPlan deleted → MealPlanDays/Items cascade deleted
- Message deleted → MessageRead records deleted
```

---

## Queries You'll Use Often

### Get activecoach relationship with client

```sql
SELECT * FROM "TrainerClient"
WHERE trainerId = $1 AND clientId = $2 AND status = 'ACTIVE';
```

### Get client's meal plans

```sql
SELECT mp.* FROM "MealPlan" mp
WHERE mp.clientId = $1
ORDER BY mp.startDate DESC;
```

### Get adherence %

```sql
SELECT
  COUNT(DISTINCT mc.mealPlanItemId) as logged,
  COUNT(DISTINCT mpi.id) as total
FROM "MealPlanItem" mpi
LEFT JOIN "MealCompletion" mc ON mpi.id = mc.mealPlanItemId
WHERE mpi.mealPlanDayId IN (...)
GROUP BY mpi.mealPlanId;
```

### Get trainer earnings (current month)

```sql
SELECT SUM(amount) as earnings
FROM "Transaction"
WHERE trainerId = $1
  AND status = 'PAID'
  AND createdAt >= date_trunc('month', now());
```

### Get unread messages for user

```sql
SELECT COUNT(*) as unread_count
FROM "Message" m
LEFT JOIN "MessageRead" mr ON m.id = mr.messageId AND mr.userId = $1
WHERE m.conversationId = $2 AND mr.id IS NULL;
```

---

## References

- Full schema definition: [prisma/schema.prisma](../prisma/schema.prisma)
- Complex logic explained: [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md)
- Module reference: [MODULES-REFERENCE.md](MODULES-REFERENCE.md)
