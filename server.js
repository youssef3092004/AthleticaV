import "dotenv/config";
import process from "process";
import express from "express";
import { connectDB } from "./configs/db.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

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
import workoutRoutes from "./routes/workout.js";
import permissionRoutes from "./routes/permission.js";
import rolePermissionRoutes from "./routes/rolePermission.js";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/permissions", permissionRoutes);
app.use("/api/v1/role-permissions", rolePermissionRoutes);
app.use("/api/v1/user-permissions", userPermissionRoutes);
app.use("/api/v1/trainer-profiles", trainerProfileRoutes);
app.use("/api/v1/trainer-clients", trainerClientRoutes);
app.use("/api/v1/workout-templates", workoutTemplateRoutes);
app.use("/api/v1/workouts", workoutRoutes);

// Error Handling Middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
