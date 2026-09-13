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

const platformCatalog = [
  { id: "iga", shortName: "IGA", name: "Identity Governance & Administration", role: "Identity Governance", cpu: 44, ram: 56, latency: 38, diskAvailableDays: 53, services: [{ id: "identity-sync", name: "identity sync", status: "up", cpu: 35, memory: 24, uptime: 1900 }, { id: "entitlement-calc", name: "entitlement calc", status: "up", cpu: 31, memory: 18, uptime: 1650 },], },
  { id: "pam", shortName: "PAM", name: "Privileged Access Management", role: "Privileged Access", cpu: 61, ram: 58, latency: 52, diskAvailableDays: 46, services: [{ id: "vault-rotation", name: "vault rotation", status: "up", cpu: 42, memory: 28, uptime: 2000 }, { id: "just-in-time", name: "just-in-time approvals", status: "up", cpu: 36, memory: 22, uptime: 1760 },], },
  { id: "mfa", shortName: "MFA", name: "Multi-Factor Authentication", role: "Authentication", cpu: 49, ram: 54, latency: 33, diskAvailableDays: 58, services: [{ id: "otp-issuer", name: "otp issuer", status: "up", cpu: 40, memory: 23, uptime: 1800 }, { id: "push-verify", name: "push verification", status: "up", cpu: 33, memory: 19, uptime: 1660 },], },
  { id: "ad-entra", shortName: "AD / Entra", name: "Active Directory / Entra", role: "Directory Services", cpu: 57, ram: 62, latency: 44, diskAvailableDays: 50, services: [{ id: "ldap-replication", name: "ldap replication", status: "up", cpu: 45, memory: 28, uptime: 1500 }, { id: "group-sync", name: "group sync", status: "up", cpu: 36, memory: 25, uptime: 1710 },], },
  { id: "sase", shortName: "SASE", name: "Secure Access Service Edge", role: "Secure Edge", cpu: 68, ram: 66, latency: 60, diskAvailableDays: 44, services: [{ id: "ztna-gateway", name: "ztna gateway", status: "up", cpu: 51, memory: 31, uptime: 2100 }, { id: "proxy-policy", name: "proxy policy", status: "up", cpu: 45, memory: 27, uptime: 1840 },], },
  { id: "siem", shortName: "SIEM", name: "Security Information & Event Management", role: "Detection & Correlation", cpu: 72, ram: 69, latency: 75, diskAvailableDays: 42, services: [{ id: "splunkd-indexing", name: "splunkd — indexing", status: "up", cpu: 63, memory: 41, uptime: 2380 }, { id: "rule-engine", name: "rule engine", status: "up", cpu: 48, memory: 26, uptime: 1910 },], },
  { id: "tip", shortName: "TIP", name: "Threat Intelligence Platform", role: "Threat Intelligence", cpu: 51, ram: 57, latency: 48, diskAvailableDays: 55, services: [{ id: "intel-ingest", name: "intel ingest", status: "up", cpu: 38, memory: 23, uptime: 1780 }, { id: "feed-correlation", name: "feed correlation", status: "up", cpu: 34, memory: 20, uptime: 1620 },], },
  { id: "soar", shortName: "SOAR", name: "Security Orchestration, Automation & Response", role: "Automation & Response", cpu: 63, ram: 65, latency: 58, diskAvailableDays: 47, services: [{ id: "playbook-runner", name: "playbook runner", status: "up", cpu: 42, memory: 26, uptime: 1860 }, { id: "ticketing-loop", name: "ticketing loop", status: "up", cpu: 37, memory: 22, uptime: 1700 },], },
  { id: "ansible", shortName: "Ansible", name: "Ansible Automation", role: "Hardening & Patch", cpu: 58, ram: 60, latency: 46, diskAvailableDays: 52, services: [{ id: "patch-runner", name: "patch runner", status: "up", cpu: 39, memory: 24, uptime: 1960 }, { id: "hardening-policy", name: "hardening policy", status: "up", cpu: 35, memory: 18, uptime: 1750 },], },
];

const defaultBaseline = {
  name: "cs-asop-platform-baseline",
  platforms: platformCatalog.map((platform) => ({
    ...platform,
    nodeStatus: "online",
    status: "healthy",
    security: {
      sessionsBypassingPAM: platform.id === "pam" || platform.id === "mfa" ? 2 : 1,
      outOfHoursAccess: platform.id === "pam" ? 18 : 9,
    },
  })),
  security: {
    sessionsBypassingPAM: 2,
    outOfHoursAccess: 18,
    failedLogins: 12,
    blockedThreats: 230,
  },
  summary: {
    overallHealth: "healthy",
    onlineNodes: 9,
    warningNodes: 0,
    criticalNodes: 0,
  },
  updatedAt: new Date().toISOString(),
};

const state = { tick: 0, latest: null };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function calculatePlatformStatus(cpu, ram, diskAvailableDays) {
  if (diskAvailableDays <= 28 || cpu >= 82 || ram >= 87) return "warning";
  if (diskAvailableDays <= 18 || cpu >= 92 || ram >= 95) return "critical";
  return "healthy";
}

