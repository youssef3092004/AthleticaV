import "dotenv/config";
import process from "process";
import http from "http";
import express from "express";
import { Server } from "socket.io";
import { connectDB } from "./configs/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { initializeWebSocket } from "./utils/websocket.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Create HTTP server with Socket.IO
const httpServer = http.createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
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

// Error Handling Middleware
app.use(errorHandler);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket ready for real-time messaging`);
});
