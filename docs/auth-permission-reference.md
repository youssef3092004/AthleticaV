# Auth and Permission Reference

Use this file as the starting point when resuming work on authentication, role handling, ownership checks, or route permission wiring.

## Current Direction

- Login and token verification now normalize the authenticated user into role-based identity fields.
- A user can be represented with role aliases such as `trainerId`, `clientId`, `developerId`, `supportId`, `adminId`, and `ownerId` when their roles include those values.
- Shared permission checks still run through `middleware/checkPermission.js`.
- Shared ownership checks still run through `middleware/checkOwnership.js`.
- Generic resource authorization is available through `middleware/resourceAccess.js` and `configs/resources.js`.

## Important Files

- `controllers/auth.js`
  - Login payload now includes normalized role context.
- `middleware/auth.js`
  - Token verification rewrites `req.user` into a consistent role-aware structure.
- `utils/authz.js`
  - Shared helpers for role normalization and access context.
- `middleware/checkPermission.js`
  - Loads user roles and permissions, then attaches the normalized identity context.
- `middleware/checkOwnership.js`
  - Generic ownership middleware used by several routes.
- `middleware/resourceAccess.js`
  - Generic route-to-resource authorization helper.
- `configs/resources.js`
  - Resource registry used by `authorizeResource`.

## Routes Currently Wired With Shared Ownership

- `routes/clientProfile.js`
- `routes/trainerProfile.js`
- `routes/mealPlan.js`
- `routes/transaction.js`
- `routes/trainerWallet.js`
- `routes/workout.js`
- `routes/progress.js`
- `routes/trainerClient.js`

## Notes To Remember

- The route-level ownership checks are intentionally duplicated in some controllers for complex flows.
- That duplication is safe, but if you want the code simpler later, move ownership enforcement to one layer only.
- The `resourceAccess` middleware depends on `configs/resources.js`; keep them in sync.
- If a route changes its parameter name, update the matching `checkOwnership({ paramKey: ... })` entry.

## Quick Resume Checklist

1. Check whether the target endpoint should use only permission checks or permission plus ownership.
2. Confirm the route parameter name matches the ownership middleware `paramKey`.
3. Confirm the controller still expects the same role-aware request shape.
4. Run the project error check before finishing.

## Related Files

- `routes/auth.js`
- `routes/user.js`
- `routes/message.js`
- `routes/conversation.js`
- `controllers/message.js`
- `controllers/conversation.js`
