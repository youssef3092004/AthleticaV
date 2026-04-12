# AthleticaV - Fitness Coaching Platform API

A comprehensive REST API for managing fitness coaching relationships, meal planning, workout programming, and client-trainer interactions. Built with Node.js, Express, PostgreSQL, and Prisma.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Core Modules](#core-modules)
- [Authentication & Authorization](#authentication--authorization)
- [Complex Logic Documentation](#complex-logic-documentation)
- [Database Schema](#database-schema)
- [API Testing](#api-testing)
- [Development](#development)

---

## Overview

AthleticaV is a multi-tenant fitness platform supporting several user roles:

- **Trainers**: Create and manage workout plans, meal plans, and client relationships
- **Clients**: Receive coaching, log meals and workouts, track progress
- **Admins**: Manage system-level settings and user permissions
- **Developers**: Integrate external tools via API
- **Support**: Assist users with platform issues

**Key Features:**

- 🏋️ Workout templating and programming
- 🍽️ Meal plan creation and tracking
- 💬 Real-time messaging (WebSocket support)
- 📊 Progress tracking with metrics
- 💳 Payment and wallet management
- 📝 Client intake questionnaires
- 🔐 Role-Based Access Control (RBAC)

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Configure Environment**

   Create `.env.local` for development:

   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/athleticav
   JWT_SECRET=your-secret-key
   NODE_ENV=development
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=600
   ```

3. **Setup Database**

   ```bash
   # Run migrations on development database
   npm run prisma:dev:migrate

   # Seed with sample data
   npm run seed:all
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

   Server runs on `http://localhost:3000`

---

## Architecture

### Request Flow

```
Client Request
    ↓
[Middleware] Security & Validation (auth, CORS, XSS protection)
    ↓
[Routes] Thin routing layer → Controller mapping
    ↓
[Controllers] Business logic, authorization checks, Prisma calls
    ↓
[Database] PostgreSQL with Prisma ORM
    ↓
Response
```

### Key Design Principles

- **Separation of Concerns**: Routes handle HTTP contract, controllers handle logic
- **Explicit Authorization**: Permission checks in routes + role/ownership checks in controllers
- **Minimal Selects**: Prisma queries return only required fields
- **Transaction Safety**: Multi-step writes use `prisma.$transaction`
- **Error Handling**: Unified error responses via [AppError](utils/appError.js)

### Middleware Stack

| Middleware                                       | Purpose                               | Location            |
| ------------------------------------------------ | ------------------------------------- | ------------------- |
| [verifyToken](middleware/auth.js)                | JWT authentication                    | Protected routes    |
| [checkPermission](middleware/checkPermission.js) | Route-level permission validation     | Sensitive endpoints |
| [checkOwnership](middleware/checkOwnership.js)   | Resource ownership verification       | Data access routes  |
| [errorHandler](middleware/errorHandler.js)       | Centralized error response formatting | App level           |
| [resourceAccess](middleware/resourceAccess.js)   | Dynamic resource access control       | Cross-cutting       |

---

## Core Modules

### 1. Authentication & Users

**Files:** [routes/auth.js](routes/auth.js) | [controllers/auth.js](controllers/auth.js)

Handles user registration and login across multiple roles. JWT tokens expire after 24 hours. Tokens can be blacklisted via logout to prevent reuse.

- `POST /auth/register/client` - Client self-registration
- `POST /auth/register/trainer` - Trainer self-registration
- `POST /auth/register/admin` - System admin registration (requires admin role)
- `POST /auth/login` - Authenticate and receive JWT
- `POST /auth/logout` - Invalidate token (add to blacklist)
- `PATCH /auth/resetPassword` - Change password for authenticated user

### 2. User Management

**Files:** [routes/user.js](routes/user.js) | [controllers/user.js](controllers/user.js)

Manage user profiles, preferences, and role assignments. Users can have multiple roles.

- `GET /users/:id` - Get user profile with roles
- `PATCH /users/:id` - Update profile information
- `DELETE /users/:id` - Delete account (cascades to related data)
- `GET /users/:id/roles` - List user's assigned roles

### 3. Trainer Profile & Wallet

**Files:** [routes/trainerProfile.js](routes/trainerProfile.js) | [controllers/trainerProfile.js](controllers/trainerProfile.js)

Trainer-specific profiles including specializations and experience. Separate wallet for managing payouts.

**Complex Logic:** [See Wallet & Payout System](#wallet--payout-system)

- `GET /trainer-profiles/:id` - Retrieve trainer details
- `PATCH /trainer-profiles/:id` - Update bio, specializations, hourly rate
- `GET /trainer-wallets/:trainerId` - View wallet balance and transactions
- `POST /trainer-wallets/:trainerId/withdraw` - Request payout

### 4. Trainer-Client Relationships

**Files:** [routes/trainerClient.js](routes/trainerClient.js) | [controllers/trainerClient.js](controllers/trainerClient.js) | [TrainerClientInvite](routes/trainerClientInvite.js)

Manages the coaching relationship lifecycle: invitation → acceptance → active coaching → completion.

**Complex Logic:** [See Trainer-Client Relationship Flow](#trainer-client-relationship-flow)

- `POST /trainer-clients` - Trainer invites client to coaching relationship
- `GET /trainer-clients` - List all coaching relationships
- `PATCH /trainer-clients/:id/status` - Update relationship status (ACTIVE, PAUSED, ENDED)
- `POST /trainer-clients/:id/complete` - Mark relationship as completed

### 5. Client Profiles & Intake

**Files:** [routes/clientProfile.js](routes/clientProfile.js) | [controllers/clientProfile.js](controllers/clientProfile.js)  
[routes/clientIntake.js](routes/clientIntake.js) | [controllers/clientIntake.js](controllers/clientIntake.js)

Client health info, goals, and intake questionnaire responses. Used to personalize coaching.

- `GET /client-profiles/:id` - Get client fitness profile
- `PATCH /client-profiles/:id` - Update health metrics (weight, height, body fat %)
- `POST /client-intake` - Submit intake form responses
- `GET /client-intake/:clientId` - Retrieve intake answers

### 6. Meal Planning System

**Files:** [controllers/mealPlan.js](controllers/mealPlan.js) | [controllers/mealTemplate.js](controllers/mealTemplate.js) | [controllers/mealPlanItem.js](controllers/mealPlanItem.js)

**Routes:** [meal-related routes](routes/)

Comprehensive meal planning with two patterns: templated plans (faster) and custom plans.

**Complex Logic:** [See Meal Planning Architecture](#meal-planning-architecture)

**Key Endpoints:**

- `POST /meal-plans` - Create new meal plan
- `PATCH /meal-plans/:id` - Update plan (name, dates, status)
- `GET /meal-plans/:id/progress` - View adherence/completion data
- `POST /meal-templates` - Create reusable meal templates
- `POST /meal-plans/:id/generate-from-template` - Create plan from template
- `POST /meal-completions` - Log meal completion

### 7. Workout Programming

**Files:** [controllers/workout.js](controllers/workout.js) | [controllers/workoutTemplate.js](controllers/workoutTemplate.js) | [controllers/workoutItem.js](controllers/workoutItem.js)

Similar templating pattern to meal planning. Create reusable templates and assign to clients.

**Complex Logic:** [See Workout Management](#workout-management)

**Key Endpoints:**

- `POST /workouts` - Create workout program
- `PATCH /workouts/:id` - Update program details
- `POST /workout-templates` - Create reusable template
- `POST /workouts/:id/generate-from-template` - Create workout from template
- `POST /workout-completions` - Log workout completion

### 8. Real-Time Messaging

**Files:** [routes/message.js](routes/message.js) | [controllers/message.js](controllers/message.js) | [utils/websocket.js](utils/websocket.js)

Trainer-client messaging with real-time updates via WebSocket (Socket.IO).

**Complex Logic:** [See Real-Time Messaging Architecture](#real-time-messaging)

- `POST /messages` - Send message (text, image, video, file)
- `GET /conversations/:id/messages` - Get conversation history
- `PATCH /messages/:id/read` - Mark message as read
- WebSocket event: `message:new` - Real-time message delivery

### 9. Progress Tracking

**Files:** [routes/progress.js](routes/progress.js) | [controllers/progress.js](controllers/progress.js) | [utils/workoutProgress.js](utils/workoutProgress.js) | [utils/mealPlanProgress.js](utils/mealPlanProgress.js)

Tracks client progress across workouts and meal plans via metrics (weight, body fat, muscle).

- `POST /progress-metrics` - Log progress (weight, body fat %, muscle %)
- `GET /progress-metrics` - Retrieve metrics over date range
- `GET /progress-summary` - Get overall progress statistics

### 10. Permissions & Access Control

**Files:** [routes/rolePermission.js](routes/rolePermission.js) | [controllers/rolePermission.js](controllers/rolePermission.js)  
[routes/userPermission.js](routes/userPermission.js) | [controllers/userPermission.js](controllers/userPermission.js)

Granular permission management via two layers:

1. **Role-based**: Permissions tied to roles (TRAINER, CLIENT, etc.)
2. **User-specific**: Override permissions on individual users

**Complex Logic:** [See RBAC System](#role-based-access-control--rbac)

- `GET /roles` - List all system roles
- `POST /role-permissions` - Assign permission to role
- `DELETE /role-permissions/:id` - Revoke role permission
- `POST /user-permissions` - Assign permission to specific user

### 11. Activity Logging

**Files:** [routes/activityLog.js](routes/activityLog.js) | [controllers/activityLog.js](controllers/activityLog.js)

Automatic audit trail of CRUD operations for compliance and debugging.

- `GET /activity-logs` - View activity with filters (user, resource type, date)
- Log entries include: timestamp, user, action, resource, changes

### 12. Transactions & Payments

**Files:** [routes/transaction.js](routes/transaction.js) | [controllers/transaction.js](controllers/transaction.js)

Track financial transactions (payments, refunds, transfers).

**Complex Logic:** [See Payment & Wallet System](#wallet--payout-system)

- `GET /transactions` - View transaction history
- `POST /transactions` - Record transaction
- `PATCH /transactions/:id/status` - Update status (PENDING → PAID/FAILED)

### 13. Inventory Management

**Files:** [routes/exercise.js](routes/exercise.js) | [controllers/exercise.js](controllers/exercise.js)  
[routes/food.js](routes/food.js) | [controllers/food.js](controllers/food.js)

Exercise and food database catalogs used in templates and plans.

- `GET /exercises` - Search exercise catalog (filter by muscle group, equipment)
- `POST /exercises` - Add custom exercise
- `GET /foods` - Search food database (filter by calories, macros)
- `POST /foods` - Add custom food

---

## Authentication & Authorization

### JWT Token Structure

Tokens include user ID, roles, and identity context flags:

```json
{
  "id": "user-123",
  "roles": ["TRAINER", "DEVELOPER"],
  "trainerId": "user-123",
  "developerId": "user-123",
  "clientId": null,
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Role Identity Context

Each role maps to a unique ID field to prevent cross-role data access:

| Role      | Field       | Purpose                    |
| --------- | ----------- | -------------------------- |
| TRAINER   | trainerId   | Identify trainer resources |
| CLIENT    | clientId    | Identify client resources  |
| ADMIN     | adminId     | System management          |
| DEVELOPER | developerId | External integrations      |
| OWNER     | ownerId     | Full platform access       |
| SUPPORT   | supportId   | Support tickets            |

**Why it matters:** When checking if a trainer can access a meal plan, we verify the plan's `trainerId` matches the requesting user's `trainerId` from their token identity.

See [authz.js utilities](utils/authz.js) for implementation.

### Permission String Format

Permissions are action-resource pairs: `<ACTION>-<RESOURCE>`

Examples:

- `CREATE-MEAL_PLAN` - Can create meal plans
- `DELETE-USER` - Can delete users
- `MANAGE-ROLES` - Can assign roles

Mapped in [configs/rbac.js](configs/rbac.js) and checked via middleware.

---

## Complex Logic Documentation

### Meal Planning Architecture

**Overview:** Two-tier system for meal plan creation:

1. **From Template**: Select pre-built template → auto-populate all meals/items
2. **From Scratch**: Define meals day-by-day → add items manually

**Key Functions:**

- [createMealPlanFromTemplate()](controllers/mealPlan.js#L150-L200) - Auto-generate plan from template structure
- [recalcMealPlanSummary()](utils/mealPlanProgress.js) - Recalculate macro totals when items change
- Meal plan status flow: DRAFT → ACTIVE → COMPLETED or ARCHIVED

**Why Complex:**

- Templates have nested structure (Plan → Days → Items)
- Updating items must recalculate daily/weekly summaries
- Need to track completion % (logs vs. scheduled meals)

**See Also:** [Meal Plan Related Routes](routes/#L1) for API examples

---

### Workout Management

**Overview:** Identical pattern to meal planning—templates + custom workouts.

**Key Difference from Meals:**

- Workouts include exercise form videos and progression tracking
- Support multiple difficulty levels (BEGINNER, INTERMEDIATE, ADVANCED)
- Rest days are optional with custom notes

**Key Functions:**

- [createWorkoutFromTemplate()](controllers/workout.js) - Generate workout program
- [calculateWorkoutProgress()](utils/workoutProgress.js) - Track sets completed vs. prescribed
- Status flow: DRAFT → ACTIVE → COMPLETED or PAUSED

**See Also:** [Workout Routes](routes/workout.js)

---

### Trainer-Client Relationship Flow

**Overview:** Multi-step process for coaching engagement:

```
1. Trainer invites client (generates invite code)
2. Client accepts invite → creates TrainerClient record
3. Coach creates meal/workout plans for client
4. Client logs meals & workouts
5. Trainer provides feedback
6. Relationship ends (ENDED or completed)
```

**Key Statuses:**

- **ACTIVE**: Coaching actively happening
- **PAUSED**: Temporary break (trainer or client can pause)
- **ENDED**: Coaching finished (by either party)

**Important:** When relationship ends, historical plans remain but trainer loses real-time access to client future data.

**See Also:** [trainerClientInvite Controller](controllers/trainerClientInvite.js)

---

### Real-Time Messaging

**Overview:** WebSocket-based messaging system with Socket.IO.

**Flow:**

1. Client connects socket (authenticated via JWT)
2. User joins conversation room
3. Messages sent via HTTP endpoint OR WebSocket event
4. Server broadcasts to all conversation participants
5. Clients receive real-time `message:new` event

**Key Events:**

- `message:new` - New message received
- `user:typing` - User is typing indicator
- `user:disconnect` - User left conversation

**Message Types:** TEXT, IMAGE, VIDEO, FILE

**Why Complex:**

- Must handle HTTP fallback (if WebSocket fails)
- Maintain message order across concurrent sends
- Track read/unread status per user

**See Also:** [websocket.js](utils/websocket.js#L1-L50)

---

### Role-Based Access Control (RBAC)

**Overview:** Two-layer permission system:

1. **Role Layer**: Permissions assigned to roles at system level
2. **User Layer**: Override permissions on specific users

**Implementation:**

- [Permission table](prisma/schema.prisma) - Define all available permissions
- [RolePermission](prisma/schema.prisma) - Map permissions to roles
- [UserPermission](prisma/schema.prisma) - User-specific overrides

**Authorization Flow:**

```javascript
1. Extract user roles from JWT
2. Fetch role permissions from DB
3. Apply user-specific permission overrides
4. Check if requested action is in permission set
5. Allow or deny
```

**Key Concept:** Role changes are immediate—no token refresh needed. Token contains role names; lookup happens on each request.

**See Also:** [authz.js](utils/authz.js#L30-L80) for `getUserAccessContext()` implementation

---

### Wallet & Payout System

**Overview:** Trainer earnings tracked in separate Wallet record.

**Flow:**

```
1. Payment received → creates Transaction
2. Transaction linked to Workout/Meal session
3. Amount added to trainer's Wallet balance
4. Trainer requests withdrawal
5. Withdrawal processed → creates Payout transaction
```

**Key Fields:**

- `Wallet.balance` - Current available funds
- `Wallet.totalEarned` - Lifetime earnings
- `Transaction.type` - "PAYMENT" | "REFUND" | "WITHDRAWAL"
- `Transaction.status` - "PENDING" | "PAID" | "FAILED"

**Why Complex:**

- Handle refunds (reverse balance)
- Ensure balance never goes negative
- Track payout processing time/status
- Reconcile with external payment processor

**See Also:** [trainerWallet Controller](controllers/trainerWallet.js)

---

### Client Intake Questionnaire

**Overview:** Structured intake form capturing client goals, constraints, and preferences.

**Question Categories:**

- Health info (weight, height, medical conditions)
- Activity level and commitments
- Dietary preferences and restrictions
- Fitness goals and motivation
- Previous program experience
- Timeline/deadlines

**Storage:** Responses stored as key-value pairs mapped to `IntakeQuestionKey` enum.

**Why Complex:**

- Questions are conditional (skip based on answers)
- Answers inform coach recommendations
- Need audit trail of changes
- Support multiple interview sessions (not all questions answered at once)

**See Also:** [clientIntake Controller](controllers/clientIntake.js)

---

## Database Schema

### Core Entities

**User & Authentication**

- `User` - Base user account (email, password hash)
- `Role` - System roles (TRAINER, CLIENT, ADMIN, etc.)
- `UserRole` - Links users to roles (many-to-many)
- `BlacklistedToken` - Logout tracking
- `Permission` - Granular access permissions
- `RolePermission` - Role → Permission mapping
- `UserPermission` - User-specific permission overrides

**Profiles**

- `TrainerProfile` - Trainer specializations, bio, hourly rate
- `ClientProfile` - Client fitness metrics, goals, health info
- `ClientIntake` - Intake questionnaire responses

**Coaching Relationships**

- `TrainerClient` - Active coaching engagement
- `TrainerClientInvite` - Invitation workflow (pending, accepted, expired)

**Meal Planning**

- `MealPlan` - Coaching meal plan program
- `MealPlanDay` - Daily meals within plan
- `MealPlanItem` - Individual meal entry
- `MealTemplate` - Reusable template structure
- `MealTemplateDay` - Template daily structure
- `MealTemplateItem` - Template meal item
- `MealCompletion` - Client logged meal
- `Food` - Food database catalog

**Workouts**

- `Workout` - Coaching workout program
- `WorkoutDay` - Daily workout within program
- `WorkoutItem` - Individual exercise entry
- `WorkoutTemplate` - Reusable template structure
- `WorkoutTemplateDay` - Template daily structure
- `WorkoutTemplateItem` - Template exercise item
- `WorkoutCompletion` - Client logged workout
- `Exercise` - Exercise database catalog

**Messaging**

- `Conversation` - Message thread (trainer ↔ client)
- `Message` - Individual message
- `MessageRead` - Track read status per user

**Progress & Analytics**

- `ProgressMetric` - Client metrics (weight, body fat, muscle %)
- `ActivityLog` - Audit trail (CRUD operations)

**Financials**

- `Transaction` - Payment records
- `TrainerWallet` - Trainer funds tracker
- `Payout` - Withdrawal requests

**See full schema:** [prisma/schema.prisma](prisma/schema.prisma)

---

## API Testing

### Postman Collection

Import Postman collection for testing all endpoints:

- [Messaging API Collection](docs/Athletica-Messaging-API.postman_collection.json)

### Manual Testing Endpoints

**HTML Test Clients:**

- [Trainer Messaging Test](docs/trainer-messaging-test.html)
- [Client Messaging Test](docs/client-messaging-test.html)

### Quick Test Commands

```bash
# Login and get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"trainer@example.com","password":"password123"}'

# Use token in Authorization header
curl -X GET http://localhost:3000/trainer-profiles/user-id \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**See:** [TESTING-QUICK-START.md](docs/TESTING-QUICK-START.md) for comprehensive guide

---

## Development

### NPM Scripts

```bash
# Development
npm run dev                    # Start with nodemon (hot reload)
npm start                      # Production server

# Database
npm run prisma:dev:migrate    # Create + apply migration to .env.local DB
npm run prisma:dev:reset      # Drop and recreate all tables (dev only)
npm run prisma:dev:studio     # Open Prisma Studio UI
npm run prisma:prod:deploy    # Apply pending migrations to production DB
npm run prisma:generate       # Regenerate Prisma client types

# Seeding (populate test data)
npm run seed:all              # Run all seeds
npm run seed:rbac             # Seed roles and permissions
npm run seed:workout          # Seed sample workouts
npm run seed:meal-template    # Seed meal templates
npm run seed:demo             # Demo data for testing

# Imports (bulk data)
npm run seed:foods:file       # Import foods from prisma_seed_data.json
npm run seed:exercises:file   # Import exercises from 01_athletica_mvp_database_v2.json
```

### Adding New API Features

**1. Update Schema**

```bash
# Edit prisma/schema.prisma
npm run prisma:dev:migrate -- --name feature_name
```

**2. Create Controller**

- File: `controllers/feature.js`
- Local validation helpers at top
- Exported handler functions
- Use [AppError](utils/appError.js) for known errors

**3. Create Route**

- File: `routes/feature.js`
- Thin layer: permission middleware + handler calls
- Explicit permission checks via `checkPermission("<ACTION>-<RESOURCE>")`

**4. Test**

```bash
npm run dev
# Use Postman or curl to test endpoints
```

See existing controllers for pattern examples: [mealPlan.js](controllers/mealPlan.js)

### Database Migrations

**Development Workflow:**

```bash
# Make schema changes
# Apply to local .env.local database:
npm run prisma:dev:migrate -- --name describe_change

# Test queries work
# Commit schema changes
# When ready for production:
npm run prisma:prod:deploy  # Applies migrations to production
```

**Important:** Never use `prisma migrate dev` on production databases. Use `prisma migrate deploy` instead.

See [prisma-migration-workflow.md](docs/prisma-migration-workflow.md) for detailed guide.

### Logging & Debugging

**Environment Variables**

```
NODE_ENV=development       # Logs warnings + errors
NODE_ENV=production        # Logs errors only
DEBUG=athletica:*          # Enable debug logging (if configured)
```

**Activity Logs** track all user actions:

```bash
GET /activity-logs?userId=xxx&resourceType=MealPlan&since=2025-01-01
```

### Code Style Guide

- **Modules**: ESM (`import`/`export`) with `.js` files
- **Error Handling**: `AppError` for validation/domain errors, `next(err)` for unexpected
- **Prisma**: Minimal explicit `select` — avoid returning full related objects
- **Transactions**: Multi-step writes use `prisma.$transaction()`
- **Auth**: Permission checks in routes, role/ownership in controllers

---

## Troubleshooting

### Database Connection Failed

```
Error: Database connection failed
```

**Solution:**

- Check `.env.local` has valid `DATABASE_URL`
- Verify PostgreSQL is running
- Test connection: `psql -U user -d database -h localhost`

### Token Expired When Testing

```
Error: Token expired, please login again
```

**Solution:** Login again to get fresh JWT

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"password"}'
```

### Permission Denied

```
Error: Forbidden — insufficient permissions
```

**Solution:**

- Verify user role via `GET /users/:id`
- Check role has required permission via `GET /role-permissions`
- Grant permission: `POST /role-permissions` (admin only)

### Meal Plan Not Associating with Items

Ensure items are created AFTER plan is created (foreign key constraint).

---

## Resources

- **API Reference**: [auth-permission-reference.md](docs/auth-permission-reference.md)
- **Messaging Setup**: [MESSAGING-README.md](docs/MESSAGING-README.md)
- **Recent Updates**: [updates-2026-04-07.md](docs/updates-2026-04-07.md)
- **Trainer Invite Flow**: [trainer-invite-to-trainer-client-flow.md](docs/trainer-invite-to-trainer-client-flow.md)

---

## License

ISC

---

**Last Updated**: April 2026
