const test = require("node:test");
const assert = require("node:assert/strict");
const { createDashboardService } = require("../services/dashboardService");
const { MockDataApiError } = require("../services/mockDataApiClient");
const { PLATFORM_DEFINITIONS } = require("../data/platformDefinitions");

function createMockDataApiClient() {
  const platforms = PLATFORM_DEFINITIONS.map(({ id, name, shortName }) => ({
    id,
    name,
    shortName: shortName.replace(/[^A-Z0-9]/gi, ""),
    status: "UP",
  }));

  const instancesByPlatform = new Map(platforms.map((platform) => [
    platform.id,
    Array.from({ length: 10 }, (_, index) => {
      const instanceNumber = String(index + 1).padStart(2, "0");
      return {
        id: `${platform.shortName.toUpperCase()}-${instanceNumber}`,
        status: "UP",
        hostname: `${platform.id}-prod-${instanceNumber}`,
        ipAddress: `10.20.${platform.id.length}.${index + 10}`,
        os: "Ubuntu",
        osVersion: "22.04 LTS",
        architecture: "x86_64",
        datacenter: "DC-JKT-01",
        region: "Jakarta",
        zone: "A",
        environment: index === 9 ? "Staging" : "Production",
        uptime: 24,
        lastRestart: "2026-10-05T00:00:00.000Z",
      };
    }),
  ]));

  return {
    async getPlatforms() {
      return platforms;
    },
    async getPlatform(platformId) {
      return platforms.find(({ id }) => id === platformId);
    },
    async getInstances(platformId) {
      return instancesByPlatform.get(platformId);
    },
    async getTelemetry(platformId) {
      return instancesByPlatform.get(platformId).map((instance, index) => ({
        timestamp: "2026-10-05T03:30:00.000Z",
        platform: platformId,
        instance: instance.id,
        cpu_current: 45 + index,
        cpu_average: 44 + index,
        memory_current: 55,
        memory_average: 54,
        latency: 40,
        disk_usage: 50,
        error_rate: 0.2,
        request_rate: 600,
        active_connections: 100,
        network_throughput: 60,
        availability: 99.95,
        security_metrics: {
          bypassAttempts: 1,
          outOfHoursAccess: 2,
          authenticationFailures: 3,
          policyDenies: 4,
        },
      }));
    },
  };
}

test("dashboard service adapts Mock Data API data into the current 9x10 dashboard model", async () => {
  const dashboardService = createDashboardService({ mockDataApiClient: createMockDataApiClient() });

  const dashboard = await dashboardService.refresh();

  assert.equal(dashboard.platforms.length, 9);
  assert.equal(dashboard.summary.totalPlatforms, 9);
  assert.equal(dashboard.summary.totalInstances, 90);
  assert.equal(dashboard.platforms.every(({ instances }) => instances.length === 10), true);
  assert.equal(dashboard.platforms.every(({ services }) => services.length === 2), true);
  assert.equal(dashboard.summary.onlineNodes + dashboard.summary.warningNodes + dashboard.summary.criticalNodes, 9);

  const iga = dashboardService.getPlatform("iga");
  assert.equal(iga.shortName, "IGA");
  assert.equal(iga.aggregate.totalInstances, 10);
  assert.equal(iga.instances[0].id, "IGA-01");
  assert.equal(iga.instances[0].cpu, 45);
  assert.equal(iga.instances[0].telemetry[0].timestamp, "2026-10-05T03:30:00.000Z");
  assert.equal(iga.services[0].instanceId, "IGA-01");
  assert.ok(Date.parse(dashboard.updatedAt));
});

test("dashboard service preserves UP/DOWN input as service health", async () => {
  const client = createMockDataApiClient();
  const originalGetInstances = client.getInstances;
  client.getInstances = async (platformId) => {
    const instances = await originalGetInstances(platformId);
    return platformId === "iga"
      ? instances.map((instance, index) => index === 0 ? { ...instance, status: "DOWN" } : instance)
      : instances;
  };
  const dashboardService = createDashboardService({ mockDataApiClient: client });

  const dashboard = await dashboardService.refresh();

  assert.equal(dashboardService.getPlatform("iga").instances[0].serviceStatus, "down");
  assert.equal(dashboardService.getPlatform("iga").instances[0].status, "critical");
  assert.equal(dashboard.summary.criticalNodes > 0, true);
});

test("dashboard service does not create a fallback snapshot when Mock Data API is unavailable", async () => {
  const dashboardService = createDashboardService({
    mockDataApiClient: {
      async getPlatforms() {
        throw new MockDataApiError("Unable to reach Mock Data API");
      },
    },
  });

  await assert.rejects(dashboardService.refresh(), /Unable to reach Mock Data API/);
  assert.throws(() => dashboardService.getDashboard(), /not available/);
});
