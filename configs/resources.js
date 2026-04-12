const normalizeResourceName = (value) =>
  String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const createCrudResource = ({ model, ownerFields = [], permissions = {} }) => ({
  model,
  ownerFields,
  permissions: {
    create: permissions.create || [],
    view: permissions.view || [],
    update: permissions.update || [],
    delete: permissions.delete || [],
  },
});

const RESOURCE_CONFIGS = {
  users: createCrudResource({
    model: "user",
    ownerFields: ["id"],
    permissions: {
      create: ["CREATE-USERS"],
      view: ["VIEW-USERS"],
      update: ["UPDATE-USERS"],
      delete: ["DELETE-USERS"],
    },
  }),
  clientprofiles: createCrudResource({
    model: "clientProfile",
    ownerFields: ["clientId"],
    permissions: {
      create: ["CREATE-CLIENT-PROFILES"],
      view: ["VIEW-CLIENT-PROFILES"],
      update: ["UPDATE-CLIENT-PROFILES"],
      delete: ["DELETE-CLIENT-PROFILES"],
    },
  }),
  trainerprofiles: createCrudResource({
    model: "trainerProfile",
    ownerFields: ["userId"],
    permissions: {
      create: ["CREATE-TRAINER-PROFILES"],
      view: ["VIEW-TRAINER-PROFILES"],
      update: ["UPDATE-TRAINER-PROFILES"],
      delete: ["DELETE-TRAINER-PROFILES"],
    },
  }),
  trainerclients: createCrudResource({
    model: "trainerClient",
    ownerFields: ["trainerId", "clientId"],
    permissions: {
      create: ["CREATE-TRAINER-CLIENTS"],
      view: ["VIEW-TRAINER-CLIENTS"],
      update: ["UPDATE-TRAINER-CLIENTS"],
      delete: ["DELETE-TRAINER-CLIENTS"],
    },
  }),
  workouts: createCrudResource({
    model: "workout",
    ownerFields: ["trainerId"],
    permissions: {
      create: ["CREATE-WORKOUTS"],
      view: ["VIEW-WORKOUTS"],
      update: ["UPDATE-WORKOUTS"],
      delete: ["DELETE-WORKOUTS"],
    },
  }),
  workouttemplates: createCrudResource({
    model: "workoutTemplate",
    ownerFields: ["trainerId"],
    permissions: {
      create: ["CREATE-WORKOUT-TEMPLATES"],
      view: ["VIEW-WORKOUT-TEMPLATES"],
      update: ["UPDATE-WORKOUT-TEMPLATES"],
      delete: ["DELETE-WORKOUT-TEMPLATES"],
    },
  }),
  meals: createCrudResource({
    model: "mealPlan",
    ownerFields: ["trainerId"],
    permissions: {
      create: ["CREATE-MEAL-PLANS"],
      view: ["VIEW-MEAL-PLANS"],
      update: ["UPDATE-MEAL-PLANS"],
      delete: ["DELETE-MEAL-PLANS"],
    },
  }),
  mealtemplates: createCrudResource({
    model: "mealTemplate",
    ownerFields: ["trainerId"],
    permissions: {
      create: ["CREATE-MEAL-TEMPLATES"],
      view: ["VIEW-MEAL-TEMPLATES"],
      update: ["UPDATE-MEAL-TEMPLATES"],
      delete: ["DELETE-MEAL-TEMPLATES"],
    },
  }),
  progress: createCrudResource({
    model: "progressMetric",
    ownerFields: ["clientId"],
    permissions: {
      create: ["CREATE-PROGRESS"],
      view: ["VIEW-PROGRESS"],
      update: ["UPDATE-PROGRESS"],
      delete: ["DELETE-PROGRESS"],
    },
  }),
  transactions: createCrudResource({
    model: "transaction",
    ownerFields: ["clientId", "trainerId"],
    permissions: {
      create: ["CREATE-TRANSACTIONS"],
      view: ["VIEW-TRANSACTIONS"],
      update: ["UPDATE-TRANSACTIONS"],
      delete: ["DELETE-TRANSACTIONS"],
    },
  }),
  trainerwallets: createCrudResource({
    model: "trainerWallet",
    ownerFields: ["trainerId"],
    permissions: {
      create: ["CREATE-TRAINER-WALLETS"],
      view: ["VIEW-TRAINER-WALLETS"],
      update: ["UPDATE-TRAINER-WALLETS"],
      delete: ["DELETE-TRAINER-WALLETS"],
    },
  }),
  payouts: createCrudResource({
    model: "payout",
    ownerFields: ["trainerId"],
    permissions: {
      create: ["CREATE-PAYOUTS"],
      view: ["VIEW-PAYOUTS"],
      update: ["UPDATE-PAYOUTS"],
      delete: ["DELETE-PAYOUTS"],
    },
  }),
  activitylogs: createCrudResource({
    model: "activityLog",
    ownerFields: ["userId"],
    permissions: {
      create: ["CREATE-ACTIVITY-LOGS"],
      view: ["VIEW-ACTIVITY-LOGS"],
      update: ["UPDATE-ACTIVITY-LOGS"],
      delete: ["DELETE-ACTIVITY-LOGS"],
    },
  }),
  permissions: createCrudResource({
    model: "permission",
    ownerFields: [],
    permissions: {
      create: ["CREATE-PERMISSIONS"],
      view: ["VIEW-PERMISSIONS"],
      update: ["UPDATE-PERMISSIONS"],
      delete: ["DELETE-PERMISSIONS"],
    },
  }),
  roles: createCrudResource({
    model: "role",
    ownerFields: [],
    permissions: {
      create: ["CREATE-ROLES"],
      view: ["VIEW-ROLES"],
      update: ["UPDATE-ROLES"],
      delete: ["DELETE-ROLES"],
    },
  }),
};

export const getResourceConfig = (resourceName) => {
  if (!resourceName) return null;
  return RESOURCE_CONFIGS[normalizeResourceName(resourceName)] || null;
};
