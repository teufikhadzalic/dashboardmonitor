const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const userStore = require("../utils/userStore");

const router = express.Router();
router.use(requireAuth, requireAdmin);

function publicRequest(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

router.get("/requests", async (req, res, next) => {
  try {
    const users = mongoose.connection.readyState === 1
      ? await User.find({ status: "pending" }).sort({ createdAt: 1 })
      : userStore.getUsers().filter((user) => user.status === "pending");

    return res.json({ requests: users.map(publicRequest) });
  } catch (error) {
    return next(error);
  }
});

router.patch("/requests/:id", async (req, res, next) => {
  try {
    const decision = req.body.decision;
    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({ error: "Decision must be approve or reject" });
    }

    const status = decision === "approve" ? "approved" : "rejected";
    const user = mongoose.connection.readyState === 1
      ? await User.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { status }, { new: true })
      : userStore.getUsers().find((entry) => String(entry.id) === req.params.id && entry.status === "pending");

    if (!user) return res.status(404).json({ error: "Pending request not found" });
    if (mongoose.connection.readyState !== 1) {
      user.status = status;
      userStore.setUser(user);
    }

    return res.json({ user: publicRequest(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;