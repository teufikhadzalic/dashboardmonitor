function createPlatformController(dashboardService) {
  async function respondWithDashboardData(res, getData) {
    try {
      const result = await getData();
      return res.headersSent ? result : res.json(result);
    } catch (error) {
      if (error.name === "DashboardDataUnavailableError" || error.name === "MockDataApiError") {
        console.error("Dashboard data source unavailable:", error.message);
        return res.status(503).json({ error: "Dashboard data source unavailable" });
      }
      throw error;
    }
  }

  return {
    getDashboard(req, res) {
      return respondWithDashboardData(res, async () => ({ dashboard: dashboardService.getDashboard() }));
    },

    getPlatforms(req, res) {
      return respondWithDashboardData(res, async () => ({ platforms: dashboardService.getPlatforms() }));
    },

    getPlatform(req, res) {
      return respondWithDashboardData(res, async () => {
        const platform = dashboardService.getPlatform(req.params.id);
        if (!platform) return res.status(404).json({ error: "Platform not found" });
        return { platform };
      });
    },
  };
}

module.exports = { createPlatformController };
