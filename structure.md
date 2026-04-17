# AthleticaV Backend Structure Guide

This file explains how the backend is organized so it can be understood quickly without reading business logic details.

## 1) Stack and Runtime

- Runtime: Node.js (ESM modules)
- Framework: Express
- ORM and DB: Prisma + PostgreSQL
- Realtime: Socket.IO
- Auth: JWT
- Security middleware: helmet, cors, xss sanitization, rate limit, slow down

Main entrypoint:

- server.js

## 2) High-Level Request Flow

Standard HTTP flow:

1. Client sends request
2. Global app middleware runs (security, parsing, sanitization, rate controls)
3. Route file matches endpoint
4. Route-level middleware runs (auth, permission, ownership)
5. Controller handler executes
6. Controller uses Prisma via configs/db.js
7. Response returned
8. errorHandler formats any thrown error into a standard JSON shape

Realtime flow (messages/events):

1. Client connects to Socket.IO with JWT
2. Socket auth middleware verifies token and blacklist status
3. Event handlers in utils/websocket.js handle join/send/read events
4. Events are persisted through Prisma and emitted to rooms/users

## 3) Top-Level Project Structure

- configs/
  - db.js: Prisma client and PostgreSQL adapter/pool setup
  - rbac.js: static role and permission definitions
  - resources.js: resource-to-model and CRUD permission mappings

- controllers/
  - One controller file per domain resource/module
  - Handles input validation, access checks, Prisma reads/writes, response shape
  - Keeps route files thin

- middleware/
  - auth.js: token verification and user context hydration
  - checkPermission.js: role/permission enforcement (+ trainer subscription guard)
  - checkOwnership.js: owner-based data access checks
  - resourceAccess.js: dynamic resource/permission checks
  - errorHandler.js: centralized error response formatter

- prisma/
  - schema.prisma: source of truth for data models and enums
  - migrations/: schema history

- routes/
  - Express routers for each module
  - Mostly maps endpoint -> middleware chain -> controller function

- utils/
  - appError.js: typed application error utility
  - authz.js: shared authorization helpers (role normalization, identity context, ownership helpers)
  - pagination.js: list endpoint pagination helper
  - mealPlanProgress.js / workoutProgress.js: progress recalculation helpers
  - validation.js and other helpers: shared validation and utility support
  - websocket.js: Socket.IO initialization and event handlers

- scripts/
  - seeding scripts
  - catalog import scripts
  - Prisma env wrapper and migration helper scripts

- docs/
  - architecture, module references, migration workflow, testing and API references

- generated/
  - generated Prisma artifacts

## 4) Module Pairing Convention

Most backend domains follow this pair:

- routes/<module>.js
- controllers/<module>.js

Examples:

- auth: routes/auth.js + controllers/auth.js
- meal plan: routes/mealPlan.js + controllers/mealPlan.js
- workout template: routes/workoutTemplate.js + controllers/workoutTemplate.js
- messaging: routes/message.js + controllers/message.js

Special case:

- routes/trainerInviteCode.js reuses handlers from controllers/trainerClientInvite.js

## 5) Route Layer Responsibilities

Route files are intentionally thin.

Typical pattern:

1. Import controller handlers
2. Import middleware pieces
3. Declare endpoints and middleware chain
4. Export router

Common middleware order used in routes:

1. verifyToken
2. checkPermission("ACTION-RESOURCE")
3. optional checkOwnership(...)
4. controller handler

## 6) Controller Layer Responsibilities

Controller files are the main application layer.

Structure pattern commonly used:

1. Local validation/normalization helper functions at top
2. Shared constants/select objects
3. Exported async handlers (try/catch + next(error))
4. Prisma operations with explicit select objects (minimal response fields)
5. Uniform success JSON responses

Controllers commonly depend on:

- prisma from configs/db.js
- AppError from utils/appError.js
- authz helper functions from utils/authz.js
- pagination(req, defaults)
- recalculation utilities for summary/progress style endpoints

