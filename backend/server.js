const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const { Server } = require("socket.io");
const PlatformState = require("./models/PlatformState");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const { requireAuth, verifyToken } = require("./middleware/auth");
const { bootstrapSuperuser } = require("./utils/bootstrapAdmin");
const { createDashboardService } = require("./services/dashboardService");
const { createPlatformController } = require("./controllers/platformController");
const { createPlatformRoutes } = require("./routes/platformRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = Number(process.env.PORT) || 3000;
const tickMs = 3000;
const dashboardService = createDashboardService({ PlatformState, mongoose });
const platformController = createPlatformController(dashboardService);

async function bootstrapSimulation() {
  const snapshot = await dashboardService.bootstrap();
  io.emit("dashboard:update", snapshot);
  return snapshot;
}

async function tickSimulation() {
  try {
    const snapshot = await dashboardService.update();
    io.emit("dashboard:update", snapshot);
    return snapshot;
  } catch (error) {
    console.error("Simulation tick failed:", error);
  }
}

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", createPlatformRoutes(platformController, requireAuth));

app.get("/api/health", (req, res) => {
  res.json({ service: "cs-asop-dashboard-api", status: "ok", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

io.on("connection", (socket) => {
  console.log("Client connected to CS-ASOP stream");

  const dashboard = dashboardService.getDashboard();
  if (dashboard) {
    socket.emit("dashboard:update", dashboard);
  }

  socket.on("disconnect", () => {
    console.log("Client disconnected from CS-ASOP stream");
  });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    socket.user = verifyToken(token);
    return next();
  } catch (error) {
    return next(new Error("Authentication required"));
  }
});

async function startServer() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB Atlas");
    } catch (error) {
      console.warn("MongoDB connection failed; using in-memory simulation state.", error.message);
    }
  } else {
    console.warn("MONGODB_URI is not set; using in-memory simulation state.");
  }

  await bootstrapSuperuser();
  await bootstrapSimulation();
  setInterval(() => tickSimulation(), tickMs);

  server.listen(PORT, () => {
    console.log(`CS-ASOP dashboard API listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, tickSimulation, bootstrapSimulation };