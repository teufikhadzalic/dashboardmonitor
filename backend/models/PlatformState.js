const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    instanceId: { type: String, default: '' },
    status: { type: String, enum: ["up", "deg", "down"], default: "up" },
    cpu: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 },
  },
  { _id: false }
);

const instanceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    platform: { type: String, default: '' },
    hostname: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    os: { type: String, default: '' },
    osVersion: { type: String, default: '' },
    architecture: { type: String, default: '' },
    datacenter: { type: String, default: '' },
    region: { type: String, default: '' },
    zone: { type: String, default: '' },
    environment: { type: String, default: '' },
    status: { type: String, enum: ["healthy", "warning", "critical"], default: "healthy" },
    serviceStatus: { type: String, enum: ["online", "offline", "degraded"], default: "online" },
    cpu: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    diskUsage: { type: Number, default: 0 },
    latency: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 },
    requestRate: { type: Number, default: 0 },
    activeConnections: { type: Number, default: 0 },
    networkThroughput: { type: Number, default: 0 },
    lastRestart: { type: Date },
    metrics: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    reasons: { type: [String], default: [] },
  },
  { _id: false },
);

const platformMetricSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    shortName: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    nodeStatus: { type: String, enum: ["online", "warning", "critical", "offline"], default: "online" },
    status: { type: String, enum: ["healthy", "warning", "critical"], default: "healthy" },
    cpu: { type: Number, default: 0 },
    ram: { type: Number, default: 0 },
    latency: { type: Number, default: 0 },
    diskAvailableDays: { type: Number, default: 30 },
    instances: { type: [instanceSchema], default: [] },
    aggregate: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    reasons: { type: [String], default: [] },
    services: { type: [serviceSchema], default: [] },
    security: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const securitySchema = new mongoose.Schema(
  {
    sessionsBypassingPAM: { type: Number, default: 0 },
    outOfHoursAccess: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    blockedThreats: { type: Number, default: 0 },
  },
  { _id: false }
);

const platformStateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    platforms: { type: [platformMetricSchema], default: [] },
    security: { type: securitySchema, default: () => ({}) },
    summary: {
      type: {
        overallHealth: { type: String, default: "healthy" },
        onlineNodes: { type: Number, default: 0 },
        warningNodes: { type: Number, default: 0 },
        criticalNodes: { type: Number, default: 0 },
        totalPlatforms: { type: Number, default: 0 },
        healthyPlatforms: { type: Number, default: 0 },
        warningPlatforms: { type: Number, default: 0 },
        criticalPlatforms: { type: Number, default: 0 },
        totalInstances: { type: Number, default: 0 },
        healthyInstances: { type: Number, default: 0 },
        warningInstances: { type: Number, default: 0 },
        criticalInstances: { type: Number, default: 0 },
      },
      default: () => ({})
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformState", platformStateSchema);
