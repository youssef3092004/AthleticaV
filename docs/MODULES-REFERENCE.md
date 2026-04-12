# API Modules Reference

Quick lookup table for all API controllers and routes. Each row links to the implementation.

## User & Authentication Management

| Module               | Route                                                   | Controller                                                        | Purpose                                                                 |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Auth**             | [routes/auth.js](../routes/auth.js)                     | [controllers/auth.js](../controllers/auth.js)                     | User registration (client/trainer/admin), login, logout, password reset |
| **Users**            | [routes/user.js](../routes/user.js)                     | [controllers/user.js](../controllers/user.js)                     | User profile management, role lookup                                    |
| **Roles**            | [routes/role.js](../routes/role.js)                     | [controllers/role.js](../controllers/role.js)                     | System role definitions (TRAINER, CLIENT, ADMIN, etc.)                  |
| **Permissions**      | [routes/permission.js](../routes/permission.js)         | [controllers/permission.js](../controllers/permission.js)         | Available permissions in system                                         |
| **Role Permissions** | [routes/rolePermission.js](../routes/rolePermission.js) | [controllers/rolePermission.js](../controllers/rolePermission.js) | Assign permissions to roles                                             |
| **User Permissions** | [routes/userPermission.js](../routes/userPermission.js) | [controllers/userPermission.js](../controllers/userPermission.js) | Override permissions for specific users                                 |

