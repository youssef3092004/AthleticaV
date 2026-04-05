# MVP Remaining Work

This checklist focuses only on what is still needed to complete the Athletica demo MVP flow.

## P0 - Must Finish Before Demo (Blockers)

### 1) Invitation + Activation Flow

- Create trainer-side invite endpoint (generate code/link for a specific coach).
- Add invite persistence (code, trainerId, status, expiry, usedAt).
- Create client activation endpoint (redeem code, set password, create/link client account).
- Auto-create trainer-client relation after successful activation.
- Add validation for expired/invalid/used codes.

### 2) Quick Message (Coach -> Client)

- Add conversation/message routes for the MVP quick message action.
- Implement send message endpoint (single-line text from coach profile view).
- Implement latest message fetch for client home screen.
- Restrict access so only linked trainer/client pair can exchange messages.

### 3) Workout Weight Logging for Wow Moment

- Add explicit weight field to workout completion (or dedicated per-exercise log model).
- Update completion create/update handlers to accept and validate logged weight.
- Return logged weight in coach-side profile/progress payload.

### 4) Coach "Wow Moment" Aggregation Endpoint

- Add a single endpoint that returns:
  - workout completion status
  - per-exercise logged weight (example: Squat 60kg)
  - meals tracked summary (example: 2/3)
  - latest coach message summary
- Ensure endpoint response is fast and stable for live demo.

### 5) Demo Seed Data (Realistic Dashboard)

- Seed Ahmed trainer account with fixed demo credentials.
- Seed 6 active clients with varied realistic statuses.
- Keep Sara as the new invited client (7th) for the story flow.
- Seed workout/meal baseline data so dashboard feels alive.

## P1 - Strongly Recommended for Demo Stability

### 6) Demo-Safe API Contracts

- Freeze response shapes for all demo-used endpoints.
- Add strict request validation with clear error messages.
- Add idempotency for actions that may be retried during demo prep.

### 7) Role + Ownership Consistency Pass

- Verify each demo endpoint is scoped to authenticated user context.
- Ensure trainer sees only own clients unless privileged role.
- Ensure client sees only own assigned data.

### 8) Performance and Reliability

- Target sub-300ms for demo-critical endpoints.
- Add fallback/manual refresh support for coach profile data.
- Add graceful handling if one sub-section fails (partial payload strategy if needed).

## P2 - Nice to Have (After MVP is Safe)

### 9) Security Hardening for Production Readiness

- Enable helmet/cors/rate-limit/slow-down/xss middleware.
- Move cache to Redis if needed under load.

### 10) Test Coverage

- Add integration tests for:
  - invite -> activate -> link flow
  - workout completion with weight
  - meal completion summary
  - quick message send/read
  - coach aggregation endpoint

## Demo Acceptance Checklist

- Coach can invite Sara and receive a valid code/link immediately.
- Sara can activate using invite code and appears under Ahmed clients.
- Ahmed can assign workout and meal plan to Sara.
- Sara can log exercise completion with weight and meal checks.
- Ahmed profile view shows: workout done, Squat weight, meals tracked.
- Ahmed sends one-line quick message visible on client side.
- Dashboard shows multiple active clients (not empty first-run state).

## Suggested Delivery Order

1. Invitation + activation flow
2. Workout weight logging
3. Quick message endpoints
4. Coach aggregation endpoint
5. Demo seed script and data polish
6. Final permission/stability pass
