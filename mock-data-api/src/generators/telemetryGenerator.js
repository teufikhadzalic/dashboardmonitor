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
    const availability = Number(nextValue(
      previous?.availability,
      platform.availabilityBaseline,
      0.025,
      98.5,
      100,
    ).toFixed(2));
    const cpuValues = [...history.map((record) => record.cpu_current), cpuCurrent];
    const memoryValues = [...history.map((record) => record.memory_current), memoryCurrent];
    const record = {
      timestamp: now().toISOString(),
      platform: platform.id,
      instance: instance.id,
      cpu_current: cpuCurrent,
      cpu_average: average(cpuValues),
      memory_current: memoryCurrent,
      memory_average: average(memoryValues),
      availability,
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
