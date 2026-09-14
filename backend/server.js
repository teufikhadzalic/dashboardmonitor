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
    instances: [],
    aggregate: {},
    reasons: [],
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

const thresholds = {
  cpu: { warning: 70, critical: 85 },
  memory: { warning: 75, critical: 85 },
  latency: { warning: 100, critical: 200 },
  errorRate: { warning: 1, critical: 5 },
  diskUsage: { warning: 80, critical: 92 },
};

const securityProfiles = {
  iga: { failedLogins: [8, 58], provisioningFailures: [0, 5], syncHealth: [96, 100], reviewCoverage: [91, 100] },
  pam: { sessionCount: [80, 320], bypassAttempts: [0, 3], privilegedSessions: [35, 180], breakGlassSessions: [0, 2], outOfHoursAccess: [4, 34], credentialRotation: [92, 100] },
  mfa: { authAttempts: [800, 4200], mfaFailures: [4, 140], bypassAttempts: [0, 2], pushFatigueEvents: [0, 4] },
  "ad-entra": { syncFailures: [0, 4], replicationLag: [2, 48], failedLogins: [6, 54], coverage: [94, 100] },
  sase: { activeSessions: [240, 1200], authenticationFailures: [2, 32], policyDenies: [12, 160], ztnaFailures: [0, 8], throughput: [180, 900] },
  siem: { ingestionRate: [14000, 48000], processingLatency: [20, 180], logSourcesOnline: [94, 100], ingestionFailures: [0, 4], parserFailures: [0, 3], detectionEvents: [20, 230], retentionHeadroom: [45, 90] },
  tip: { feedsOnline: [92, 100], indicatorsIngested: [1200, 8800], enrichmentFailures: [0, 4], staleFeeds: [0, 2], blockedThreats: [12, 180] },
  soar: { activePlaybooks: [4, 38], executionLatency: [20, 160], successfulJobs: [90, 100], failedJobs: [0, 6], pendingJobs: [0, 12], responseActions: [20, 180] },
  ansible: { jobQueue: [0, 18], executionTime: [30, 240], successfulJobs: [88, 100], failedJobs: [0, 7], patchCompliance: [88, 100], hardeningCompliance: [90, 100], pendingJobs: [0, 15] },
};

