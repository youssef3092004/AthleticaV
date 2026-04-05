# Trainer Invite Flow: From Code Generation to TrainerClient Relation

This document explains the current production logic from trainer code generation until a client is linked to a trainer in `TrainerClient`, including status transitions after linking.

## 1) Data Model Roles

## `TrainerInviteCode` (one per trainer)

- Purpose: permanent reusable code owned by a trainer.
- Key fields:
  - `trainerId` (unique)
  - `code` (unique)
  - `totalClients` (denormalized counter)

## `TrainerClientInvite` (history/events)

- Purpose: stores invite usage and registration history per client.
- Key fields:
  - `trainerId`
  - `inviteCodeId`
  - `usedByClientId`
  - `status` (`PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELLED`)
  - optional client metadata + timestamps

## `TrainerClient` (real business relation)

- Purpose: canonical trainer-client relationship used by the app.
- Key fields:
  - `trainerId`
  - `clientId`
  - `status` (`ACTIVE`, `PAUSED`, `ENDED`)
- Unique pair constraint: one row per `(trainerId, clientId)`.

## 2) Step A: Trainer Generates/Reuses Code

Endpoint:

- `POST /api/v1/trainer-invite-codes/`

Security:

- Requires auth token.
- Requires permission `CREATE-TRAINER-CLIENTS`.
- Trainer can generate only for self (unless privileged role).

Controller behavior:

1. Resolve `trainerId` from authenticated user context.
2. Validate trainer user exists.
3. Try loading existing `TrainerInviteCode` by `trainerId`.
4. If found: return existing code (`reusedExistingCode=true`).
5. If not found:
   - generate formatted code (`ATHLI` + trainer first-name token + numeric sequence from 100)
   - create new `TrainerInviteCode` row
   - initialize `totalClients` from current `TrainerClient` count.
6. Build `inviteLink` by appending `code=<inviteCode>` to configured frontend base URL.

Result:

- Trainer receives a stable reusable code + invite link.

## 3) Step B: Client Verifies Code (Optional Frontend Validation)

Endpoint:

- `GET /api/v1/client-invites/verify/:code`

Behavior:

1. Normalize input code (trim + uppercase).
2. Find code in `TrainerInviteCode`.
3. Return `trainerId`, `code`, `totalClients` if valid.
4. Return 404 if invalid.

Result:

- Frontend can verify code before registration submit.

## 4) Step C: Client Registers Using Invite Code

Endpoint:

- `POST /api/v1/auth/register/client` (client registration handler)

Behavior when `code` exists in request:

1. Normalize invite code.
2. Validate invite code exists in `TrainerInviteCode`.
3. Create client user and client profile.
4. Create `TrainerClientInvite` history row with:
   - `trainerId` from invite code owner
   - `inviteCodeId`
   - `usedByClientId` = new client id
   - `status = PENDING`
   - snapshot client metadata.
5. Return registration response with invite context.

Result:

- Client account exists.
- Invite request is queued as pending approval.
- No `TrainerClient` relation is created yet.

## 5) Step D: Trainer Reviews Pending Invites

Endpoint:

- `GET /api/v1/client-invites/`

Behavior:

- Trainer fetches invite history for own trainer scope.
- Supports paging/filtering/sorting and status filters.
- Used to view pending invite requests and history.

Result:

- Trainer sees pending rows and can choose whom to approve.

## 6) Step E: Trainer Approves by Client ID

Endpoint:

- `POST /api/v1/client-invites/approve/:clientId`

Security:

- Requires auth token.
- Requires permission `CREATE-TRAINER-CLIENTS`.
- Scope-enforced to authenticated trainer unless privileged.

Transactional behavior:

1. Find pending invite row where:
   - `trainerId` = authenticated trainer
   - `usedByClientId` = `:clientId`
   - `status = PENDING`
2. Ensure client user exists.
3. Upsert `TrainerClient` by `(trainerId, clientId)`:
   - create or update with `status = PAUSED`
   - update `startedAt`.
4. Recompute trainer client count and update `TrainerInviteCode.totalClients`.
5. Update invite row to:
   - `status = ACCEPTED`
   - `usedAt = now`
   - fill missing client metadata from user record.
6. Return `invite`, `totalClients`, and `trainerClient` (including `trainerClient.id`).

Result:

- Real trainer-client relation is established in `TrainerClient`.
- Initial relation status is `PAUSED`.

## 7) Post-Link Status Progression (After Relation Exists)

After approval, status can be managed via trainer-client endpoints:

- Activate relation: `PATCH /api/v1/trainer-clients/updateStatusToActive/:id`
- Pause relation: `PATCH /api/v1/trainer-clients/updateStatusToPaused/:id`
- End relation: `PATCH /api/v1/trainer-clients/updateStatusToEnded/:id`

Typical lifecycle:

1. `PENDING` invite history row
2. Trainer approval
3. `TrainerClient` created as `PAUSED`
4. Later switched to `ACTIVE` when business conditions are met (for example payment confirmation)
5. Can transition to `ENDED` when relationship closes.

## 8) State Transition Summary

Invite-history status (`TrainerClientInvite`):

- `PENDING` -> `ACCEPTED`
- `EXPIRED` and `CANCELLED` reserved for future lifecycle handling

Relation status (`TrainerClient`):

- Created/updated at approval as `PAUSED`
- Can transition to `ACTIVE` or `ENDED` through trainer-client status endpoints

## 9) Why This Design

- Keeps one permanent trainer code (`TrainerInviteCode`) instead of generating a new code per invite.
- Preserves per-client audit/history in `TrainerClientInvite`.
- Separates registration intent (`PENDING`) from actual business relation (`TrainerClient`).
- Supports controlled activation timing by starting approved relations in `PAUSED`.
