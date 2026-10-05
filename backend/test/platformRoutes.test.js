const test = require("node:test");
const assert = require("node:assert/strict");
const { app } = require("../server");
const { createToken } = require("../middleware/auth");

test("platform routes preserve the authenticated dashboard API contract", async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const token = createToken({ id: "test-user", email: "test@example.com", role: "user" });
  const headers = { Authorization: `Bearer ${token}` };

  const unauthorizedResponse = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(unauthorizedResponse.status, 401);

  const adminRequestsWithoutToken = await fetch(`${baseUrl}/api/admin/requests`);
  assert.equal(adminRequestsWithoutToken.status, 401);

  const adminRequestsAsUser = await fetch(`${baseUrl}/api/admin/requests`, { headers });
  assert.equal(adminRequestsAsUser.status, 403);

  const privilegedRegistration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test", email: "test@example.com", password: "password", role: "admin" }),
  });
  assert.equal(privilegedRegistration.status, 403);

  const invalidLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "missing@example.com", password: "password" }),
  });
  assert.equal(invalidLogin.status, 401);

  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard`, { headers });
  assert.equal(dashboardResponse.status, 200);
  const dashboardPayload = await dashboardResponse.json();
  assert.equal(dashboardPayload.dashboard.platforms.length, 9);

  const platformsResponse = await fetch(`${baseUrl}/api/platforms`, { headers });
  assert.equal(platformsResponse.status, 200);
  const platformsPayload = await platformsResponse.json();
  assert.deepEqual(platformsPayload.platforms.map(({ id }) => id), dashboardPayload.dashboard.platforms.map(({ id }) => id));

  const platformResponse = await fetch(`${baseUrl}/api/platform/iga`, { headers });
  assert.equal(platformResponse.status, 200);
  assert.equal((await platformResponse.json()).platform.id, "iga");

  const missingPlatformResponse = await fetch(`${baseUrl}/api/platform/not-found`, { headers });
  assert.equal(missingPlatformResponse.status, 404);
});
