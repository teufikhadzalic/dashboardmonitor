const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const { Server } = require("socket.io");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const { requireAuth, verifyToken } = require("./middleware/auth");
const { bootstrapSuperuser } = require("./utils/bootstrapAdmin");
const { createDashboardService } = require("./services/dashboardService");
const { createPlatformController } = require("./controllers/platformController");
const { createPlatformRoutes } = require("./routes/platformRoutes");
const { createMockDataApiClient } = require("./services/mockDataApiClient");

const PORT = Number(process.env.PORT) || 3000;
const DASHBOARD_REFRESH_INTERVAL_MS = 10000;

function configuredRefreshInterval() {
  const configuredValue = process.env.DASHBOARD_REFRESH_INTERVAL_MS;
  if (configuredValue === undefined || configuredValue.trim() === "") {
    return DASHBOARD_REFRESH_INTERVAL_MS;
  }

  const interval = Number(configuredValue);
  if (!Number.isSafeInteger(interval) || interval < 1000) {
    throw new RangeError("DASHBOARD_REFRESH_INTERVAL_MS must be an integer of at least 1000");
  }
  return interval;
}

function createApplication({
  dashboardService = createDashboardService({
    mockDataApiClient: createMockDataApiClient({
      baseUrl: process.env.MOCK_DATA_API_URL || undefined,
    }),
  }),
} = {}) {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
    },
  });

  const platformController = createPlatformController(dashboardService);
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
    try {
      socket.emit("dashboard:update", dashboardService.getDashboard());
    } catch (error) {
      console.warn("Dashboard snapshot unavailable for new socket client:", error.message);
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

  return { app, server, io, dashboardService };
}

const application = createApplication();
const { app, server, io, dashboardService } = application;

async function startServer() {
  const refreshInterval = configuredRefreshInterval();
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("Connected to MongoDB Atlas");
    } catch (error) {
      console.warn("MongoDB connection failed; using the in-memory user store.", error.message);
    }
  } else {
    console.warn("MONGODB_URI is not set; using the in-memory user store.");
  }

  await bootstrapSuperuser();
  try {
    const snapshot = await dashboardService.refresh();
    io.emit("dashboard:update", snapshot);
  } catch (error) {
    console.error("Initial Mock Data API refresh failed:", error.message);
  }
  const refreshTimer = setInterval(async () => {
    try {
      const snapshot = await dashboardService.refresh();
      io.emit("dashboard:update", snapshot);
    } catch (error) {
      console.error("Dashboard refresh from Mock Data API failed:", error.message);
    }
  }, refreshInterval);
  refreshTimer.unref();
  server.on("close", () => clearInterval(refreshTimer));

  server.listen(PORT, () => {
    console.log(`CS-ASOP dashboard API listening on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  dashboardService,
  createApplication,
  startServer,
  DASHBOARD_REFRESH_INTERVAL_MS,
  configuredRefreshInterval,
};