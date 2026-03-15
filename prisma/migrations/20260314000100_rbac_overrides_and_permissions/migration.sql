-- Permission setup for route-level RBAC guards.
-- Supports both legacy table name "Permission" (from old migrations)
-- and mapped table name "permissions" (from current Prisma schema).
DO $$
DECLARE
  permission_key TEXT;
  permission_keys TEXT[] := ARRAY[
    'VIEW-ME',
    'VIEW-USERS',
    'UPDATE-USERS',
    'DELETE-USERS',
    'CREATE-ROLES',
    'VIEW-ROLES',
    'UPDATE-ROLES',
    'DELETE-ROLES',
    'CREATE-PERMISSIONS',
    'VIEW-PERMISSIONS',
    'UPDATE-PERMISSIONS',
    'DELETE-PERMISSIONS',
    'CREATE-ROLE-PERMISSIONS',
    'VIEW-ROLE-PERMISSIONS',
    'UPDATE-ROLE-PERMISSIONS',
    'DELETE-ROLE-PERMISSIONS',
    'CREATE-TRAINER-PROFILES',
    'VIEW-TRAINER-PROFILES',
    'UPDATE-TRAINER-PROFILES',
    'DELETE-TRAINER-PROFILES',
    'CREATE-TRAINER-CLIENTS',
    'VIEW-TRAINER-CLIENTS',
    'UPDATE-TRAINER-CLIENTS',
    'DELETE-TRAINER-CLIENTS',
    'CREATE-WORKOUT-TEMPLATES',
    'VIEW-WORKOUT-TEMPLATES',
    'UPDATE-WORKOUT-TEMPLATES',
    'DELETE-WORKOUT-TEMPLATES',
    'CREATE-WORKOUTS',
    'VIEW-WORKOUTS',
    'UPDATE-WORKOUTS',
    'DELETE-WORKOUTS'
  ];
BEGIN
  IF to_regclass('"permissions"') IS NOT NULL THEN
    FOREACH permission_key IN ARRAY permission_keys
    LOOP
      EXECUTE 'INSERT INTO "permissions" ("key") VALUES ($1) ON CONFLICT ("key") DO NOTHING'
      USING permission_key;
    END LOOP;
  ELSIF to_regclass('"Permission"') IS NOT NULL THEN
    FOREACH permission_key IN ARRAY permission_keys
    LOOP
      EXECUTE 'INSERT INTO "Permission" ("id", "key") VALUES ($1, $2) ON CONFLICT ("key") DO NOTHING'
      USING md5(random()::text || clock_timestamp()::text || permission_key), permission_key;
    END LOOP;
  ELSE
    RAISE EXCEPTION 'No permission table found (expected "permissions" or "Permission")';
  END IF;
END $$;
