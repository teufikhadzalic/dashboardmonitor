const { createDashboardState } = require("../utils/platformHealth");

const BASELINE_NAME = "cs-asop-platform-baseline";

function createDashboardService({ PlatformState, mongoose }) {
  const defaultBaseline = createDashboardState({ platforms: [] }, 0);
  let tick = 0;
  let latest = null;

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function loadBaselineState() {
    if (mongoose.connection.readyState !== 1) {
      return deepClone(defaultBaseline);
    }

    const existing = await PlatformState.findOne({ name: BASELINE_NAME }).lean();
    if (existing?.platforms?.length === 9 && existing.platforms.every((platform) => platform.instances?.length === 10)) {
      return existing;
    }

    const created = await PlatformState.create({ ...defaultBaseline, name: BASELINE_NAME });
    return created.toObject();
  }

  async function persistDashboard(snapshot) {
    if (mongoose.connection.readyState !== 1) {
      return snapshot;
    }

    const result = await PlatformState.findOneAndUpdate(
      { name: BASELINE_NAME },
      {
        $set: {
          platforms: snapshot.platforms,
          security: snapshot.security,
          summary: snapshot.summary,
          updatedAt: snapshot.updatedAt,
        },
      },
      { upsert: true, new: true },
    );

    return result.toObject();
  }

  function generateDashboardSnapshot(previousSnapshot = defaultBaseline) {
    tick += 1;
    return createDashboardState(previousSnapshot, tick);
  }

  async function bootstrap() {
    const baseline = await loadBaselineState();
    latest = await persistDashboard(generateDashboardSnapshot(baseline));
    return latest;
  }

  async function update() {
    if (!latest) {
      return bootstrap();
    }

    latest = await persistDashboard(generateDashboardSnapshot(latest));
    return latest;
  }

  function getDashboard() {
    return latest || defaultBaseline;
  }

  function getPlatforms() {
    return getDashboard().platforms;
  }

  function getPlatform(platformId) {
    return getPlatforms().find((platform) => platform.id === platformId) || null;
  }

  return { bootstrap, getDashboard, getPlatform, getPlatforms, update };
}

module.exports = { createDashboardService };