function buildSummary(platforms, security) {
  const onlineNodes = platforms.filter((platform) => platform.nodeStatus === "online").length;
  const warningNodes = platforms.filter((platform) => platform.nodeStatus === "warning").length;
  const criticalNodes = platforms.filter((platform) => platform.nodeStatus === "critical").length;

  let overallHealth = "healthy";
  if (criticalNodes > 0 || security.sessionsBypassingPAM >= 6 || security.outOfHoursAccess >= 30) {
    overallHealth = "critical";
  } else if (warningNodes > 0 || security.sessionsBypassingPAM >= 4 || security.outOfHoursAccess >= 20) {
    overallHealth = "warning";
  }

  return { overallHealth, onlineNodes, warningNodes, criticalNodes };
}

async function loadBaselineState() {
  if (mongoose.connection.readyState !== 1) {
    return deepClone(defaultBaseline);
  }

  const existing = await PlatformState.findOne({ name: "cs-asop-platform-baseline" }).lean();
  if (existing?.platforms?.length === 9) {
    return existing;
  }

  const created = await PlatformState.create(defaultBaseline);
  return created.toObject();
}

function generateDashboardSnapshot(previousSnapshot = defaultBaseline) {
  const tick = state.tick + 1;
  state.tick = tick;

  const next = deepClone(previousSnapshot);
  const anomalyCycle = tick % 5 === 0;
  const siemDegenerate = tick % 3 === 0 || Math.random() < 0.15;

  next.platforms = next.platforms.map((platform) => {
    const cpu = clamp(platform.cpu + randomBetween(-12, 14), 18, 96);
    const ram = clamp(platform.ram + randomBetween(-10, 14), 18, 96);
    const latency = clamp(platform.latency + randomBetween(-18, 26), 12, 200);
    let diskAvailableDays = clamp(platform.diskAvailableDays + randomBetween(-7, 10), 18, 90);
    const status = calculatePlatformStatus(cpu, ram, diskAvailableDays);

    let nodeStatus = status === "healthy" ? "online" : status === "warning" ? "warning" : "critical";

    if (platform.id === "ansible") {
      diskAvailableDays = anomalyCycle ? 28 : clamp(diskAvailableDays, 28, 90);
      nodeStatus = diskAvailableDays <= 30 ? "warning" : nodeStatus;
    }

    const services = (platform.services ?? []).map((service) => {
      const serviceCpu = clamp(service.cpu + randomBetween(-20, 20), 10, 90);
      const memory = clamp(service.memory + randomBetween(-12, 12), 10, 75);
      let serviceStatus = service.status;

      if (platform.id === "siem" && service.id === "splunkd-indexing" && (siemDegenerate || anomalyCycle)) {
        serviceStatus = "deg";
      }

      if (platform.id === "pam" && service.id === "just-in-time" && anomalyCycle) {
        serviceStatus = "down";
      }

      return { ...service, cpu: serviceCpu, memory, status: serviceStatus };
    });

    const security = {
      sessionsBypassingPAM: platform.id === "pam" || platform.id === "mfa" ? clamp((platform.security?.sessionsBypassingPAM ?? 2) + randomBetween(-1, 2), 1, 7) : 1,
      outOfHoursAccess: platform.id === "pam" ? clamp((platform.security?.outOfHoursAccess ?? 18) + randomBetween(-5, 7), 8, 38) : 9,
    };

    if (platform.id === "pam" && anomalyCycle) {
      security.sessionsBypassingPAM = 6;
      security.outOfHoursAccess = 31;
    }

    return {
      ...platform,
      cpu,
      ram,
      latency,
      diskAvailableDays,
      nodeStatus,
      status,
      services,
      security,
    };
  });

  const aggregateSecurity = {
    sessionsBypassingPAM: anomalyCycle ? 6 : clamp(Math.max(...next.platforms.map((platform) => platform.security.sessionsBypassingPAM)) + randomBetween(-2, 2), 1, 7),
    outOfHoursAccess: anomalyCycle ? 31 : clamp(Math.max(...next.platforms.map((platform) => platform.security.outOfHoursAccess)) + randomBetween(-7, 9), 10, 42),
    failedLogins: clamp((next.security?.failedLogins ?? 12) + randomBetween(-5, 9), 8, 45),
    blockedThreats: clamp((next.security?.blockedThreats ?? 230) + randomBetween(-20, 35), 160, 320),
  };

  next.security = aggregateSecurity;
  next.platforms = next.platforms.map((platform) => ({
    ...platform,
    security: {
      sessionsBypassingPAM: platform.id === "pam" || platform.id === "mfa" ? aggregateSecurity.sessionsBypassingPAM : 1,
      outOfHoursAccess: platform.id === "pam" ? aggregateSecurity.outOfHoursAccess : 9,
    },
  }));

  next.summary = buildSummary(next.platforms, aggregateSecurity);
  next.updatedAt = new Date().toISOString();
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