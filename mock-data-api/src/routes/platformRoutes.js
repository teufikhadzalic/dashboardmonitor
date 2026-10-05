function createPlatformRoutes(controller) {
  return function handleRoute(request, response, url) {
    if (request.method !== "GET") return false;
    if (url.pathname === "/api/health") {
      controller.getHealth(request, response);
      return true;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "api" || segments[1] !== "platforms") return false;
    if (segments.length === 2) {
      controller.getPlatforms(request, response);
      return true;
    }
    if (segments.length === 3) {
      controller.getPlatform(request, response, segments[2]);
      return true;
    }
    if (segments.length === 4 && segments[3] === "instances") {
      controller.getInstances(request, response, segments[2]);
      return true;
    }
    if (segments.length === 4 && segments[3] === "telemetry") {
      controller.getTelemetry(request, response, segments[2], url.searchParams);
      return true;
    }

    return false;
  };
}

module.exports = { createPlatformRoutes };