function average(values) {
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

function valueFor(range) {
  return randomBetween(range[0], range[1]);
}

function instanceStatus(instance) {
  const reasons = [];
  if (instance.cpu >= thresholds.cpu.critical) reasons.push("CPU exceeds critical threshold");
  else if (instance.cpu >= thresholds.cpu.warning) reasons.push("CPU exceeds warning threshold");
  if (instance.memory >= thresholds.memory.critical) reasons.push("Memory exceeds critical threshold");
  else if (instance.memory >= thresholds.memory.warning) reasons.push("Memory exceeds warning threshold");
  if (instance.latency >= thresholds.latency.critical) reasons.push("Latency exceeds critical threshold");
  else if (instance.latency >= thresholds.latency.warning) reasons.push("Latency exceeds warning threshold");
  if (instance.errorRate >= thresholds.errorRate.critical) reasons.push("Error rate exceeds critical threshold");
  else if (instance.errorRate >= thresholds.errorRate.warning) reasons.push("Error rate is elevated");
  if (instance.diskUsage >= thresholds.diskUsage.critical) reasons.push("Disk headroom is critically low");
  else if (instance.diskUsage >= thresholds.diskUsage.warning) reasons.push("Disk headroom is low");
  Object.entries(instance.metrics).forEach(([key, value]) => {
    if (["bypassAttempts", "pushFatigueEvents", "breakGlassSessions", "outOfHoursAccess", "ingestionFailures", "parserFailures", "failedJobs", "pendingJobs", "failedLogins"].includes(key) && value >= 5) reasons.push(`${key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)} are elevated`);
  });
  if (instance.serviceStatus !== "online") reasons.push("Service process is not online");
  const critical = reasons.some((reason) => reason.includes("critical") || reason.includes("not online"));
  return { status: critical ? "critical" : reasons.length ? "warning" : "healthy", reasons: reasons.length ? reasons : ["All monitored telemetry is within configured thresholds"] };
}

function buildInstance(platform, index, previous) {
  const id = `${platform.shortName.replace(/[^A-Z0-9]/gi, "").toUpperCase()}-${String(index + 1).padStart(2, "0")}`;
  const previousMetrics = previous ?? {};
  const instance = {
    id,
    cpu: clamp((previous?.cpu ?? randomBetween(28, 68)) + randomBetween(-7, 8), 12, 98),
    memory: clamp((previous?.memory ?? randomBetween(32, 70)) + randomBetween(-6, 7), 18, 98),
    diskUsage: clamp((previous?.diskUsage ?? randomBetween(34, 76)) + randomBetween(-3, 4), 20, 98),
    latency: clamp((previous?.latency ?? randomBetween(24, 92)) + randomBetween(-12, 16), 8, 280),
    errorRate: clamp(Math.round(((previous?.errorRate ?? randomBetween(0, 9) / 10) + randomBetween(-3, 4) / 10) * 10) / 10, 0, 9),
    uptime: (previous?.uptime ?? randomBetween(8, 46)) + 0.05,
    requestRate: clamp((previous?.requestRate ?? randomBetween(320, 2200)) + randomBetween(-180, 220), 40, 5000),
    serviceStatus: previous?.serviceStatus === "offline" && Math.random() > 0.35 ? "online" : "online",
    metrics: {},
  };
  const profile = securityProfiles[platform.id] ?? {};
  Object.entries(profile).forEach(([key, range]) => {
    instance.metrics[key] = valueFor(previousMetrics[key] ? [Math.max(range[0], previousMetrics[key] - 8), Math.min(range[1], previousMetrics[key] + 8)] : range);
  });
  if (platform.id === "iga" && index === 2) Object.assign(instance, { cpu: 92, memory: 86, latency: 62, errorRate: 2.1, metrics: { ...instance.metrics, failedLogins: 17 } });
  if (platform.id === "pam" && index === 3) Object.assign(instance.metrics, { bypassAttempts: 12, breakGlassSessions: 4, outOfHoursAccess: 31 });
  if (platform.id === "siem" && index === 4) Object.assign(instance.metrics, { logSourcesOnline: 82, ingestionFailures: 8, parserFailures: 7, retentionHeadroom: 18 });
  const health = instanceStatus(instance);
  return { ...instance, status: health.status, reasons: health.reasons };
}

function aggregatePlatform(platform, instances) {
  const aggregate = {
    cpu: average(instances.map((instance) => instance.cpu)),
    memory: average(instances.map((instance) => instance.memory)),
    latency: average(instances.map((instance) => instance.latency)),
    errorRate: average(instances.map((instance) => instance.errorRate)),
    diskUsage: average(instances.map((instance) => instance.diskUsage)),
    requestRate: Math.round(instances.reduce((total, instance) => total + instance.requestRate, 0)),
  };
  Object.keys(instances[0]?.metrics ?? {}).forEach((key) => { aggregate[key] = average(instances.map((instance) => Number(instance.metrics[key]) || 0)); });
  const critical = instances.filter((instance) => instance.status === "critical").length;
  const warning = instances.filter((instance) => instance.status === "warning").length;
  const reasons = [...new Set(instances.flatMap((instance) => instance.reasons).filter((reason) => !reason.startsWith("All monitored")))].slice(0, 3);
  return { aggregate, status: critical ? "critical" : warning ? "warning" : "healthy", nodeStatus: critical ? "critical" : warning ? "warning" : "online", reasons: reasons.length ? reasons : ["All monitored instances are within configured thresholds"] };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
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
  if (existing?.platforms?.length === 9 && existing.platforms.every((platform) => platform.instances?.length === 10)) {
    return existing;
  }

  const created = await PlatformState.create(defaultBaseline);
  return created.toObject();
}

function generateDashboardSnapshot(previousSnapshot = defaultBaseline) {
  const tick = state.tick + 1;
  state.tick = tick;

  const next = deepClone(previousSnapshot);
  next.platforms = next.platforms.map((platform) => {
    const instances = Array.from({ length: 10 }, (_, index) => buildInstance(platform, index, platform.instances?.[index]));
    const result = aggregatePlatform(platform, instances);
    const services = (platform.services ?? []).map((service) => ({
      ...service,
      cpu: clamp(Math.round(result.aggregate.cpu + randomBetween(-15, 12)), 5, 98),
      memory: clamp(Math.round(result.aggregate.memory / 2 + randomBetween(-8, 8)), 5, 90),
      status: result.status === "critical" && service.id === "splunkd-indexing" ? "deg" : "up",
    }));
    return { ...platform, ...result.aggregate, ram: result.aggregate.memory, diskAvailableDays: Math.round(100 - result.aggregate.diskUsage), instances, ...result, services };
  });

  const aggregateSecurity = {
    sessionsBypassingPAM: Math.round(next.platforms.find((platform) => platform.id === "pam")?.aggregate.bypassAttempts ?? 0),
    outOfHoursAccess: Math.round(next.platforms.find((platform) => platform.id === "pam")?.aggregate.outOfHoursAccess ?? 0),
    failedLogins: Math.round(next.platforms.find((platform) => platform.id === "iga")?.aggregate.failedLogins ?? 0),
    blockedThreats: Math.round(next.platforms.find((platform) => platform.id === "tip")?.aggregate.blockedThreats ?? 0),
  };

  next.security = aggregateSecurity;
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