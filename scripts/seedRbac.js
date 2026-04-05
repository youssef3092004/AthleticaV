import "dotenv/config";
import { prisma } from "../configs/db.js";
import process from "process";
import {
  RBAC_PERMISSIONS,
  RBAC_ROLES,
  ROLE_PERMISSION_MAP,
} from "../configs/rbac.js";

const ROLE_SEED_DATA = [
  { idx: 0, id: "2fafbe3d-6069-43ad-8cc5-6f93170025de", name: "SUPPORT" },
  { idx: 1, id: "4933e25a-5861-4478-8947-3456759d2dc5", name: "OWNER" },
  { idx: 2, id: "5120385b-6f92-4de0-89db-58043a0775d8", name: "DEVELOPER" },
  { idx: 3, id: "670e8a6e-98dd-4270-b651-0d2923cbda1c", name: "CLIENT" },
  { idx: 4, id: "b0fd6da3-def3-4448-8eb5-03e043219551", name: "TRAINER" },
  { idx: 5, id: "b8c3e936-0b8c-4a3c-a134-671294e3cbd9", name: "ADMIN" },
];

const upsertRoles = async () => {
  const roleRecords = [];

  for (const role of ROLE_SEED_DATA) {
    const existing = await prisma.role.findUnique({
      where: { name: role.name },
      select: { id: true, name: true },
    });

    if (existing) {
      if (existing.id !== role.id) {
        console.warn(
          `Role ${role.name} already exists with id ${existing.id}; keeping existing id instead of creating a new one.`,
        );
      }

      roleRecords.push(existing);
      continue;
    }

    const created = await prisma.role.create({
      data: {
        id: role.id,
        name: role.name,
      },
      select: { id: true, name: true },
    });

    roleRecords.push(created);
  }

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
