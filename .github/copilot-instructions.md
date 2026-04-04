# Project Guidelines

## Code Style

- Use ESM modules (`import`/`export`) with `.js` files.
- Follow existing controller shape: local validation helpers at top, then exported handlers.
- Use `AppError` from `utils/appError.js` for domain/validation errors and pass unexpected errors to `next(error)`.
- Keep Prisma `select` minimal and explicit; avoid returning full related objects unless needed.

## Architecture

- API structure is route -> middleware -> controller.
- Route files in `routes/` should remain thin: auth, permission guard, handler mapping.
- Business logic and Prisma calls belong in `controllers/`.
- Shared authz checks belong in `utils/authz.js` (`getUserAccessContext`, role/ownership guards).
- Prisma schema is source of truth in `prisma/schema.prisma`.

## Build and Test

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Run production-style server: `npm start`
- Prisma migrate (dev DB): `npm run prisma:dev:migrate -- --name <change_name>`
- Prisma deploy (remote DB): `npm run prisma:prod:deploy`
- Seed data: `npm run seed:all`

## Conventions

- Keep permission checks in routes with `checkPermission("<ACTION-RESOURCE>")`.
- Use role + ownership checks in controllers for sensitive operations.
- For list endpoints, use `pagination(req, defaults)` from `utils/pagination.js`.
- For multi-step writes, use `prisma.$transaction`.
- Meal/workout patterns should mirror existing examples:
  - `controllers/mealPlan.js`
  - `controllers/mealTemplate.js`
  - `controllers/workoutItem.js`

## Prisma and Migration Notes

- Use `.env.local` with `prisma migrate dev` for local migration iteration.
- Do not run `prisma migrate dev` against remote/prod databases.
- `createMany({ skipDuplicates: true })` only deduplicates when a matching unique DB constraint exists.
- `onDelete: SetNull` requires optional FK fields in Prisma relations.

## References

- Migration workflow: `docs/prisma-migration-workflow.md`
- API overview and setup: `README.md`
