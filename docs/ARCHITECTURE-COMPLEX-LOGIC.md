# Complex Logic Documentation

This guide explains the most intricate systems in AthleticaV to help developers understand and extend them.

## Table of Contents

1. [Meal Plan Architecture](#meal-plan-architecture)
2. [Workout Programming](#workout-programming)
3. [RBAC Implementation](#rbac-implementation)
4. [Real-Time Messaging](#real-time-messaging)
5. [Progress Calculation](#progress-calculation)
6. [Transaction Processing](#transaction-processing)

---

## Meal Plan Architecture

### Overview

Meal planning uses a **two-path creation model**:

```
Path 1: From Template (Faster)
├─ Trainer selects meal template
├─ System copies template structure
├─ Auto-populates all days/meals
└─ Done in ~1 second

Path 2: From Scratch (Custom)
├─ Trainer creates empty meal plan
├─ Adds days one by one
├─ Manually selects/creates meals
└─ Takes 5-10 minutes
```

### Data Structure

```
MealPlan (1)
├─ name: "March Bulk Phase"
├─ startDate: 2026-03-01
├─ endDate: 2026-03-31
├─ status: ACTIVE
├─ trainerId
├─ clientId
└─ MealPlanDay[] (30 entries, one per day)
   └─ dayNumber: 1..30
      └─ MealPlanItem[] (meals for this day)
         ├─ mealType: BREAKFAST, LUNCH, DINNER, etc.
         ├─ food: { name, calories, protein, carbs, fats }
         └─ servingSize: number
```

### Key Business Logic

#### 1. Template-Based Creation

**Process:**

```javascript
// User selects meal template → system creates plan
POST /meal-plans
{
  "name": "Client Q2 Plan",
  "startDate": "2026-04-01",
  "templateId": "template-123"
}

// Controller logic:
// 1. Fetch template with all nested days/items
// 2. Create new MealPlan record
// 3. Loop template days → create MealPlanDay for each
// 4. Loop template items → create MealPlanItem for each
// 5. Return new plan with full structure
```

**Why transaction needed:**

- Avoid partial creation (all-or-nothing)
- If item creation fails halfway, entire operation rolls back
- Prevents orphaned days without items

#### 2. Summary Recalculation

When an item is added/removed/updated, daily/weekly totals must update:

```javascript
// After modifying a meal item:
mealItem.servingSize = 2; // Increased portion
await recalcMealPlanSummary(planId);

// Function recalculates:
// - Daily totals (sum all items in day)
// - Weekly averages
// - Macro breakdowns (protein %, carb %, fat %)
```

**Stored in:** `MealPlanDay` fields like `totalCalories`, `totalProtein`, `macroBreakdown`

#### 3. Completion Tracking

Tracks client logging meals vs. plan requirements:

```javascript
// Client logs a meal:
POST /meal-completions
{
  "mealPlanId": "plan-123",
  "mealPlanItemId": "item-456",
  "timestamp": "2026-04-05T08:30:00Z"
}

// Creates MealCompletion record
// System calculates:
// - Items logged / items planned (completion %)
// - Macros hit vs. target
// - Days completed (if all items logged = day done)
```

### Common Operations

**Add new meal to existing plan:**

```bash
POST /meal-plan-items
{
  "mealPlanDayId": "day-123",
  "foodId": "chicken-breast",
  "servingSize": 1.5,
  "mealType": "LUNCH"
}
```

→ Backend auto-recalculates day totals

**Switch meal plan status:**

```bash
PATCH /meal-plans/plan-123
{"status": "ACTIVE"}  # Changes from DRAFT to tracking
```

**Get adherence report:**

```bash
GET /meal-plans/plan-123/progress
# Returns: items logged, macro totals, % complete, recommendations
```

---

## Workout Programming

### Overview

Same template/custom paradigm as meals, but with additional complexity:

- Exercise form (with video URLs for proper form teaching)
- Progressive overload (weight/reps increase over weeks)
- Rest/recovery days
- Multiple difficulty levels (BEGINNER → INTERMEDIATE → ADVANCED)

### Data Structure

```
Workout (1)
├─ name: "8-Week Hypertrophy Block"
├─ startDate: 2026-04-01
├─ endDate: 2026-05-25
├─ durationWeeks: 8
├─ level: INTERMEDIATE
├─ status: ACTIVE
└─ WorkoutDay[] (56 entries, one per day)
   └─ dayNumber: 1..56
      ├─ restDay: false
      └─ WorkoutItem[] (if not rest day)
         ├─ exercise: { name, muscleGroups, equipment }
         ├─ sets: 4
         ├─ reps: 8-10 (range)
         ├─ weight: 225 (lbs)
         ├─ restSeconds: 90
         └─ notes: "Use strict form, no bouncing"
```

### Progressive Overload Implementation

Workouts can specify week-based progression:

```javascript
// Week 1: 225 lbs × 4 sets × 8-10 reps
// Week 3: 235 lbs × 4 sets × 8-10 reps (auto-increase)
// Week 5: 245 lbs × 4 sets × 6-8 reps (lower reps = harder)

// Stored in WorkoutItem:
{
  "progressionWeeks": [1, 3, 5], // When to increase
  "baseWeight": 225,
  "progressionIncrement": 10     // +10 lbs each progression
}
```

### Completion Tracking

Client logs completed sets:

```javascript
POST /workout-completions
{
  "workoutItemId": "item-123",
  "completedSets": [
    { reps: 10, weight: 225, rpe: 7 },  // RPE = Rate of Perceived Exertion
    { reps: 9, weight: 225, rpe: 8 },
    { reps: 8, weight: 225, rpe: 9 },
    { reps: 8, weight: 225, rpe: 9.5 }
  ]
}
```

**System calculates:**

- Estimated 1RM (one-rep max) from RPE data
- Total volume (sets × reps × weight)
- Compliance (prescribed vs. actual)
- Recommendations (increase weight if too easy, reduce if form breaks)

---

## RBAC Implementation

### Overview

Fine-grained permission system with role hierarchy and user-level overrides.

### Layer 1: Role-Based Permissions

Each role has predefined permissions:

```
Role: TRAINER
├─ CREATE-MEAL_PLAN
├─ CREATE-WORKOUT
├─ READ-CLIENT_PROFILE
├─ SEND-MESSAGE
└─ DELETE-SELF

Role: CLIENT
├─ READ-MEAL_PLAN
├─ CREATE-MEAL_COMPLETION
├─ READ-WORKOUT
├─ CREATE-WORKOUT_COMPLETION
├─ SEND-MESSAGE
└─ READ-PROGRESS

Role: ADMIN
└─ ALL (implicit)
```

### Layer 2: User Overrides

Individual users can get extra permissions or have them revoked:

```javascript
// User is CLIENT but grant them "CREATE-CUSTOM_FOOD"
// (to create food items not in database)
POST /user-permissions
{
  "userId": "client-456",
  "permissionId": "CREATE-CUSTOM_FOOD"
}

// Now client can create custom foods even though
// role CLIENT doesn't normally have this
```

### Authorization Flow (Per Request)

```
1. Extract JWT token
   └─ Contains user ID + role names

2. Fetch user access context
   └─ Query UserRole → Role → RolePermission
   └─ Query UserPermission (overrides)
   └─ Build combined permission set

3. Request route requires permission?
   └─ middleware: checkPermission("CREATE-MEAL_PLAN")
   └─ Is permission in user's set?
   └─ Yes → proceed, No → 403 Forbidden

4. Request tries to access specific resource?
   └─ Controller: ensureSameUserOrPrivileged()
   └─ Does resource.ownerId match user.id?
   └─ Or is user ADMIN/OWNER?
   └─ Yes → proceed, No → 403 Forbidden
```

### Key Concepts

**Privileged Roles:** OWNER, ADMIN, DEVELOPER automatically bypass many checks

**Role Identity Fields:** Prevent cross-role access

```javascript
// Trainer viewing meal plan:
// Check: mealPlan.trainerId === req.user.trainerId

// Client viewing meal plan:
// Check: mealPlan.clientId === req.user.clientId
// AND either client is the logged-in user
// OR trainer is logged in with same plan
```

### Example Permission Check

```javascript
// Route middleware:
router.post(
  "/meal-plans",
  verifyToken,
  checkPermission("CREATE-MEAL_PLAN"), // ← Checks role permissions
  mealPlanController.create,
);

// Inside controller (if needed):
const authz = await getUserAccessContext(req);
ensureHasAnyRole(authz, ["TRAINER"], "Only trainers can create meal plans");
```

---

## Real-Time Messaging

### Overview

WebSocket-based conversation system with HTTP fallback for:

- Trainer-client messaging
- Real-time typing indicators
- Read receipt tracking

### Architecture

```
Client (Browser)
├─ Connect WebSocket (authenticated)
├─ Join conversation room (Socket.IO)
├─ Listen for message:new events
└─ Send/receive in real-time

Server (Node.js)
├─ Socket.IO middleware checks JWT
├─ Maintains room with conversation participants
├─ Broadcasts events to room
├─ Fallback: HTTP endpoint for connections that can't upgrade
└─ Tracks read status in MessageRead table
```

### Message Flow

**HTTP Creation:**

```bash
POST /messages
{
  "conversationId": "conv-123",
  "type": "TEXT",
  "content": "How was your workout?"
}
```

**WebSocket Broadcast:**

```javascript
// Server broadcasts to conversation room:
io.to(`conversation-${conversationId}`).emit("message:new", {
  id: "msg-456",
  senderId: "trainer-123",
  senderName: "Coach Bob",
  content: "How was your workout?",
  timestamp: "2026-04-07T14:30:00Z",
});

// All connected clients in room receive event
```

**Read Status Tracking:**

```javascript
// Client opens message:
PATCH / messages / msg - 456 / read;

// Creates MessageRead record
// Later queries show: unreadCount = 0 for this user
```

### Real-Time Indicators

**Typing Indicator:**

```javascript
// Client typing:
socket.emit("user:typing", { conversationId, isTyping: true });

// Server broadcasts within 300ms debounce:
io.to(`conversation-${conversationId}`).emit("user:typing", {
  userId: "trainer-123",
  userName: "Coach Bob",
  isTyping: true,
});
```

**Stops after:**

- User stops typing
- User leaves conversation
- 10 seconds timeout

### Message Types

| Type  | Use Case                   | Storage                            |
| ----- | -------------------------- | ---------------------------------- |
| TEXT  | Regular chat               | content: string                    |
| IMAGE | Photo upload               | content: Cloudinary URL            |
| VIDEO | Form critique video        | content: Cloudinary URL + duration |
| FILE  | Nutrition PDF, workout doc | content: Cloudinary URL + filename |

---

## Progress Calculation

### Overview

Tracks client fitness metrics and derives progress statistics.

### Metric Types

```
ProgressMetric {
  type: WEIGHT | BODY_FAT | MUSCLE,
  value: number,
  unit: "lbs" | "%",
  recordedAt: date,
  clientId: uuid,
  notes: string
}
```

### Progress Summary Calculation

```javascript
GET /progress-summary?clientId=client-123

// Returns:
{
  metrics: {
    weight: {
      current: 185,
      initial: 210,
      change: -25,
      trend: "down" // Last 7 days trend
    },
    bodyFat: {
      current: 22,
      initial: 28,
      change: -6,
      trend: "down"
    },
    muscle: {
      current: 160,
      initial: 155,
      change: +5,
      trend: "up"
    }
  },
  periodMetrics: {
    weightLossPerWeek: 1.2,  // lbs/week
    bodyFatReduction: 0.2,   // % per week
    musclePlateauWeek: 4     // Week they plateaued
  },
  recommendations: [
    "Weight loss slowing - increase deficit or cardio",
    "Great muscle retention during cut - keep training hard"
  ]
}
```

### Trend Calculation

Over configurable windows (7, 14, 30 days):

```javascript
// Get metrics in window
const week = await prisma.progressMetric.findMany({
  where: {
    clientId,
    recordedAt: { gte: dateSevenDaysAgo },
  },
  orderBy: { recordedAt: "asc" },
});

// Linear regression to determine trend
const slope = calculateLinearRegression(week);
const trend = slope < -0.5 ? "down" : slope > 0.5 ? "up" : "stable";
```

---

## Transaction Processing

### Overview

Financial transactions with multi-step settlement process.

### Transaction States

```
PENDING → PAID / FAILED
  ↓
Webhook from payment processor confirms status
```

### Wallet Balance Logic

```javascript
// Session with Client = $50 charge
POST /transactions
{
  "trainerId": "trainer-123",
  "amount": 50,
  "type": "PAYMENT",
  "status": "PENDING",
  "reference": "stripe_charge_123"
}

// When webhook received (Stripe confirms):
PATCH /transactions/trans-456
{"status": "PAID"}

// Triggers:
// 1. Update TrainerWallet.balance += 50
// 2. Update TrainerWallet.totalEarned += 50
// 3. Log earnings in ActivityLog

// If refund needed:
PATCH /transactions/trans-456
{"status": "FAILED", "refundReason": "Client dispute"}

// Triggers:
// 1. Update TrainerWallet.balance -= 50
// 2. Create negative transaction for refund
// 3. Mark original as FAILED
```

### Payout Processing

```javascript
// Trainer requests withdrawal:
POST /trainer-wallets/wallet-123/withdraw
{"amount": 500, "payoutMethod": "stripe"}

// Creates Payout record:
{
  id: "payout-789",
  trainerId: "trainer-123",
  amount: 500,
  status: "PENDING",  // Stripe processing
  initiatedAt: "2026-04-07T14:00:00Z",
  completedAt: null
}

// After 24-48 hours (Stripe settles):
// Webhook updates: Payout.status = "COMPLETED"
// Wallet.balance reduced, transaction logged
```

### Safeguards

1. **Balance Check Before Withdrawal:**

   ```javascript
   if (amount > wallet.balance) {
     throw new AppError("Insufficient balance", 400);
   }
   ```

2. **Minimum Withdrawal:**

   ```javascript
   const MIN_PAYOUT = 20; // $20 minimum
   if (amount < MIN_PAYOUT) {
     throw new AppError("Minimum withdrawal is $20", 400);
   }
   ```

3. **Duplicate Prevention:**
   - Each transaction has unique `reference` from payment processor
   - Webhook idempotency: if same reference received twice, skip

4. **Audit Trail:**
   - All transactions logged in ActivityLog
   - Reasons tracked for refunds/failures
   - Trainer can dispute within 90 days

---

## References

- [Prisma Schema](../prisma/schema.prisma)
- [Meal Plan Controller](../controllers/mealPlan.js)
- [Workout Controller](../controllers/workout.js)
- [Authorization Utilities](../utils/authz.js)
- [WebSocket Setup](../utils/websocket.js)
- [Progress Utilities](../utils/mealPlanProgress.js)