**Key Concept:** Role → Permission assignment happens once at system level. User permission overrides are exceptions. See [RBAC documentation](ARCHITECTURE-COMPLEX-LOGIC.md#rbac-implementation) for flow.

---

## Trainer Management

| Module                          | Route                                                             | Controller                                                                  | Purpose                                                                |
| ------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Trainer Profile**             | [routes/trainerProfile.js](../routes/trainerProfile.js)           | [controllers/trainerProfile.js](../controllers/trainerProfile.js)           | Trainer bio, specializations, hourly rates, experience level           |
| **Trainer Wallet**              | [routes/trainerWallet.js](../routes/trainerWallet.js)             | [controllers/trainerWallet.js](../controllers/trainerWallet.js)             | Earnings balance, payout history, withdrawal requests                  |
| **Trainer-Client Relationship** | [routes/trainerClient.js](../routes/trainerClient.js)             | [controllers/trainerClient.js](../controllers/trainerClient.js)             | Active coaching relationships, status management (ACTIVE/PAUSED/ENDED) |
| **Trainer-Client Invite**       | [routes/trainerClientInvite.js](../routes/trainerClientInvite.js) | [controllers/trainerClientInvite.js](../controllers/trainerClientInvite.js) | Invite code generation, invitation acceptance, expiration handling     |

**Flow:** Trainer creates invite → Client accepts → TrainerClient record created → Coach can now create programs for client

---

## Client Management

| Module             | Route                                                 | Controller                                                      | Purpose                                                                       |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Client Profile** | [routes/clientProfile.js](../routes/clientProfile.js) | [controllers/clientProfile.js](../controllers/clientProfile.js) | Exercise level, health metrics (weight, height, body fat %), injury history   |
| **Client Intake**  | [routes/clientIntake.js](../routes/clientIntake.js)   | [controllers/clientIntake.js](../controllers/clientIntake.js)   | Questionnaire responses (goals, availability, diet preferences, medical info) |

**Usage:** Populated during onboarding to personalize coaching recommendations.

---

## Meal Planning System

| Module                  | Route                                                       | Controller                                                            | Purpose                                                                                 |
| ----------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Meal Plans**          | [routes/mealPlan.js](../routes/mealPlan.js)                 | [controllers/mealPlan.js](../controllers/mealPlan.js)                 | Create/update meal plans, status management (DRAFT→ACTIVE→COMPLETED), progress tracking |
| **Meal Templates**      | [routes/mealTemplate.js](../routes/mealTemplate.js)         | [controllers/mealTemplate.js](../controllers/mealTemplate.js)         | Reusable meal plan templates, predefined sequences                                      |
| **Meal Plan Days**      | [routes/mealPlanDay.js](../routes/mealPlanDay.js)           | [controllers/mealPlanDay.js](../controllers/mealPlanDay.js)           | Daily meal structure within plan (aggregates day totals: calories, macros)              |
| **Meal Plan Items**     | [routes/mealPlanItem.js](../routes/mealPlanItem.js)         | [controllers/mealPlanItem.js](../controllers/mealPlanItem.js)         | Individual meals within a day, triggers daily total recalculation                       |
| **Meal Template Days**  | [routes/mealTemplateDay.js](../routes/mealTemplateDay.js)   | [controllers/mealTemplateDay.js](../controllers/mealTemplateDay.js)   | Template day structure                                                                  |
| **Meal Template Items** | [routes/mealTemplateItem.js](../routes/mealTemplateItem.js) | [controllers/mealTemplateItem.js](../controllers/mealTemplateItem.js) | Template meal items                                                                     |
| **Meal Completions**    | [routes/mealCompletion.js](../routes/mealCompletion.js)     | [controllers/mealCompletion.js](../controllers/mealCompletion.js)     | Client logs meals eaten, tracks adherence % and macro accuracy                          |
| **Foods**               | [routes/food.js](../routes/food.js)                         | [controllers/food.js](../controllers/food.js)                         | Food database catalog (nutrition facts searchable by macros/calories)                   |

**Creation Paths:**

1. **From Template:** Select template → auto-populate full plan structure (fast)
2. **From Scratch:** Create plan → manually add days → add items to each day (custom)

**See:** [Meal Planning Documentation](ARCHITECTURE-COMPLEX-LOGIC.md#meal-plan-architecture)

---

## Workout Programming System

| Module                     | Route                                                             | Controller                                                                  | Purpose                                                                            |
| -------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Workouts**               | [routes/workout.js](../routes/workout.js)                         | [controllers/workout.js](../controllers/workout.js)                         | Create/update workout programs, difficulty levels (BEGINNER/INTERMEDIATE/ADVANCED) |
| **Workout Templates**      | [routes/workoutTemplate.js](../routes/workoutTemplate.js)         | [controllers/workoutTemplate.js](../controllers/workoutTemplate.js)         | Reusable workout templates (8-week programs, periodization blocks)                 |
| **Workout Days**           | [routes/workoutDay.js](../routes/workoutDay.js)                   | [controllers/workoutDay.js](../controllers/workoutDay.js)                   | Daily workout structure (rest days, training days with exercises)                  |
| **Workout Items**          | [routes/workoutItem.js](../routes/workoutItem.js)                 | [controllers/workoutItem.js](../controllers/workoutItem.js)                 | Individual exercises with sets, reps, weight, progressive overload rules           |
| **Workout Template Days**  | [routes/workoutTemplateDay.js](../routes/workoutTemplateDay.js)   | [controllers/workoutTemplateDay.js](../controllers/workoutTemplateDay.js)   | Template day structure                                                             |
| **Workout Template Items** | [routes/workoutTemplateItem.js](../routes/workoutTemplateItem.js) | [controllers/workoutTemplateItem.js](../controllers/workoutTemplateItem.js) | Template exercise items                                                            |
| **Workout Completions**    | [routes/workoutCompletion.js](../routes/workoutCompletion.js)     | [controllers/workoutCompletion.js](../controllers/workoutCompletion.js)     | Client logs exercise performance (reps, weight, RPE), tracks compliance            |
| **Exercises**              | [routes/exercise.js](../routes/exercise.js)                       | [controllers/exercise.js](../controllers/exercise.js)                       | Exercise database catalog (muscle groups, equipment, form videos)                  |

**Creation Paths:** Identical to meal planning (template or from scratch)

**Advanced Features:**

- Progressive overload (auto-increase weight/reduce reps over weeks)
- RPE tracking (Rate of Perceived Exertion) for load management
- Exercise substitutions (swap exercises but keep same muscle groups)

**See:** [Workout Documentation](ARCHITECTURE-COMPLEX-LOGIC.md#workout-programming)

---

## Messaging & Communication

| Module            | Route                                               | Controller                                                    | Purpose                                              |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| **Conversations** | [routes/conversation.js](../routes/conversation.js) | [controllers/conversation.js](../controllers/conversation.js) | Conversation threads between trainer-client pairs    |
| **Messages**      | [routes/message.js](../routes/message.js)           | [controllers/message.js](../controllers/message.js)           | Text/image/video/file messages, read status tracking |

**Real-Time Support:** Messages broadcast via WebSocket (Socket.IO) for instant delivery. HTTP fallback for clients that can't upgrade.

**See:** [Messaging Documentation](ARCHITECTURE-COMPLEX-LOGIC.md#real-time-messaging) | [WebSocket Implementation](../utils/websocket.js)

---

## Progress & Analytics

| Module               | Route                                             | Controller                                                  | Purpose                                                               |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| **Progress Metrics** | [routes/progress.js](../routes/progress.js)       | [controllers/progress.js](../controllers/progress.js)       | Track weight, body fat %, muscle %, derive trends and recommendations |
| **Activity Logs**    | [routes/activityLog.js](../routes/activityLog.js) | [controllers/activityLog.js](../controllers/activityLog.js) | Audit trail of all CRUD operations (who did what, when)               |

**Calculated Metrics:** Weight loss rate, muscle retention %, body comp change, plateau detection

**See:** [Progress Calculation](ARCHITECTURE-COMPLEX-LOGIC.md#progress-calculation)

---

## Payments & Financials

| Module           | Route                                             | Controller                                                  | Purpose                                                                        |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Transactions** | [routes/transaction.js](../routes/transaction.js) | [controllers/transaction.js](../controllers/transaction.js) | Record payments, refunds, withdrawals; settlement status (PENDING/PAID/FAILED) |
| **Payouts**      | [routes/payout.js](../routes/payout.js)           | [controllers/payout.js](../controllers/payout.js)           | Trainer withdrawal requests and processing (linked to Stripe)                  |

**Flow:** Session charge → Transaction created (PENDING) → Stripe webhook confirms → balance updated

**See:** [Transaction Processing](ARCHITECTURE-COMPLEX-LOGIC.md#transaction-processing)

---

## Summary Table: All Modules

**Total: 36 controllers handling 40+ API routes**

```
User Management:      6 modules
Trainer Systems:      4 modules
Client Systems:       2 modules
Meal Planning:        8 modules
Workout Systems:      8 modules
Messaging:            2 modules
Progress/Analytics:   2 modules
Payments:             2 modules
─────────────────────────────────
TOTAL:               36 modules
```

---

## Module Dependency Graph

```
Auth (Foundation)
├─ All routes require verifyToken
│
├─ User/Role/Permission (Authorization Core)
│  └─ Required by checkPermission() middleware
│
├─ Client/Trainer Profiles (User Extensions)
│
├─ Trainer-Client (Coaching Relationship)
│  ├─ Enables Meal/Workout creation for this relationship
│  ├─ Required before Messaging
│  └─ Enables Progress tracking
│
├─ Meal Planning (CRUD Pipeline)
│  ├─ MealPlan → MealPlanDay → MealPlanItem
│  ├─ Template → Item relationships
│  ├─ Food catalog dependency
│  └─ MealCompletion tracks adherence
│
├─ Workout Programming (CRUD Pipeline)
│  ├─ Workout → WorkoutDay → WorkoutItem
│  ├─ Template → Item relationships
│  ├─ Exercise catalog dependency
│  └─ WorkoutCompletion tracks compliance
│
├─ Messaging (Trainer-Client Communication)
│  ├─ Requires active TrainerClient relationship
│  └─ Real-time via WebSocket
│
├─ Progress Tracking (Analytics)
│  └─ Aggregates MealCompletion + WorkoutCompletion data
│
└─ Payments (Financial)
   └─ Links to TrainerWallet, Transactions, Sessions
```

---

## Quick Access by Feature

### "I need to implement X"

**Client Signup:** [auth.js](../controllers/auth.js#L50) → clientRegister()  
**Trainer creates meal plan:** [mealPlan.js](../controllers/mealPlan.js#L150) → create()  
**Client logs workout:** [workoutCompletion.js](../controllers/workoutCompletion.js#L50) → recordCompletion()  
**Send message:** [message.js](../controllers/message.js#L40) → sendMessage()  
**Record payment:** [transaction.js](../controllers/transaction.js#L30) → createTransaction()  
**Request payout:** [trainerWallet.js](../controllers/trainerWallet.js#L120) → requestWithdrawal()  
**Check permissions:** [authz.js](../utils/authz.js#L50) → getUserAccessContext()

---

## References

- **Main README:** [README.md](../README.md)
- **Complex Logic Deep Dives:** [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md)
- **Prisma Schema:** [prisma/schema.prisma](../prisma/schema.prisma)
- **Middleware Stack:** [middleware/](../middleware/)
- **Utilities:** [utils/](../utils/)
