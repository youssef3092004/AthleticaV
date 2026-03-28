# AthleticaV — Project Documentation

> A RESTful API backend for a fitness trainer-client platform built with **Node.js**, **Express v5**, **Prisma ORM**, and **PostgreSQL**.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [Database Schema (Prisma)](#database-schema-prisma)
5. [RBAC System](#rbac-system)
6. [API Endpoints](#api-endpoints)
7. [Middleware](#middleware)
8. [Utilities](#utilities)
9. [What Is Done ✅](#what-is-done-)
10. [What Remains ❌](#what-remains-)

---

## Tech Stack

| Layer             | Technology                                               |
| ----------------- | -------------------------------------------------------- |
| Runtime           | Node.js (ESM, `"type": "module"`)                        |
| Framework         | Express v5                                               |
| ORM               | Prisma 7                                                 |
| Database          | PostgreSQL                                               |
| Auth              | JWT (`jsonwebtoken`) + bcrypt                            |
| Validation        | `validator` + custom utils                               |
| Caching           | In-memory Map (Redis installed, not yet wired)           |
| File Uploads      | Multer + Cloudinary (installed, not yet wired)           |
| Security packages | Helmet, CORS, express-rate-limit, express-slow-down, xss |
| Seeding           | `scripts/seedRbac.js` → `npm run seed:rbac`              |

---

## Project Structure

```
server.js                  # Entry point, mounts all routes
configs/
  db.js                    # Prisma client + DB connection
  rbac.js                  # RBAC roles, permissions, and role→permission map
routes/                    # Express routers (one file per resource)
controllers/               # Business logic handlers
middleware/
  auth.js                  # verifyToken (JWT + blacklist check)
  checkPermission.js       # Role-based permission gate
  checkOwnership.js        # Resource ownership guard
  resourceAccess.js        # Generic authorizeResource helper
  errorHandler.js          # Global error handler
utils/
  appError.js              # Custom AppError class
  cache.js                 # In-memory tag-based cache
  pagination.js            # Cursor/offset pagination helper
  validation.js            # isValidName/Email/Password/Phone
prisma/
  schema.prisma            # Full data model
  migrations/              # Prisma migration history
scripts/
  seedRbac.js              # Seeds roles + permissions into DB
```

---

## Environment Variables

```env
# Use one of these (DATABASE_URL is recommended)
DATABASE_URL=
PRISMA_URL=
JWT_SECRET=
JWT_EXPIRES_IN=7d
SALT_ROUNDS=10
PORT=3000
CACHE_TTL_MS=30000
# Redis (not yet connected)
REDIS_URL=
# Cloudinary (not yet connected)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## Database Schema (Prisma)

### Auth & RBAC

| Model              | Table                | Notes                                    |
| ------------------ | -------------------- | ---------------------------------------- |
| `User`             | `users`              | Core user — phone unique, email optional |
| `Role`             | `roles`              | e.g. TRAINER, CLIENT, ADMIN              |
| `Permission`       | `permissions`        | Key-based e.g. `CREATE-WORKOUTS`         |
| `UserRole`         | `user_roles`         | Many-to-many User ↔ Role                 |
| `RolePermission`   | `role_permissions`   | Many-to-many Role ↔ Permission           |
| `BlacklistedToken` | `blacklisted_tokens` | Logout token blacklist                   |

### Trainer & Client

| Model            | Table              | Notes                           |
| ---------------- | ------------------ | ------------------------------- |
| `TrainerProfile` | `trainer_profiles` | bio, certifications, rating     |
| `TrainerClient`  | `trainer_clients`  | Status: ACTIVE / PAUSED / ENDED |

### Workouts

| Model             | Table               | Notes                            |
| ----------------- | ------------------- | -------------------------------- |
| `WorkoutTemplate` | `workout_templates` | Reusable template by trainer     |
| `Workout`         | `workouts`          | Assigned workout with date range |
| `WorkoutItem`     | `workout_items`     | Exercise rows inside a workout   |

### Nutrition _(schema defined, not yet implemented)_

| Model          | Table             | Notes                               |
| -------------- | ----------------- | ----------------------------------- |
| `Food`         | `foods`           | Calories, protein, carbs, fat       |
| `FoodPortion`  | `food_portions`   | Portion labels + multipliers        |
| `MealTemplate` | `meal_templates`  | Reusable meal plan template         |
| `MealPlan`     | `meal_plans`      | Assigned meal plan with date range  |
| `MealPlanItem` | `meal_plan_items` | Food + portion + meal time per plan |

### Progress _(schema defined, not yet implemented)_

| Model            | Table              | Notes                               |
| ---------------- | ------------------ | ----------------------------------- |
| `ProgressMetric` | `progress_metrics` | WEIGHT / BODY_FAT / MUSCLE tracking |

### Messaging _(schema defined, not yet implemented)_

| Model          | Table           | Notes                      |
| -------------- | --------------- | -------------------------- |
| `Conversation` | `conversations` | 1 per trainer-client pair  |
| `Message`      | `messages`      | TEXT / IMAGE / VIDEO types |

### Payments _(schema defined, not yet implemented)_

| Model           | Table             | Notes                                   |
| --------------- | ----------------- | --------------------------------------- |
| `Transaction`   | `transactions`    | grossAmount, platformFee, trainerAmount |
| `TrainerWallet` | `trainer_wallets` | Running balance per trainer             |
| `Payout`        | `payouts`         | REQUESTED / PAID status                 |

### Audit _(schema defined, not yet implemented)_

| Model         | Table           | Notes                              |
| ------------- | --------------- | ---------------------------------- |
| `ActivityLog` | `activity_logs` | User action log with JSON metadata |

---

## RBAC System

Roles defined in `configs/rbac.js` and seeded via `npm run seed:rbac`.

| Role        | Access Level                                            |
| ----------- | ------------------------------------------------------- |
| `OWNER`     | All permissions                                         |
| `DEVELOPER` | All permissions                                         |
| `ADMIN`     | All permissions                                         |
| `TRAINER`   | Own profile, clients, workout templates, workouts       |
| `CLIENT`    | View own data, trainer profiles, workouts               |
| `SUPPORT`   | Read-only on users, trainer profiles, clients, workouts |

**Current permissions defined:** 36 keys covering full CRUD on users, roles, permissions, role-permissions, trainer profiles, trainer clients, workout templates, and workouts.

---

## API Endpoints

Base URL: `/api/v1`

### Auth — `/auth`

| Method | Path             | Auth | Permission | Description                 |
| ------ | ---------------- | ---- | ---------- | --------------------------- |
| POST   | `/register`      | ❌   | N/A        | Register a new user         |
| POST   | `/login`         | ❌   | N/A        | Login and return JWT        |
| POST   | `/logout`        | ✅   | N/A        | Logout and blacklist token  |
| PATCH  | `/resetPassword` | ✅   | N/A        | Reset current user password |

### Users — `/users`

| Method | Path                  | Auth | Permission                 | Description              |
| ------ | --------------------- | ---- | -------------------------- | ------------------------ |
| GET    | `/me`                 | ✅   | `VIEW-ME`                  | Get current user profile |
| GET    | `/getAll`             | ✅   | `VIEW-USERS`               | List users               |
| GET    | `/getById/:userId`    | ✅   | `VIEW-USERS`               | Get user by ID           |
| PATCH  | `/update/:userId`     | ✅   | `UPDATE-USERS` + ownership | Update user              |
| DELETE | `/deleteById/:userId` | ✅   | `DELETE-USERS` + ownership | Delete user              |

### Roles — `/roles`

| Method | Path              | Auth | Permission     | Description    |
| ------ | ----------------- | ---- | -------------- | -------------- |
| POST   | `/create`         | ✅   | `CREATE-ROLES` | Create role    |
| GET    | `/getAll`         | ✅   | `VIEW-ROLES`   | List roles     |
| GET    | `/getById/:id`    | ✅   | `VIEW-ROLES`   | Get role by ID |
| PUT    | `/update/:id`     | ✅   | `UPDATE-ROLES` | Update role    |
| DELETE | `/deleteById/:id` | ✅   | `DELETE-ROLES` | Delete role    |

### Permissions — `/permissions`

| Method | Path              | Auth | Permission           | Description            |
| ------ | ----------------- | ---- | -------------------- | ---------------------- |
| POST   | `/create`         | ✅   | `CREATE-PERMISSIONS` | Create permission      |
| GET    | `/getAll`         | ✅   | `VIEW-PERMISSIONS`   | List permissions       |
| GET    | `/getById/:id`    | ✅   | `VIEW-PERMISSIONS`   | Get permission by ID   |
| PUT    | `/updateById/:id` | ✅   | `UPDATE-PERMISSIONS` | Update permission      |
| DELETE | `/deleteById/:id` | ✅   | `DELETE-PERMISSIONS` | Delete permission      |
| DELETE | `/deleteAll`      | ✅   | `DELETE-PERMISSIONS` | Delete all permissions |

### Role Permissions — `/role-permissions`

| Method | Path              | Auth | Permission                | Description                            |
| ------ | ----------------- | ---- | ------------------------- | -------------------------------------- |
| POST   | `/create`         | ✅   | `CREATE-ROLE-PERMISSIONS` | Create role-permission assignment      |
| GET    | `/getAll`         | ✅   | `VIEW-ROLE-PERMISSIONS`   | List role-permission assignments       |
| GET    | `/getById/:id`    | ✅   | `VIEW-ROLE-PERMISSIONS`   | Get role-permission assignment by ID   |
| PUT    | `/update/:id`     | ✅   | `UPDATE-ROLE-PERMISSIONS` | Update role-permission assignment      |
| DELETE | `/deleteById/:id` | ✅   | `DELETE-ROLE-PERMISSIONS` | Delete role-permission assignment      |
| DELETE | `/deleteAll`      | ✅   | `DELETE-ROLE-PERMISSIONS` | Delete all role-permission assignments |

### User Permissions — `/user-permissions`

| Method | Path   | Auth | Permission           | Description                            |
| ------ | ------ | ---- | -------------------- | -------------------------------------- |
| POST   | `/`    | ✅   | `CREATE-PERMISSIONS` | Create user-permission assignment      |
| GET    | `/`    | ✅   | `VIEW-PERMISSIONS`   | List user-permission assignments       |
| GET    | `/:id` | ✅   | `VIEW-PERMISSIONS`   | Get user-permission assignment by ID   |
| PUT    | `/:id` | ✅   | `UPDATE-PERMISSIONS` | Update user-permission assignment      |
| DELETE | `/:id` | ✅   | `DELETE-PERMISSIONS` | Delete user-permission assignment      |
| DELETE | `/`    | ✅   | `DELETE-PERMISSIONS` | Delete all user-permission assignments |

### Trainer Profiles — `/trainer-profiles`

| Method | Path               | Auth | Permission                | Description                    |
| ------ | ------------------ | ---- | ------------------------- | ------------------------------ |
| POST   | `/create`          | ✅   | `CREATE-TRAINER-PROFILES` | Create trainer profile         |
| GET    | `/getAll`          | ✅   | `VIEW-TRAINER-PROFILES`   | List trainer profiles          |
| GET    | `/getById/:userId` | ✅   | `VIEW-TRAINER-PROFILES`   | Get trainer profile by user ID |
| PATCH  | `/update/:userId`  | ✅   | `UPDATE-TRAINER-PROFILES` | Update trainer profile         |
| DELETE | `/delete/:userId`  | ✅   | `DELETE-TRAINER-PROFILES` | Delete trainer profile         |
| DELETE | `/deleteAll`       | ✅   | `DELETE-TRAINER-PROFILES` | Delete all trainer profiles    |

### Trainer Clients — `/trainer-clients`

| Method | Path                            | Auth | Permission               | Description                         |
| ------ | ------------------------------- | ---- | ------------------------ | ----------------------------------- |
| POST   | `/create`                       | ✅   | `CREATE-TRAINER-CLIENTS` | Create trainer-client relation      |
| GET    | `/getAll`                       | ✅   | `VIEW-TRAINER-CLIENTS`   | List trainer-client relations       |
| GET    | `/getAllByTrainerId/:trainerId` | ✅   | `VIEW-TRAINER-CLIENTS`   | List relations by trainer ID        |
| GET    | `/getById/:id`                  | ✅   | `VIEW-TRAINER-CLIENTS`   | Get trainer-client relation by ID   |
| PATCH  | `/updateStatusToPaused/:id`     | ✅   | `UPDATE-TRAINER-CLIENTS` | Set relation status to `PAUSED`     |
| PATCH  | `/updateStatusToEnded/:id`      | ✅   | `UPDATE-TRAINER-CLIENTS` | Set relation status to `ENDED`      |
| PATCH  | `/updateStatusToActive/:id`     | ✅   | `UPDATE-TRAINER-CLIENTS` | Set relation status to `ACTIVE`     |
| DELETE | `/deleteById/:id`               | ✅   | verifyToken only         | Delete trainer-client relation      |
| DELETE | `/deleteAll`                    | ✅   | verifyToken only         | Delete all trainer-client relations |

### Workout Templates — `/workout-templates`

| Method | Path                 | Auth | Permission                 | Description                       |
| ------ | -------------------- | ---- | -------------------------- | --------------------------------- |
| POST   | `/create`            | ✅   | `CREATE-WORKOUT-TEMPLATES` | Create workout template           |
| GET    | `/getAll/:trainerId` | ✅   | `VIEW-WORKOUT-TEMPLATES`   | List workout templates by trainer |
| GET    | `/getById/:id`       | ✅   | `VIEW-WORKOUT-TEMPLATES`   | Get workout template by ID        |
| PATCH  | `/update/:id`        | ✅   | `UPDATE-WORKOUT-TEMPLATES` | Update workout template           |
| DELETE | `/delete/:id`        | ✅   | `DELETE-WORKOUT-TEMPLATES` | Delete workout template           |
| DELETE | `/deleteAll`         | ✅   | `DELETE-WORKOUT-TEMPLATES` | Delete all workout templates      |

### Workouts — `/workouts`

| Method | Path           | Auth | Permission        | Description         |
| ------ | -------------- | ---- | ----------------- | ------------------- |
| POST   | `/create`      | ✅   | `CREATE-WORKOUTS` | Create workout      |
| GET    | `/getAll`      | ✅   | `VIEW-WORKOUTS`   | List workouts       |
| GET    | `/getById/:id` | ✅   | `VIEW-WORKOUTS`   | Get workout by ID   |
| PATCH  | `/update/:id`  | ✅   | `UPDATE-WORKOUTS` | Update workout      |
| DELETE | `/delete/:id`  | ✅   | `DELETE-WORKOUTS` | Delete workout      |
| DELETE | `/deleteAll`   | ✅   | `DELETE-WORKOUTS` | Delete all workouts |

### Workout Items — `/workout-items`

| Method | Path                            | Auth | Permission        | Description                      |
| ------ | ------------------------------- | ---- | ----------------- | -------------------------------- |
| POST   | `/create`                       | ✅   | `CREATE-WORKOUTS` | Create workout item              |
| GET    | `/getAll`                       | ✅   | `VIEW-WORKOUTS`   | List workout items               |
| GET    | `/getAllByWorkoutId/:workoutId` | ✅   | `VIEW-WORKOUTS`   | List workout items by workout ID |
| GET    | `/getById/:id`                  | ✅   | `VIEW-WORKOUTS`   | Get workout item by ID           |
| PATCH  | `/update/:id`                   | ✅   | `UPDATE-WORKOUTS` | Update workout item              |
| DELETE | `/delete/:id`                   | ✅   | `DELETE-WORKOUTS` | Delete workout item              |
| DELETE | `/deleteAll`                    | ✅   | `DELETE-WORKOUTS` | Delete all workout items         |

---

## Middleware

| File                 | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `auth.js`            | `verifyToken` — validates JWT, checks blacklist           |
| `checkPermission.js` | Gates routes by permission key(s)                         |
| `checkOwnership.js`  | Ensures user owns the resource (or has bypass role)       |
| `resourceAccess.js`  | Generic `authorizeResource(action)` using resource config |
| `errorHandler.js`    | Global error handler — formats `AppError` responses       |

---

## Utilities

| File            | Purpose                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `appError.js`   | `AppError` class with `statusCode` and `isOperational`                      |
| `cache.js`      | Tag-based in-memory cache (`getCache`, `setCache`, `invalidateCacheByTags`) |
| `pagination.js` | Pagination helper for list endpoints                                        |
| `validation.js` | `isValidName`, `isValidEmail`, `isValidPassword`, `isValidPhone`            |

---

## What Is Done ✅

### Infrastructure

- [x] Express server with ESM modules
- [x] Prisma + PostgreSQL connection (`configs/db.js`)
- [x] Global error handler middleware
- [x] Custom `AppError` class
- [x] Input validation utilities (name, email, password, phone)
- [x] In-memory tag-based cache utility
- [x] Pagination utility
- [x] RBAC seed script (`npm run seed:rbac`)

### Auth

- [x] Register (multi-role support, auto CLIENT fallback)
- [x] Login with JWT signing
- [x] Logout with token blacklisting
- [x] Reset password (while authenticated)
- [x] `verifyToken` middleware with blacklist check

### RBAC

- [x] Roles CRUD
- [x] Permissions CRUD
- [x] Role ↔ Permission assignment CRUD
- [x] User ↔ Permission assignment CRUD
- [x] `checkPermission` middleware
- [x] `checkOwnership` middleware
- [x] 6 roles defined: OWNER, DEVELOPER, ADMIN, TRAINER, CLIENT, SUPPORT
- [x] 36 permission keys defined and mapped

### Users

- [x] Get own profile (`/me`)
- [x] Get all users, get by ID
- [x] Update user (password re-hashed on change)
- [x] Delete user

### Trainer Profiles

- [x] Create, read, update, delete trainer profile
- [x] Ownership check (trainers can only manage their own profile)

### Trainer Clients

- [x] Create, read, update, delete trainer-client relationships
- [x] Status management: ACTIVE / PAUSED / ENDED

### Workout Templates

- [x] Create, read, update, delete workout templates
- [x] Level: BEGINNER / INTERMEDIATE / ADVANCED

### Workouts

- [x] Create workout with embedded `WorkoutItems` (exercises)
- [x] Get workout + items, update, delete
- [x] Date range filtering, trainer/client filtering
- [x] Scoped listing (trainers see their own, admins see all)

---

## What Remains ❌

### Security hardening (packages installed, not wired)

- [ ] **Helmet** — add `app.use(helmet())` in `server.js`
- [ ] **CORS** — add `app.use(cors(...))` with allowed origins
- [ ] **Rate limiting** — add `express-rate-limit` to auth routes (login/register)
- [ ] **Slow-down** — add `express-slow-down` to sensitive routes
- [ ] **XSS** — sanitize request body strings with the `xss` package
- [ ] **Redis cache** — replace in-memory Map with Redis client using installed `redis` package

### File Uploads (packages installed, not wired)

- [ ] **Multer middleware** — file upload handling
- [ ] **Cloudinary integration** — upload profile images and media files
- [ ] **Profile image upload endpoint** — `PATCH /users/:id/avatar`

### Nutrition Module _(DB schema exists, no routes/controllers)_

- [ ] `GET/POST /foods` — food catalog CRUD
- [ ] `GET/POST /food-portions` — portion variants per food
- [ ] `GET/POST /meal-templates` — reusable meal plan templates
- [ ] `GET/POST /meal-plans` — assign meal plan to client (with items)
- [ ] `GET/POST /meal-plans/:id/items` — add/remove food items per meal time
- [ ] RBAC permissions for meal module

### Progress Tracking _(DB schema exists, no routes/controllers)_

- [ ] `POST /progress` — log a metric (weight, body fat, muscle)
- [ ] `GET /progress` — list metrics for a user
- [ ] `GET /progress/summary` — aggregated trend view
- [ ] RBAC permissions for progress module

### Messaging _(DB schema exists, no routes/controllers)_

- [ ] `POST /conversations` — start a conversation between trainer & client
- [ ] `GET /conversations` — list own conversations
- [ ] `POST /conversations/:id/messages` — send a message
- [ ] `GET /conversations/:id/messages` — fetch messages (paginated)
- [ ] Real-time support via **WebSockets / Socket.io** (not yet installed)
- [ ] RBAC permissions for messaging module

### Payments _(DB schema exists, no routes/controllers)_

- [ ] `POST /transactions` — create a payment transaction
- [ ] `GET /transactions` — list transactions
- [ ] `GET /wallet` — get trainer wallet balance
- [ ] `POST /payouts` — request a payout
- [ ] `GET /payouts` — list payout history
- [ ] Payment gateway integration (Stripe / Fawry / etc.) — not yet chosen
- [ ] RBAC permissions for payments module

### Activity Logs _(DB schema exists, no routes/controllers)_

- [ ] Plug `ActivityLog` writes into key controllers (login, register, update, delete)
- [ ] `GET /activity-logs` — admin view of audit trail

### Auth Improvements

- [ ] Email/SMS verification flow (`isVerified` field exists but unused)
- [ ] Refresh token mechanism
- [ ] Forgot password via email/OTP

### General

- [ ] `.env.example` file for onboarding
- [ ] Request body XSS sanitization middleware
- [ ] Swagger / OpenAPI documentation
- [ ] Unit & integration tests
- [ ] Docker / docker-compose setup

---

_Last updated: March 15, 2026_
