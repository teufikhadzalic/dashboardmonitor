function createPlatformController(dashboardService) {
  return {
    getDashboard(req, res) {
      return res.json({ dashboard: dashboardService.getDashboard() });
    },

    getPlatforms(req, res) {
      return res.json({ platforms: dashboardService.getPlatforms() });
    },

    getPlatform(req, res) {
      const platform = dashboardService.getPlatform(req.params.id);
      if (!platform) {
        return res.status(404).json({ error: "Platform not found" });
      }

      return res.json({ platform });
    },
  };
}

module.exports = { createPlatformController };
