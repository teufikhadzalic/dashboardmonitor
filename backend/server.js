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
const { createDashboardState } = require("./utils/platformHealth");

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

const state = { tick: 0, latest: null };
const defaultBaseline = createDashboardState({ platforms: [] }, 0);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadBaselineState() {
  if (mongoose.connection.readyState !== 1) {
    return deepClone(defaultBaseline);
  }

  const existing = await PlatformState.findOne({ name: "cs-asop-platform-baseline" }).lean();
  if (existing?.platforms?.length === 9 && existing.platforms.every((platform) => platform.instances?.length === 10)) {
    return existing;
  }

  const created = await PlatformState.create(defaultBaseline);
  return created.toObject();
}

function generateDashboardSnapshot(previousSnapshot = defaultBaseline) {
  state.tick += 1;
  const next = createDashboardState(previousSnapshot, state.tick);
  return next;
}

async function persistDashboard(snapshot) {
  if (mongoose.connection.readyState !== 1) {
    return snapshot;
  }

  const result = await PlatformState.findOneAndUpdate(
    { name: "cs-asop-platform-baseline" },
    {
      $set: {
        platforms: snapshot.platforms,
        security: snapshot.security,
        summary: snapshot.summary,
        updatedAt: snapshot.updatedAt,
      },
    },
    { upsert: true, new: true }
  );

  return result.toObject();
}

async function bootstrapSimulation() {
  const baseline = await loadBaselineState();
  state.latest = generateDashboardSnapshot(baseline);
  state.latest = await persistDashboard(state.latest);
  io.emit("dashboard:update", state.latest);
}

async function tickSimulation() {
  try {
    if (!state.latest) {
      await bootstrapSimulation();
      return;
    }

    const nextSnapshot = generateDashboardSnapshot(state.latest);
    state.latest = await persistDashboard(nextSnapshot);
    io.emit("dashboard:update", state.latest);
  } catch (error) {
    console.error("Simulation tick failed:", error);
  }
}

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ service: "cs-asop-dashboard-api", status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/dashboard", requireAuth, (req, res) => {
  const snapshot = state.latest || defaultBaseline;
  res.json({ dashboard: snapshot });
});

app.get("/api/platforms", requireAuth, (req, res) => {
  const snapshot = state.latest || defaultBaseline;
  res.json({ platforms: snapshot.platforms });
});

app.get("/api/platform/:id", requireAuth, (req, res) => {
  const platform = (state.latest?.platforms || defaultBaseline.platforms).find((entry) => entry.id === req.params.id);
  if (!platform) {
    return res.status(404).json({ error: "Platform not found" });
  }

  return res.json({ platform });
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

  if (state.latest) {
    socket.emit("dashboard:update", state.latest);
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