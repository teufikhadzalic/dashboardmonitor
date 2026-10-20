const {
  buildDashboardSecurity,
  buildDashboardSummary,
  buildPlatformSecurityValues,
  evaluateInstanceHealth,
  evaluatePlatformHealth,
  PLATFORM_DEFINITIONS,
} = require("../utils/platformHealth");
const { MockDataApiError } = require("./mockDataApiClient");

const TELEMETRY_HISTORY_LIMIT = 300;

class DashboardDataUnavailableError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "DashboardDataUnavailableError";
  }
}

function latestTelemetryByInstance(records) {
  const latest = new Map();
  for (const record of records) {
    if (!record || typeof record.instance !== "string" || !Number.isFinite(Date.parse(record.timestamp))) {
      throw new MockDataApiError("Mock Data API returned a telemetry record without a valid instance or timestamp");
    }

    const current = latest.get(record.instance);
    if (!current || Date.parse(record.timestamp) > Date.parse(current.timestamp)) {
      latest.set(record.instance, record);
    }
  }
  return latest;
}

function createDashboardService({ mockDataApiClient }) {
  let latestDashboard = null;
  let refreshInProgress = null;

  async function fetchPlatform(sourcePlatform) {
    const [platformDetails, sourceInstances, sourceTelemetry] = await Promise.all([
      mockDataApiClient.getPlatform(sourcePlatform.id),
      mockDataApiClient.getInstances(sourcePlatform.id),
      mockDataApiClient.getTelemetry(sourcePlatform.id, { limit: TELEMETRY_HISTORY_LIMIT }),
    ]);
    const definition = PLATFORM_DEFINITIONS.find(({ id }) => id === sourcePlatform.id);
    const telemetryByInstance = latestTelemetryByInstance(sourceTelemetry);
    const instances = sourceInstances.map((sourceInstance) => {
      const telemetryHistory = sourceTelemetry
        .filter(({ instance }) => instance === sourceInstance.id)
        .sort((first, second) => Date.parse(second.timestamp) - Date.parse(first.timestamp));
      const current = telemetryByInstance.get(sourceInstance.id);
      if (!current) {
        throw new MockDataApiError(`Mock Data API has no telemetry for instance ${sourceInstance.id}`);
      }
      if (!Number.isFinite(current.cpu_current) || !Number.isFinite(current.memory_current)) {
        throw new MockDataApiError(`Mock Data API returned invalid CPU or memory telemetry for instance ${sourceInstance.id}`);
      }

      return {
        id: sourceInstance.id,
        platform: definition?.shortName || sourcePlatform.shortName,
        hostname: sourceInstance.hostname,
        ipAddress: sourceInstance.ipAddress,
        os: sourceInstance.os,
        osVersion: sourceInstance.osVersion,
        architecture: sourceInstance.architecture,
        datacenter: sourceInstance.datacenter,
        region: sourceInstance.region,
        zone: sourceInstance.zone,
        environment: sourceInstance.environment,
        status: "healthy",
        serviceStatus: String(sourceInstance.status || platformDetails.status || "UP").toLowerCase() === "down"
          || String(platformDetails.status || "UP").toLowerCase() === "down"
          ? "down"
          : "up",
        serviceStatusReason: sourceInstance.statusReason || "Mock Data API availability check passed",
        availabilityCheck: sourceInstance.availabilityCheck || "Mock Data API",
        cpu: current.cpu_current,
        cpuAverage: current.cpu_average,
        memory: current.memory_current,
        memoryAverage: current.memory_average,
        availability: current.availability,
        diskUsage: current.disk_usage,
        latency: current.latency,
        errorRate: current.error_rate,
        uptime: sourceInstance.uptime,
        requestRate: current.request_rate,
        activeConnections: current.active_connections,
        networkThroughput: current.network_throughput,
        lastRestart: sourceInstance.lastRestart,
        telemetry: telemetryHistory,
        metrics: current.security_metrics || {},
      };
    });

    if (!instances.length) {
      throw new MockDataApiError(`Mock Data API returned no instances for platform ${sourcePlatform.id}`);
    }

    const evaluatedInstances = instances.map((instance) => ({
      ...instance,
      ...evaluateInstanceHealth(instance),
    }));
    const health = evaluatePlatformHealth({ instances: evaluatedInstances });
    const security = buildPlatformSecurityValues(sourcePlatform.id, instances);
    const platform = {
      id: sourcePlatform.id,
      shortName: definition?.shortName || sourcePlatform.shortName || sourcePlatform.id.toUpperCase(),
      name: platformDetails.name || sourcePlatform.name,
      role: definition?.role || "Cybersecurity Platform",
      nodeStatus: health.nodeStatus,
      status: health.status,
      cpu: health.aggregate.cpu,
      ram: health.aggregate.memory,
      latency: health.aggregate.latency,
      diskAvailableDays: Math.max(0, Math.round(90 - health.aggregate.diskUsage)),
      instances: evaluatedInstances,
      aggregate: health.aggregate,
      reasons: health.reasons,
      services: (definition?.services || []).map((service, index) => {
        const sourceInstance = instances[index % instances.length];
        return {
          ...service,
          instanceId: sourceInstance.id,
          status: sourceInstance.serviceStatus,
          statusReason: sourceInstance.serviceStatusReason,
          checkType: sourceInstance.availabilityCheck,
          cpu: sourceInstance.cpu,
          memory: sourceInstance.memory,
          uptime: sourceInstance.uptime,
        };
      }),
      security,
    };
    return platform;
  }

  async function loadSnapshot() {
    try {
      const sourcePlatforms = await mockDataApiClient.getPlatforms();
      if (!sourcePlatforms.length) {
        throw new MockDataApiError("Mock Data API returned no platforms");
      }
      const platforms = await Promise.all(sourcePlatforms.map(fetchPlatform));
      const security = buildDashboardSecurity(platforms);
      latestDashboard = {
        name: "cs-asop-platform-baseline",
        platforms,
        security,
        summary: buildDashboardSummary(platforms, security),
        updatedAt: new Date().toISOString(),
      };
      return latestDashboard;
    } catch (error) {
      if (error instanceof MockDataApiError) throw error;
      throw new DashboardDataUnavailableError(
        `Could not build dashboard from Mock Data API data: ${error.message}`,
        { cause: error },
      );
    }
  }

  function refresh() {
    if (!refreshInProgress) {
      refreshInProgress = loadSnapshot().finally(() => {
        refreshInProgress = null;
      });
    }
    return refreshInProgress;
  }

  function getDashboard() {
    if (!latestDashboard) {
      throw new DashboardDataUnavailableError("Dashboard data is not available until Mock Data API refresh succeeds");
    }
    return latestDashboard;
  }

  function getPlatforms() {
    return getDashboard().platforms;
  }

  function getPlatform(platformId) {
    return getPlatforms().find((platform) => platform.id === platformId) || null;
  }

  return { getDashboard, getPlatform, getPlatforms, refresh };
}

module.exports = {
  createDashboardService,
  DashboardDataUnavailableError,
  TELEMETRY_HISTORY_LIMIT,
};
