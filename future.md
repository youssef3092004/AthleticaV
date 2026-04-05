# Future Work

## Access Control Hardening

- Run a full endpoint-by-endpoint authorization audit.
- Mark each route as: scoped correctly, needs tightening, or admin-only.
- Standardize ownership checks across controllers using shared authz helpers.

## Automated Tests

- Add authorization tests for TRAINER, CLIENT, ADMIN, and DEVELOPER roles.
- Add negative tests to ensure users cannot access unrelated user data.
- Add regression tests for trainer-client relationship checks.

## Refactoring

- Centralize repeated role/ownership logic into reusable utilities.
- Reduce duplicated per-controller access checks where possible.
- Keep route-level permissions and controller-level ownership checks aligned.

## Documentation

- Document expected data visibility for each role.
- Add examples of allowed vs forbidden access for key endpoints.
