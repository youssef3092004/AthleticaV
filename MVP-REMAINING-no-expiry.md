# MVP Remaining Work (No Invite Expiry)

This file tracks only what is still required to finish the demo MVP.

Decision locked:

- Invite codes are reusable and never expire.
- Do not add `expiresAt`, expiry validation, or expiration jobs.

## P0 - Must Finish Before Demo

### 1) Invitation + Activation Flow

Status: Partially complete

Already done:

- Trainer invite code generation exists.
- Invite verification exists.
- Client registration accepts invite code.
- Trainer approval can create/link trainer-client relation.

Remaining:

- Finalize one activation path and keep only that behavior:
  - Path A (current): register with invite -> pending -> trainer approves.
  - Path B: register with invite -> auto-link immediately.
- If Path B is selected, update `clientRegister` transaction to upsert `TrainerClient` directly.
- Ensure demo/frontend copy matches final activation behavior (avoid confusion during live demo).

### 2) Quick Message (Coach -> Client)

Status: Partially complete

Already done:

- Conversations/messages APIs are implemented.
- Latest message by `conversationId` exists.

Remaining:

- Add coach quick-send endpoint that works from client profile without requiring frontend to pre-fetch `conversationId`.
  - Suggested: `POST /api/v1/messages/quick-send/:clientId`
- Add client-home latest coach message summary endpoint scoped to authenticated user.
  - Suggested: `GET /api/v1/messages/latest-for-home`
- Keep trainer-client ownership checks strict in both endpoints.

### 3) Workout Weight Logging

Status: Complete

Remaining:

- No backend blocker. Only verify frontend sends/reads `loggedWeightKg` consistently.

### 4) Coach Wow Moment Aggregation Endpoint

Status: Complete

Remaining:

- Freeze response contract used in demo UI (shape and key names).
- Add graceful partial response strategy if one subsection query fails.

### 5) Demo Seed Data (Realistic Dashboard)

Status: Partially complete

Already done:

- Ahmed seeded with fixed demo credentials.
- 6 demo clients + Sara seeded.

Remaining:

- Decide Sara story setup for demo day:
  - If live invite story is required, keep Sara not pre-linked at seed time.
  - If not required, current setup is acceptable.
- Seed guaranteed wow data examples:
  - at least one workout completion with `loggedWeightKg` (e.g., Squat 60kg)
  - meal completion summary guaranteed to show a clear ratio (e.g., 2/3)

## P1 - Strongly Recommended for Demo Stability

### 6) Demo-Safe API Contracts

Remaining:

- Freeze response shapes for all demo-used endpoints.
- Ensure consistent and clear 4xx validation messages.
- Add idempotency handling for retry-prone actions (at minimum invite approval + quick send).

### 7) Role + Ownership Consistency Pass

Status: Mostly done

Remaining:

- Run final audit on only demo-critical endpoints:
  - invite create/verify/register/approve
  - quick message send/latest
  - workout completion + wow endpoint

### 8) Performance and Reliability

Remaining:

- Measure demo-critical endpoints and confirm acceptable latency in demo environment.
- Add simple fallback strategy for dashboard refresh if one section fails.

## P2 - Nice to Have

### 9) Security Hardening

Remaining:

- Wire middleware in server pipeline: `helmet`, `cors`, `express-rate-limit`, `express-slow-down`, and xss sanitization.

### 10) Integration Tests

Remaining:

- Add integration tests for:
  - invite register -> approve -> relation
  - workout completion with logged weight
  - meal completion summary
  - quick message send/read latest
  - wow moment aggregation endpoint

## Final Demo Acceptance (No Expiry Version)

- Coach gets reusable invite code/link instantly.
- Client registers with invite code successfully.
- Activation follows one clear path (manual approve or auto-link) with no ambiguity.
- Client logs workout with `loggedWeightKg` and meal checks.
- Coach sees workout status, logged weight, meals summary, and latest message in one wow payload.
- Dashboard is populated with realistic seeded clients.

## Delivery Order

1. Lock activation behavior (A or B)
2. Implement quick message MVP endpoints
3. Stabilize wow payload contract + partial failure handling
4. Align seed data with final live demo story
5. Do permission/ownership final pass on demo endpoints
6. Add smoke/integration tests for demo-critical flow
