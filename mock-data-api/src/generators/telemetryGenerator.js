const MAX_HISTORY_RECORDS = 300;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function average(values) {
  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(1));
}

function createTelemetryGenerator({
  platforms,
  historyLimit = MAX_HISTORY_RECORDS,
  now = () => new Date(),
  random = Math.random,
}) {
  if (!Number.isInteger(historyLimit) || historyLimit < 1 || historyLimit > MAX_HISTORY_RECORDS) {
    throw new RangeError(`historyLimit must be an integer from 1 to ${MAX_HISTORY_RECORDS}`);
  }

  const histories = new Map();
  for (const platform of platforms) {
    for (const instance of platform.instances) {
      histories.set(instance.id, []);
    }
  }

  function nextValue(previous, baseline, maximumChange, minimum, maximum) {
    const drift = previous === undefined ? 0 : (baseline - previous) * 0.15;
    return clamp((previous ?? baseline) + drift + (random() * 2 - 1) * maximumChange, minimum, maximum);
  }

  function generateRecord(platform, instance) {
    const history = histories.get(instance.id);
    const previous = history[history.length - 1];
    const cpuCurrent = Number(nextValue(previous?.cpu_current, platform.cpuBaseline, 3, 10, 95).toFixed(1));
    const memoryCurrent = Number(nextValue(previous?.memory_current, platform.memoryBaseline, 1.8, 20, 90).toFixed(1));
    const latencyBaseline = platform.id === "siem" ? 82 : platform.id === "mfa" ? 29 : 46;
    const latency = Number(nextValue(previous?.latency, latencyBaseline, 4, 10, 260).toFixed(1));
    const diskUsage = Number(nextValue(previous?.disk_usage, 55, 1.5, 20, 96).toFixed(1));
    const errorRate = Number(nextValue(previous?.error_rate, 0.4, 0.12, 0, 8).toFixed(2));
    const requestRate = Math.round(nextValue(
      previous?.request_rate,
      500 + Number(instance.id.match(/\d+$/)?.[0] || 1) * 180,
      45,
      40,
      5400,
    ));
    const activeConnections = Math.round(nextValue(
      previous?.active_connections,
      80 + Number(instance.id.match(/\d+$/)?.[0] || 1) * 24,
      8,
      24,
      920,
    ));
    const networkThroughput = Number(nextValue(
      previous?.network_throughput,
      60,
      4,
      10,
      980,
    ).toFixed(1));
    const availability = Number(nextValue(
      previous?.availability,
      platform.availabilityBaseline,
      0.025,
      98.5,
      100,
    ).toFixed(2));
    const cpuValues = [...history.map((record) => record.cpu_current), cpuCurrent];
    const memoryValues = [...history.map((record) => record.memory_current), memoryCurrent];
    const securityMetrics = {
      bypassAttempts: Math.round(nextValue(previous?.security_metrics?.bypassAttempts, 2, 1, 0, 12)),
      outOfHoursAccess: Math.round(nextValue(previous?.security_metrics?.outOfHoursAccess, 3, 1, 0, 25)),
      authenticationFailures: Math.round(nextValue(previous?.security_metrics?.authenticationFailures, 2, 1, 0, 20)),
      policyDenies: Math.round(nextValue(previous?.security_metrics?.policyDenies, 4, 2, 0, 35)),
    };
    const record = {
      timestamp: now().toISOString(),
      platform: platform.id,
      instance: instance.id,
      cpu_current: cpuCurrent,
      cpu_average: average(cpuValues),
      memory_current: memoryCurrent,
      memory_average: average(memoryValues),
      latency,
      disk_usage: diskUsage,
      error_rate: errorRate,
      request_rate: requestRate,
      active_connections: activeConnections,
      network_throughput: networkThroughput,
      availability,
      security_metrics: securityMetrics,
    };

    histories.set(instance.id, [...history, record].slice(-historyLimit));
    return record;
  }

  function generate() {
    const latestByInstance = [];
    for (const platform of platforms) {
      for (const instance of platform.instances) {
        latestByInstance.push(generateRecord(platform, instance));
      }
    }
    return latestByInstance;
  }

  function getHistory(instanceId, limit = historyLimit) {
    const history = histories.get(instanceId);
    if (!history) return null;
    return history.slice(-limit).reverse();
  }

  function getLatest(instanceId) {
    const history = histories.get(instanceId);
    return history?.[history.length - 1] ?? null;
  }

  return { generate, getHistory, getLatest, historyLimit };
}

module.exports = { createTelemetryGenerator, MAX_HISTORY_RECORDS };
