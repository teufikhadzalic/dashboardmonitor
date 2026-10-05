const express = require("express");

function createPlatformRoutes(controller, requireAuth) {
  const router = express.Router();

  router.get("/dashboard", requireAuth, controller.getDashboard);
  router.get("/platforms", requireAuth, controller.getPlatforms);
  router.get("/platform/:id", requireAuth, controller.getPlatform);

  return router;
}

module.exports = { createPlatformRoutes };
