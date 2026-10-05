function createPlatformService({ platforms, telemetryGenerator }) {
  function findPlatform(platformId) {
    return platforms.find((platform) => platform.id === platformId) ?? null;
  }

  function toPlatformResponse(platform) {
    if (!platform) return null;
    const { id, name, shortName, status } = platform;
    return { id, name, shortName, status };
  }

  function getPlatforms() {
    return platforms.map(toPlatformResponse);
  }

  function getPlatform(platformId) {
    return toPlatformResponse(findPlatform(platformId));
  }

  function getInstances(platformId) {
    const platform = findPlatform(platformId);
    return platform ? platform.instances : null;
  }

  function getTelemetry(platformId, { instanceId, limit }) {
    const platform = findPlatform(platformId);
    if (!platform) return null;
    if (instanceId) {
      if (!platform.instances.some((instance) => instance.id === instanceId)) return null;
      return telemetryGenerator.getHistory(instanceId, limit);
    }

    return platform.instances
      .flatMap((instance) => telemetryGenerator.getHistory(instance.id, limit))
      .sort((first, second) => second.timestamp.localeCompare(first.timestamp))
      .slice(0, limit);
  }

  return { getInstances, getPlatform, getPlatforms, getTelemetry };
}

module.exports = { createPlatformService };
