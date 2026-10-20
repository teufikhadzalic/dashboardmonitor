const test = require("node:test");
const assert = require("node:assert/strict");
const { createApplication } = require("../server");
const { createToken } = require("../middleware/auth");
const { DashboardDataUnavailableError } = require("../services/dashboardService");

function createReadyDashboardService() {
  const dashboard = {
    platforms: [{
      id: "iga",
      shortName: "IGA",
      name: "Identity Governance & Administration",
      status: "healthy",
      instances: Array.from({ length: 10 }, (_, index) => ({ id: `IGA-${String(index + 1).padStart(2, "0")}` })),
    }],
    summary: { totalPlatforms: 1, totalInstances: 10 },
    security: { sessionsBypassingPAM: 0, outOfHoursAccess: 0, failedLogins: 0, blockedThreats: 0 },
    updatedAt: "2026-10-05T03:30:00.000Z",
  };
  return {
    getDashboard: () => dashboard,
    getPlatforms: () => dashboard.platforms,
    getPlatform: (id) => dashboard.platforms.find((platform) => platform.id === id) || null,
  };
}

async function listenApp(t, dashboardService) {
  const { app } = createApplication({ dashboardService });
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

test("main backend preserves authenticated frontend routes using the dashboard model", async (t) => {
  const baseUrl = await listenApp(t, createReadyDashboardService());
  const token = createToken({ id: "test-user", email: "test@example.com", role: "user" });
  const headers = { Authorization: "Bearer " + token };

  const unauthorizedResponse = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(unauthorizedResponse.status, 401);

  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard`, { headers });
  assert.equal(dashboardResponse.status, 200);
  const dashboard = (await dashboardResponse.json()).dashboard;
  assert.equal(dashboard.platforms.length, 1);
  assert.equal(dashboard.platforms[0].instances.length, 10);
  assert.equal(dashboard.summary.totalInstances, 10);

  const platformsResponse = await fetch(`${baseUrl}/api/platforms`, { headers });
  assert.deepEqual((await platformsResponse.json()).platforms, dashboard.platforms);

  const platformResponse = await fetch(`${baseUrl}/api/platform/iga`, { headers });
  assert.equal(platformResponse.status, 200);
  assert.equal((await platformResponse.json()).platform.id, "iga");

  const missingPlatformResponse = await fetch(`${baseUrl}/api/platform/not-found`, { headers });
  assert.equal(missingPlatformResponse.status, 404);
});

test("dashboard endpoint returns service unavailable before a source snapshot exists", async (t) => {
  const baseUrl = await listenApp(t, {
    getDashboard() {
      throw new DashboardDataUnavailableError("No source snapshot");
    },
    getPlatforms() {
      throw new DashboardDataUnavailableError("No source snapshot");
    },
    getPlatform() {
      throw new DashboardDataUnavailableError("No source snapshot");
    },
  });
  const token = createToken({ id: "test-user", email: "test@example.com", role: "user" });

  const response = await fetch(`${baseUrl}/api/dashboard`, {
    headers: { Authorization: "Bearer " + token },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Dashboard data source unavailable" });
});
