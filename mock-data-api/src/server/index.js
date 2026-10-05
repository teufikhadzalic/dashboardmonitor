const http = require("node:http");
const path = require("node:path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const { platforms } = require("../data/platforms");
const { createTelemetryGenerator } = require("../generators/telemetryGenerator");
const { createPlatformService } = require("../services/platformService");
const { createPlatformController } = require("../controllers/platformController");
const { createPlatformRoutes } = require("../routes/platformRoutes");

const DEFAULT_PORT = 4000;
const DEFAULT_INTERVAL_MS = 10000;
const MIN_INTERVAL_MS = 1000;

function parsePositiveInteger(name, value, defaultValue, minimum) {
  if (value === undefined || value === "") return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

function createServer({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
    throw new RangeError(`intervalMs must be an integer greater than or equal to ${MIN_INTERVAL_MS}`);
  }

  const telemetryGenerator = createTelemetryGenerator({ platforms });
  const platformService = createPlatformService({ platforms, telemetryGenerator });
  const controller = createPlatformController(platformService);
  const handleRoute = createPlatformRoutes(controller);

  telemetryGenerator.generate();
  const generationTimer = setInterval(() => telemetryGenerator.generate(), intervalMs);
  generationTimer.unref();

  const server = http.createServer((request, response) => {
    let url;
    try {
      url = new URL(request.url, "http://localhost");
    } catch {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Invalid request URL" }));
      return;
    }

    if (handleRoute(request, response, url)) return;
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Route not found" }));
  });

  server.on("close", () => clearInterval(generationTimer));
  return server;
}

function startServer() {
  const port = parsePositiveInteger("PORT", process.env.PORT, DEFAULT_PORT, 1);
  const intervalMs = parsePositiveInteger(
    "MOCK_DATA_INTERVAL_MS",
    process.env.MOCK_DATA_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS,
  );
  const server = createServer({ intervalMs });

  server.listen(port, () => {
    console.log(`Mock Data API listening on http://localhost:${port}`);
    console.log(`Generating telemetry every ${intervalMs}ms`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createServer, parsePositiveInteger, startServer };
