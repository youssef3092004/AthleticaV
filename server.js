import "dotenv/config";
import process from "process";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import xss from "xss";
import { connectDB } from "./configs/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { initializeWebSocket } from "./utils/websocket.js";

const app = express();

const sanitizeValue = (value) => {
  if (typeof value === "string") return xss(value);

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry));
  }

  if (value && typeof value === "object") {
    const sanitized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      sanitized[key] = sanitizeValue(nestedValue);
    }
    return sanitized;
  }

  return value;
};

const sanitizeObjectInPlace = (target) => {
  if (!target || typeof target !== "object") return target;

  for (const [key, nestedValue] of Object.entries(target)) {
    if (typeof nestedValue === "string") {
      target[key] = xss(nestedValue);
      continue;
    }

    if (Array.isArray(nestedValue)) {
      target[key] = nestedValue.map((entry) => sanitizeValue(entry));
      continue;
    }

    if (nestedValue && typeof nestedValue === "object") {
      sanitizeObjectInPlace(nestedValue);
    }
  }

  return target;
};

const rateLimitWindowMs = Number(
  process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000,
);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 600);
const slowDownAfter = Number(process.env.SLOW_DOWN_AFTER || 120);

const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests, please try again shortly.",
  },
});

const apiSpeedLimiter = slowDown({
  windowMs: rateLimitWindowMs,
  delayAfter: slowDownAfter,
  delayMs: (hits) => Math.min((hits - slowDownAfter + 1) * 50, 1000),
});

app.use(helmet());
const allowedOrigins = new Set([
  "https://athletica-six.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "null",
]);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    sanitizeObjectInPlace(req.body);
  }

  if (req.query && typeof req.query === "object") {
    sanitizeObjectInPlace(req.query);
  }

  next();
});
app.use("/api/v1", apiSpeedLimiter, apiLimiter);

const PORT = process.env.PORT || 3000;

// Create HTTP server with Socket.IO
const httpServer = http.createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
});
// Initialize WebSocket handlers
initializeWebSocket(io);

// database connection

await connectDB();
app.get("/", (req, res) => {
  res.send("Welcome to Athletica API");
});

// Routes
import authRoutes from "./routes/auth.js";
import roleRoutes from "./routes/role.js";
import userRoutes from "./routes/user.js";
import userPermissionRoutes from "./routes/userPermission.js";
import trainerProfileRoutes from "./routes/trainerProfile.js";
import trainerClientRoutes from "./routes/trainerClient.js";
import workoutTemplateRoutes from "./routes/workoutTemplate.js";
import workoutTemplateDayRoutes from "./routes/workoutTemplateDay.js";
import workoutTemplateItemRoutes from "./routes/workoutTemplateItem.js";
import workoutRoutes from "./routes/workout.js";
import programRoutes from "./routes/program.js";
import workoutDayRoutes from "./routes/workoutDay.js";
import workoutItemRoutes from "./routes/workoutItem.js";
import workoutCompletionRoutes from "./routes/workoutCompletion.js";
import exerciseRoutes from "./routes/exercise.js";
import permissionRoutes from "./routes/permission.js";
import rolePermissionRoutes from "./routes/rolePermission.js";
import foodRoutes from "./routes/food.js";
import progressRoutes from "./routes/progress.js";
import clientProfileRoutes from "./routes/clientProfile.js";
import mealTemplateRoutes from "./routes/mealTemplate.js";
import mealTemplateDayRoutes from "./routes/mealTemplateDay.js";
import mealTemplateDayItemRoutes from "./routes/mealTemplateItem.js";
import mealPlanRoutes from "./routes/mealPlan.js";
import mealPlanDayRoutes from "./routes/mealPlanDay.js";
import mealPlanItemRoutes from "./routes/mealPlanItem.js";
import mealCompletionRoutes from "./routes/mealCompletion.js";
import clientIntakeRoutes from "./routes/clientIntake.js";
import trainerClientInviteRoutes from "./routes/trainerClientInvite.js";
import trainerInviteCodeRoutes from "./routes/trainerInviteCode.js";
import messageRoutes from "./routes/message.js";
import conversationRoutes from "./routes/conversation.js";
import transactionRoutes from "./routes/transaction.js";
import trainerWalletRoutes from "./routes/trainerWallet.js";
import payoutRoutes from "./routes/payout.js";
import activityLogRoutes from "./routes/activityLog.js";
import quotationRoutes from "./routes/quotation.js";
import trainerQuestionRoutes from "./routes/trainerQuestion.js";
import checkInRoutes from "./routes/checkIn.js";
import nutritionRoutes from "./routes/nutrition.js";
import streakRoutes from "./routes/streak.js";
// import paymentRoutes from "./payments/paymob.routes.js";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/role-permissions", rolePermissionRoutes);
app.use("/api/v1/user-permissions", userPermissionRoutes);
app.use("/api/v1/trainer-profiles", trainerProfileRoutes);
app.use("/api/v1/trainer-clients", trainerClientRoutes);
app.use("/api/v1/workout-templates", workoutTemplateRoutes);
app.use("/api/v1/workout-template-days", workoutTemplateDayRoutes);
app.use("/api/v1/workout-template-items", workoutTemplateItemRoutes);
app.use("/api/v1/workouts", workoutRoutes);
app.use("/api/v1/programs", programRoutes);
app.use("/api/v1/workout-days", workoutDayRoutes);
app.use("/api/v1/workout-items", workoutItemRoutes);
app.use("/api/v1/workout-completions", workoutCompletionRoutes);
app.use("/api/v1/exercises", exerciseRoutes);
app.use("/api/v1/foods", foodRoutes);
app.use("/api/v1/progress", progressRoutes);
app.use("/api/v1/client-profiles", clientProfileRoutes);
app.use("/api/v1/templates", mealTemplateRoutes);
app.use("/api/v1/templates/days", mealTemplateDayRoutes);
app.use("/api/v1/templates/items", mealTemplateDayItemRoutes);
app.use("/api/v1/meal-plans", mealPlanRoutes);
app.use("/api/v1/meal-plans/days", mealPlanDayRoutes);
app.use("/api/v1/meal-plans/items", mealPlanItemRoutes);
app.use("/api/v1/meal-completions", mealCompletionRoutes);
app.use("/api/v1/client-intake", clientIntakeRoutes);
app.use("/api/v1/client-invites", trainerClientInviteRoutes);
app.use("/api/v1/trainer-invite-codes", trainerInviteCodeRoutes);
app.use("/api/v1/conversations", conversationRoutes);
app.use("/api/v1/messages", messageRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/trainer-wallets", trainerWalletRoutes);
app.use("/api/v1/payouts", payoutRoutes);
app.use("/api/v1/activity-logs", activityLogRoutes);
app.use("/api/v1/quotations", quotationRoutes);
app.use("/api/v1/trainer-questions", trainerQuestionRoutes);
app.use("/api/v1/check-ins", checkInRoutes);
app.use("/api/v1/nutrition", nutritionRoutes);
app.use("/api/v1/streaks", streakRoutes);
// app.use("/api/v1/payments", paymentRoutes);

// Error Handling Middleware
app.use(errorHandler);

if (process.env.VERCEL !== "1") {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket ready for real-time messaging`);
  });
}

app.use((req, res, next) => {
  console.log("🔥 HIT:", req.method, req.url);
  next();
});

app.get("/api/v1/test", (req, res) => {
  res.json({ success: true, message: "API is working!" });
});

export default app;
