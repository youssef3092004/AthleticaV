# Getting Started Guide

A practical guide for new developers to set up AthleticaV locally and understand the project structure.

## Prerequisites

Before you begin, ensure you have installed:

- **Node.js 18+** → [Download](https://nodejs.org/)
- **PostgreSQL 14+** → [Download](https://www.postgresql.org/download/)
- **Git** → [Download](https://git-scm.com/)
- **Postman** (optional) → [Download](https://www.postman.com/downloads/)

Check versions:

```bash
node --version     # Should be v18+
npm --version      # Comes with Node
psql --version     # Should be 14+
```

---

## 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/youssef3092004/AthleticaV.git
cd AthleticaV

# Install dependencies
npm install

# Generates Prisma Client types automatically (runs in postinstall)
```

---

## 2. Database Setup

### Option A: Local PostgreSQL (Development)

**1. Create a local database**

```bash
# Access PostgreSQL
psql -U postgres

# Inside psql prompt:
CREATE DATABASE athleticav_dev;
\q
```

**2. Create `.env.local` file**

```bash
# In project root
cat > .env.local << EOF
DATABASE_URL="postgresql://postgres:password@localhost:5432/athleticav_dev"
JWT_SECRET="dev-secret-key-change-in-production"
NODE_ENV="development"
EOF
```

Replace `password` with your PostgreSQL password.

**3. Run migrations**

```bash
npm run prisma:dev:migrate -- --name initial
```

This creates all tables based on the schema.

**4. Seed test data**

```bash
npm run seed:all
```

Now you have:

- Sample trainers, clients, admins
- Pre-built meal/workout templates
- Exercise and food catalogs
- Role and permission data

### Option B: Supabase (Cloud Database)

If you prefer cloud hosting:

**1. Create [Supabase](https://supabase.io) project**

**2. Get connection string from Supabase dashboard**

**3. Create `.env.local`**

```bash
DATABASE_URL="postgresql://[user]:[password]@db.supabase.co:5432/postgres"
JWT_SECRET="your-secret-here"
NODE_ENV="development"
```

**4. Run migrations**

```bash
npm run prisma:dev:migrate -- --name initial
```

---

## 3. Start Development Server

```bash
npm run dev
```

You should see:

```
Database connected successfully
Server listening on port 3000
```

Visit `http://localhost:3000` to verify it's running.

---

## 4. Test Authentication

Get a token so you can test endpoints:

```bash
# Register as trainer
curl -X POST http://localhost:3000/auth/register/trainer \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trainer@test.com",
    "password": "Test123!",
    "firstName": "John",
    "lastName": "Coach"
  }'

# Response includes: { success: true, message: "...", user: {...} }

# Login to get JWT token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trainer@test.com",
    "password": "Test123!"
  }'

# Response: { success: true, token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

Copy the `token` value. You'll use it in subsequent requests.

---

## 5. Make Your First API Call

```bash
# Save token to variable
TOKEN="your-token-from-login"

# Get your profile
curl -X GET http://localhost:3000/users/your-user-id \
  -H "Authorization: Bearer $TOKEN"

# Response: { success: true, data: { id: "...", email: "...", roles: [...] } }
```

✅ **Success!** You're connected to the API.

---

## 6. Explore the Project Structure

### Key Directories

```
.
├── controllers/          ← Business logic (36 modules)
├── routes/               ← HTTP endpoint definitions (36 modules)
├── middleware/           ← Request interceptors (auth, permissions, errors)
├── utils/                ← Shared helpers (auth, validation, websocket)
├── configs/              ← App configuration (database, RBAC)
├── prisma/
│   ├── schema.prisma     ← Database schema definition
│   └── migrations/       ← Schema change history
├── scripts/              ← Data seeding and imports
├── docs/                 ← Documentation files
└── server.js             ← Express app entry point
```

### Example: How Routes Work

**File:** [routes/mealPlan.js](../../routes/mealPlan.js)

```javascript
import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import * as mealPlanController from "../controllers/mealPlan.js";

const router = Router();

// Create meal plan
router.post(
  "/",
  verifyToken, // ← Verify JWT
  checkPermission("CREATE-MEAL_PLAN"), // ← Check permission
  mealPlanController.create, // ← Call controller
);

// Get meal plan
router.get("/:id", verifyToken, mealPlanController.getById);

export default router;
```

**How it works:**

1. Request comes in → `verifyToken` extracts JWT
2. `checkPermission` checks if user has `CREATE-MEAL_PLAN`
3. If yes → passes to controller
4. Controller does business logic + database calls
5. Returns response

---

## 7. Understanding Controllers

**File:** [controllers/mealPlan.js](../../controllers/mealPlan.js)

```javascript
// Step 1: Local validation helpers

const normalizePlanStatus = (value, fallback = "DRAFT") => {
  if (!ALLOWED_PLAN_STATUSES.includes(value)) {
    throw new AppError("Invalid status", 400);
  }
  return value;
};

// Step 2: Exported handler functions

export const create = async (req, res, next) => {
  try {
    // Validate input
    const { name, clientId, startDate } = req.body;
    validateMealPlanInput({ name, clientId, startDate });

    // Authorization (who has access?)
    const authz = await getUserAccessContext(req);
    ensureHasAnyRole(authz, ["TRAINER"], "Only trainers can create plans");

    // Business logic
    const mealPlan = await prisma.mealPlan.create({
      data: {
        name,
        clientId,
        trainerId: authz.trainerId,
        startDate: new Date(startDate),
        status: "DRAFT",
      },
      select: { id: true, name: true, status: true },
    });

    // Return response
    res.json({ success: true, data: mealPlan });
  } catch (err) {
    next(err); // ← Pass to error handler
  }
};
```

**Key Pattern:**

1. **Validate** input (type, range, format)
2. **Authorize** (does user have permission?)
3. **Execute** (Prisma calls, calculations)
4. **Respond** (structured JSON response)
5. **Error Handle** (pass to middleware)

### Error Handling

```javascript
// Domain/validation errors → use AppError
if (!email) {
  throw new AppError("Email is required", 400);
}

// Unexpected errors → pass to middleware
try {
  await database.connect();
} catch (err) {
  next(err); // Middleware converts to 500
}
```

**Response format:**

```json
{
  "success": false,
  "message": "Validation error: Email is required",
  "statusCode": 400
}
```

---

## 8. Database Queries: Prisma Basics

### Create

```javascript
const plan = await prisma.mealPlan.create({
  data: {
    name: "Cutting Phase",
    trainerId: "trainer-123",
    clientId: "client-456",
    startDate: new Date("2026-04-01"),
    status: "DRAFT",
  },
  select: { id: true, name: true, created: true },
});
```

### Read

```javascript
// Get one
const plan = await prisma.mealPlan.findUnique({
  where: { id: "plan-123" },
});

// Get many with filters
const plans = await prisma.mealPlan.findMany({
  where: {
    trainerId: "trainer-123",
    status: { in: ["ACTIVE", "DRAFT"] },
  },
  orderBy: { createdAt: "desc" },
  take: 10, // Pagination
});
```

### Update

```javascript
const updated = await prisma.mealPlan.update({
  where: { id: "plan-123" },
  data: { status: "ACTIVE" },
  select: { id: true, status: true },
});
```

### Delete

```javascript
await prisma.mealPlan.delete({
  where: { id: "plan-123" },
});
```

### Transactions (Multiple operations)

```javascript
const result = await prisma.$transaction(async (tx) => {
  // All succeed or all fail
  const plan = await tx.mealPlan.create({ data: {...} });
  await tx.mealPlanDay.create({ data: {...} });
  await tx.mealPlanDay.create({ data: {...} });
  return plan;
});
```

**Why:** If add mealPlanDay fails, plan creation is rolled back.

---

## 9. Common Development Tasks

### Add a New Endpoint

**Example:** Add trainer income endpoint

**1. Update schema** (if needed)

```bash
# Edit prisma/schema.prisma
nano prisma/schema.prisma

# Add/change models
# Then:
npm run prisma:dev:migrate -- --name add_income_tracking
```

**2. Create route**

```javascript
// routes/trainerIncome.js
import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import { checkPermission } from "../middleware/checkPermission.js";
import * as controller from "../controllers/trainerIncome.js";

const router = Router();

router.get(
  "/monthly",
  verifyToken,
  checkPermission("READ-INCOME"),
  controller.getMonthlyIncome,
);

export default router;
```

**3. Create controller**

```javascript
// controllers/trainerIncome.js
import { prisma } from "../configs/db.js";
import { AppError } from "../utils/appError.js";
import { getUserAccessContext } from "../utils/authz.js";

export const getMonthlyIncome = async (req, res, next) => {
  try {
    const authz = await getUserAccessContext(req);
    ensureHasAnyRole(authz, ["TRAINER"], "Only trainers");

    const income = await prisma.transaction.groupBy({
      by: ["createdAt"], // Group by date
      where: { trainerId: authz.trainerId },
      _sum: { amount: true },
    });

    res.json({ success: true, data: income });
  } catch (err) {
    next(err);
  }
};
```

**4. Register route** (in server.js)

```javascript
import trainerIncomeRoutes from "./routes/trainerIncome.js";
app.use("/api/trainer-income", trainerIncomeRoutes);
```

**5. Test**

```bash
npm run dev

curl -X GET http://localhost:3000/api/trainer-income/monthly \
  -H "Authorization: Bearer $TOKEN"
```

### Modify Existing Feature

**Example:** Change meal plan status validation

**1. Find controller**
Open [controllers/mealPlan.js](../../controllers/mealPlan.js)

**2. Locate validation**
Find `normalizePlanStatus()` function

**3. Update logic**
Add new status or change validation

**4. Test**

```bash
npm run dev
# Test via Postman or curl
```

### Fix a Bug

**1. Locate error in logs**

```bash
npm run dev
# Watch terminal
```

**2. Search codebase**

```bash
grep -r "error text" .
```

**3. Check controller/middleware**
Open file from grep results

**4. Add debugging**

```javascript
console.log("Debug:", variable); // Temporary
```

**5. Test**

```bash
npm run dev
```

---

## 10. Documentation Map

| Need                    | File                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Project overview        | [README.md](../../README.md)                                                              |
| Complex logic explained | [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md)                            |
| All modules reference   | [MODULES-REFERENCE.md](MODULES-REFERENCE.md)                                              |
| Meal planning details   | [README.md → Meal Planning](../../README.md#meal-planning-system)                         |
| RBAC implementation     | [ARCHITECTURE-COMPLEX-LOGIC.md → RBAC](ARCHITECTURE-COMPLEX-LOGIC.md#rbac-implementation) |
| Auth flows              | [README.md → Authentication](../../README.md#authentication--authorization)               |
| Testing endpoints       | [TESTING-QUICK-START.md](TESTING-QUICK-START.md)                                          |
| Prisma migrations       | [prisma-migration-workflow.md](prisma-migration-workflow.md)                              |
| Messaging system        | [MESSAGING-README.md](MESSAGING-README.md)                                                |

---

## 11. Troubleshooting

### Port 3000 already in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

Or use different port:

```bash
PORT=3001 npm run dev
```

### Database connection refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix:**

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Or on Linux:
sudo systemctl start postgresql

# Verify connection:
psql -U postgres -d athleticav_dev
```

### Prisma schema mismatch

```
Error: The provided database string is invalid
```

**Fix:**

- Verify `.env.local` has correct DATABASE_URL
- Check database exists: `psql -l` should list it
- Run migrations: `npm run prisma:dev:migrate`

### JWT token expired

```
Error: Token expired, please login again
```

**Fix:**

```bash
# Get new token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'
```

### Permission denied on endpoint

```
Error: Forbidden — insufficient permissions
```

**Fix:**

- Check user roles: `GET /users/:id`
- Verify role has permission: `GET /roles/:id`
- Grant permission: `POST /role-permissions` (admin)

---

## 12. Next Steps

1. **Read the code:** Pick one controller and read it top-to-bottom
2. **Trace a flow:** Follow an API request from route → controller → response
3. **Add a feature:** Create a simple new endpoint (e.g., user profile photo)
4. **Review docs:** Read [ARCHITECTURE-COMPLEX-LOGIC.md](ARCHITECTURE-COMPLEX-LOGIC.md) for deep dives
5. **Test thoroughly:** Use Postman to test all your changes

---

## Resources

- **Node.js docs:** https://nodejs.org/docs/
- **Express guide:** https://expressjs.com/
- **Prisma docs:** https://www.prisma.io/docs/
- **PostgreSQL guide:** https://www.postgresql.org/docs/

---

**Ready to code?** Start with the [README.md](../../README.md) then pick a module from [MODULES-REFERENCE.md](MODULES-REFERENCE.md) to explore.
