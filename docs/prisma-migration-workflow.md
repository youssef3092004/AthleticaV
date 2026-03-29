# Prisma Migration Workflow

This project should use separate migration flows for development and deployment.

## Why

`prisma migrate dev` is intentionally heavy: it creates a shadow DB, checks drift, applies SQL, and regenerates client.
Running this against a remote DB is slow and can time out.

## Recommended setup

- `.env.local`: local development database URL (fast)
- `.env`: staging/production or shared remote DB
- Optional: `PRISMA_MIGRATE_URL` for a direct non-pooled Postgres URL during migration

If `PRISMA_MIGRATE_URL` is present, migration scripts automatically use it as `DATABASE_URL`.

## Commands

Development (local DB):

```bash
npm run prisma:dev:status
npm run prisma:dev:migrate -- --name add_meal_indexes
npm run prisma:dev:reset
npm run prisma:dev:studio
```

Deployment (remote DB):

```bash
npm run prisma:prod:status
npm run prisma:prod:deploy
```

## Rules

1. Use `prisma:dev:migrate` only for development databases.
2. Never run `migrate dev` against production.
3. Use `prisma:prod:deploy` in CI/CD for production.
4. Commit generated migration files in `prisma/migrations`.

## Typical flow

1. Edit `prisma/schema.prisma`
2. Run:

```bash
npm run prisma:dev:migrate -- --name your_change_name
```

3. Test locally.
4. Commit schema + migrations.
5. On server/CI run:

```bash
npm run prisma:prod:deploy
```