## 7) Authorization and Access Model Structure

Auth and access are split into layers:

- Authentication:
  - middleware/auth.js validates JWT and token blacklist
  - attaches user identity and normalized role context to req.user

- Permission checks:
  - middleware/checkPermission.js resolves role permissions from DB
  - verifies required permission keys for route
  - includes bypass for privileged roles and trainer subscription checks

- Ownership and context checks:
  - middleware/checkOwnership.js and utils/authz.js
  - used to ensure user can only access owned/allowed resources unless privileged

- Static definitions:
  - configs/rbac.js (roles + permission sets)
  - configs/resources.js (resource-level CRUD permission map)

## 8) Data Layer Structure

Prisma is the only data access layer used by controllers.

Key structure points:

- schema.prisma defines:
  - enums (status types, message types, lifecycle states)
  - user/role/permission models
  - coaching, workout, meal, messaging, finance, and activity models

- Relation-heavy modules are split by hierarchy in separate controllers/routes:
  - template -> day -> item
  - plan/workout -> day -> item

- Multi-step writes use Prisma transactions where needed to keep consistency

## 9) Error Handling Structure

Two core pieces:

- AppError class (utils/appError.js): domain/validation errors with status code
- errorHandler middleware:
  - maps known transient DB failures to 503
  - standardizes JSON error format:
    - success
    - error
    - optional code

## 10) Realtime Messaging Structure

Realtime is initialized in server.js:

- create HTTP server
- attach Socket.IO instance
- call initializeWebSocket(io)

websocket.js structure:

1. Socket auth middleware (JWT + blacklist check)
2. Connection bookkeeping (user to socket map)
3. Event handlers for conversation join, send message, mark read
4. Room-based broadcasting pattern: conversation:<id>

HTTP messaging endpoints still exist in routes/message.js and routes/conversation.js.

## 11) API Surface Grouping (Domain View)

Main domain groups:

- Identity and RBAC:
  - auth, user, role, permission, rolePermission, userPermission

- Coaching relationship:
  - trainerProfile, clientProfile, trainerClient, trainerClientInvite, trainerInviteCode, clientIntake

- Workout system:
  - workoutTemplate, workoutTemplateDay, workoutTemplateItem, workout, workoutDay, workoutItem, workoutCompletion, exercise

- Meal system:
  - mealTemplate, mealTemplateDay, mealTemplateItem, mealPlan, mealPlanDay, mealPlanItem, mealCompletion, food

- Communication:
  - conversation, message (plus websocket)

- Finance and analytics:
  - transaction, trainerWallet, payout, progress, activityLog

## 12) How to Design New Backend Code in This Project

When adding a new module, follow this structure:

1. Add or update Prisma models/enums in prisma/schema.prisma
2. Create route file in routes/
3. Create controller file in controllers/
4. Add middleware chain using existing auth/permission/ownership patterns
5. Add explicit permission keys in configs/rbac.js (if new permissions needed)
6. Optionally register resource mapping in configs/resources.js
7. Mount route in server.js under /api/v1/<resource>
8. Add seed/import support in scripts/ if required
9. Update docs/ references

Controller design checklist:

- Keep helper validators local at file top
- Use AppError for expected failures
- Keep Prisma select minimal and explicit
- Use pagination helper for list endpoints
- Use transaction for multi-step mutations
- Return predictable JSON shape
- Pass unknown errors to next(error)

## 13) Useful Files to Read First

If someone wants to understand architecture quickly, start with:

1. README.md
2. server.js
3. docs/MODULES-REFERENCE.md
4. middleware/checkPermission.js
5. utils/authz.js
6. prisma/schema.prisma

## 14) Notes for AI or New Contributors

- Routes are transport-level only; avoid putting business logic there.
- Controllers are the implementation layer.
- Authorization is both permission-based and ownership-based.
- Prisma schema is the canonical data contract.
- Keep file/module naming consistent with existing singular resource style.
- Prefer extending existing middleware/util helpers over duplicating access logic.
