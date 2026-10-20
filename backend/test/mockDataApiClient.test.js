const test = require("node:test");
const assert = require("node:assert/strict");
const { createMockDataApiClient, MockDataApiError } = require("../services/mockDataApiClient");

test("Mock Data API client requests all supported platform data endpoints", async () => {
  const requestedUrls = [];
  const responseBodies = {
    "/api/platforms": { platforms: [{ id: "iga" }] },
    "/api/platforms/iga": { platform: { id: "iga" } },
    "/api/platforms/iga/instances": { instances: [{ id: "IGA-01" }] },
    "/api/platforms/iga/telemetry?limit=25": { telemetry: [{ timestamp: "2026-10-05T03:30:00.000Z" }] },
  };
  const client = createMockDataApiClient({
    baseUrl: "http://mock-api.test/",
    fetchImpl: async (url) => {
      const parsedUrl = new URL(url);
      const path = `${parsedUrl.pathname}${parsedUrl.search}`;
      requestedUrls.push(path);
      return new Response(JSON.stringify(responseBodies[path]), { status: 200 });
    },
  });

  assert.deepEqual(await client.getPlatforms(), [{ id: "iga" }]);
  assert.deepEqual(await client.getPlatform("iga"), { id: "iga" });
  assert.deepEqual(await client.getInstances("iga"), [{ id: "IGA-01" }]);
  assert.deepEqual(await client.getTelemetry("iga", { limit: 25 }), [
    { timestamp: "2026-10-05T03:30:00.000Z" },
  ]);
  assert.deepEqual(requestedUrls, Object.keys(responseBodies));
});

test("Mock Data API client reports unavailable, unsuccessful, and malformed responses", async () => {
  const offlineClient = createMockDataApiClient({
    baseUrl: "http://mock-api.test",
    fetchImpl: async () => {
      throw new Error("connection refused");
    },
  });
  await assert.rejects(offlineClient.getPlatforms(), MockDataApiError);

  const failedClient = createMockDataApiClient({
    fetchImpl: async () => new Response("not found", { status: 503 }),
  });
  await assert.rejects(failedClient.getPlatforms(), /HTTP 503/);

  const malformedClient = createMockDataApiClient({
    fetchImpl: async () => new Response(JSON.stringify({ unexpected: [] }), { status: 200 }),
  });
  await assert.rejects(malformedClient.getPlatforms(), /must contain a platforms array/);
});
