const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get("/requests", adminController.getRequests);
router.patch("/requests/:id", adminController.decideRequest);

module.exports = router;
