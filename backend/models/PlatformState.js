const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    status: { type: String, enum: ["up", "deg", "down"], default: "up" },
    cpu: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    uptime: { type: Number, default: 0 },
  },
  { _id: false }
);

const platformMetricSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    shortName: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    nodeStatus: { type: String, enum: ["online", "warning", "offline"], default: "online" },
    status: { type: String, enum: ["healthy", "warning", "critical"], default: "healthy" },
    cpu: { type: Number, default: 0 },
    ram: { type: Number, default: 0 },
    latency: { type: Number, default: 0 },
    diskAvailableDays: { type: Number, default: 30 },
    services: { type: [serviceSchema], default: [] },
    security: {
      type: {
        sessionsBypassingPAM: { type: Number, default: 0 },
        outOfHoursAccess: { type: Number, default: 0 },
      },
      default: () => ({})
    },
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
      },
      default: () => ({})
    },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PlatformState", platformStateSchema);
