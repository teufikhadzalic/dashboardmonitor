const { MAX_HISTORY_RECORDS } = require("../generators/telemetryGenerator");

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function createPlatformController(platformService) {
  return {
    getHealth(request, response) {
      return sendJson(response, 200, { service: "mock-data-api", status: "ok" });
    },

    getPlatforms(request, response) {
      return sendJson(response, 200, { platforms: platformService.getPlatforms() });
    },

    getPlatform(request, response, platformId) {
      const platform = platformService.getPlatform(platformId);
      if (!platform) return sendJson(response, 404, { error: "Platform not found" });
      return sendJson(response, 200, { platform });
    },

    getInstances(request, response, platformId) {
      const instances = platformService.getInstances(platformId);
      if (!instances) return sendJson(response, 404, { error: "Platform not found" });
      return sendJson(response, 200, { platformId, instances });
    },

    getTelemetry(request, response, platformId, searchParams) {
      const rawLimit = searchParams.get("limit");
      const limit = rawLimit === null ? 50 : Number(rawLimit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_HISTORY_RECORDS) {
        return sendJson(response, 400, {
          error: `limit must be an integer from 1 to ${MAX_HISTORY_RECORDS}`,
        });
      }

      const instanceId = searchParams.get("instanceId") || undefined;
      const telemetry = platformService.getTelemetry(platformId, { instanceId, limit });
      if (!telemetry) {
        return sendJson(response, 404, {
          error: instanceId ? "Instance not found for platform" : "Platform not found",
        });
      }
      return sendJson(response, 200, { platformId, telemetry });
    },
  };
}

module.exports = { createPlatformController };
