import "dotenv/config";
import { prisma } from "../configs/db.js";
import process from "process";
import {
  RBAC_PERMISSIONS,
  RBAC_ROLES,
  ROLE_PERMISSION_MAP,
} from "../configs/rbac.js";

const upsertRoles = async () => {
  const roleRecords = await Promise.all(
    RBAC_ROLES.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  return new Map(roleRecords.map((role) => [role.name, role.id]));
};

const upsertPermissions = async () => {
  const permissionRecords = await Promise.all(
    RBAC_PERMISSIONS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key },
      }),
    ),
  );

  return new Map(
    permissionRecords.map((permission) => [permission.key, permission.id]),
  );
};

const syncRolePermissions = async (roleIdByName, permissionIdByKey) => {
  for (const roleName of Object.keys(ROLE_PERMISSION_MAP)) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) continue;

    const permissionIds = ROLE_PERMISSION_MAP[roleName]
      .map((permissionKey) => permissionIdByKey.get(permissionKey))
      .filter(Boolean);

    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
  }
};

const main = async () => {
  if (
    !process.env.PRISMA_URL &&
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_PRISMA_URL &&
    !process.env.POSTGRES_URL_NON_POOLING &&
    !process.env.POSTGRES_URL
  ) {
    throw new Error(
      "Database URL is missing. Set one of PRISMA_URL, DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL in .env before running seed:rbac",
    );
  }

  const roleIdByName = await upsertRoles();
  const permissionIdByKey = await upsertPermissions();

  await syncRolePermissions(roleIdByName, permissionIdByKey);

  console.log("RBAC seed completed successfully");
};

main()
  .catch((error) => {
    if (error?.code === "P1010") {
      console.error(
        "RBAC seed failed: database access denied (P1010). Check PRISMA_URL/DATABASE_URL credentials and ensure the DB user has INSERT/UPDATE/DELETE privileges on roles, permissions, and role_permissions.",
      );
    }
    console.error("RBAC seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
