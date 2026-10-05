const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../src/server");
const { createTelemetryGenerator, MAX_HISTORY_RECORDS } = require("../src/generators/telemetryGenerator");
const { platforms } = require("../src/data/platforms");

test("platform API provides platform, instance, and generated telemetry JSON", async (t) => {
  const server = createServer({ intervalMs: 10000 });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const platformsResponse = await fetch(`${baseUrl}/api/platforms`);
  assert.equal(platformsResponse.status, 200);
  const platformPayload = await platformsResponse.json();
  assert.equal(platformPayload.platforms.length, 9);
  assert.deepEqual(platformPayload.platforms[0], {
    id: "iga",
    name: "Identity Governance & Administration",
    shortName: "IGA",
    status: "UP",
  });

  const platformResponse = await fetch(`${baseUrl}/api/platforms/iga`);
  assert.equal(platformResponse.status, 200);
  assert.equal((await platformResponse.json()).platform.id, "iga");

  const instanceResponse = await fetch(`${baseUrl}/api/platforms/iga/instances`);
  assert.equal(instanceResponse.status, 200);
  const instances = (await instanceResponse.json()).instances;
  assert.equal(instances.length, 10);
  assert.equal(instances[0].id, "IGA-01");

  const telemetryResponse = await fetch(`${baseUrl}/api/platforms/iga/telemetry?instanceId=IGA-01`);
  assert.equal(telemetryResponse.status, 200);
  const telemetry = (await telemetryResponse.json()).telemetry;
  assert.equal(telemetry.length, 1);
  assert.equal(telemetry[0].platform, "iga");
  assert.equal(telemetry[0].instance, "IGA-01");
  assert.ok(Number.isFinite(Date.parse(telemetry[0].timestamp)));
  assert.ok(telemetry[0].cpu_current >= 10 && telemetry[0].cpu_current <= 95);
  assert.ok(telemetry[0].cpu_average >= 10 && telemetry[0].cpu_average <= 95);

  const missingResponse = await fetch(`${baseUrl}/api/platforms/missing`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { error: "Platform not found" });

  const invalidLimitResponse = await fetch(`${baseUrl}/api/platforms/iga/telemetry?limit=0`);
  assert.equal(invalidLimitResponse.status, 400);
});

test("telemetry history stays bounded and invalid history limits are rejected", () => {
  const generator = createTelemetryGenerator({
    platforms: [platforms[0]],
    historyLimit: 2,
  });

  generator.generate();
  generator.generate();
  generator.generate();

  const history = generator.getHistory("IGA-01");
  assert.equal(history.length, 2);
  assert.ok(history.every(({ timestamp }) => Number.isFinite(Date.parse(timestamp))));
  assert.throws(() => createTelemetryGenerator({
    platforms: [platforms[0]],
    historyLimit: MAX_HISTORY_RECORDS + 1,
  }), RangeError);
});

test("generation intervals below one second are rejected", () => {
  assert.throws(() => createServer({ intervalMs: 50 }), RangeError);
});
