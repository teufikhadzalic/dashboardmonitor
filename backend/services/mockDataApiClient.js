const DEFAULT_MOCK_DATA_API_URL = "http://localhost:4000";

class MockDataApiError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "MockDataApiError";
    this.statusCode = options?.statusCode;
  }
}

function createMockDataApiClient({
  baseUrl = DEFAULT_MOCK_DATA_API_URL,
  fetchImpl = fetch,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  async function get(path) {
    const url = `${normalizedBaseUrl}${path}`;
    let response;
    try {
      response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    } catch (error) {
      throw new MockDataApiError(`Unable to reach Mock Data API at ${normalizedBaseUrl}`, { cause: error });
    }

    if (!response.ok) {
      throw new MockDataApiError(
        `Mock Data API returned HTTP ${response.status} for ${path}`,
        { statusCode: response.status },
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new MockDataApiError(`Mock Data API returned invalid JSON for ${path}`, { cause: error });
    }
  }

  function requireArray(payload, key, path) {
    if (!Array.isArray(payload?.[key])) {
      throw new MockDataApiError(`Mock Data API response for ${path} must contain a ${key} array`);
    }
    return payload[key];
  }

  return {
    async getPlatforms() {
      const path = "/api/platforms";
      return requireArray(await get(path), "platforms", path);
    },

    async getPlatform(platformId) {
      const path = `/api/platforms/${encodeURIComponent(platformId)}`;
      const payload = await get(path);
      if (!payload?.platform || typeof payload.platform !== "object") {
        throw new MockDataApiError(`Mock Data API response for ${path} must contain a platform object`);
      }
      return payload.platform;
    },

    async getInstances(platformId) {
      const path = `/api/platforms/${encodeURIComponent(platformId)}/instances`;
      return requireArray(await get(path), "instances", path);
    },

    async getTelemetry(platformId, { limit = 300 } = {}) {
      const path = `/api/platforms/${encodeURIComponent(platformId)}/telemetry?limit=${limit}`;
      return requireArray(await get(path), "telemetry", path);
    },
  };
}

module.exports = {
  createMockDataApiClient,
  MockDataApiError,
  DEFAULT_MOCK_DATA_API_URL,
};
