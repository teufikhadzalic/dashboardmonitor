function createDashboardService() {
  const emptyDashboard = {
    name: "cs-asop-platform-baseline",
    platforms: [],
    security: {
      sessionsBypassingPAM: 0,
      outOfHoursAccess: 0,
      failedLogins: 0,
      blockedThreats: 0,
      exposure: [],
    },
    summary: {
      overallHealth: "healthy",
      onlineNodes: 0,
      warningNodes: 0,
      criticalNodes: 0,
      totalPlatforms: 0,
      healthyPlatforms: 0,
      warningPlatforms: 0,
      criticalPlatforms: 0,
      totalInstances: 0,
      healthyInstances: 0,
      warningInstances: 0,
      criticalInstances: 0,
    },
    updatedAt: null,
  };

  function getDashboard() {
    return emptyDashboard;
  }

  function getPlatforms() {
    return emptyDashboard.platforms;
  }

  function getPlatform() {
    return null;
  }

  async function bootstrap() {
    return getDashboard();
  }

  async function update() {
    return getDashboard();
  }

  return { bootstrap, getDashboard, getPlatform, getPlatforms, update };
}

module.exports = { createDashboardService };
