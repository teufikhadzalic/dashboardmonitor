const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const { createToken } = require("../middleware/auth");
const userStore = require("../utils/userStore");

const router = express.Router();

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    role: user.role || "user",
    status: user.status || "approved",
  };
}

router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (req.body.role === "admin") {
      return res.status(403).json({ error: "Administrator accounts must be assigned through the privileged approval workflow" });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existing = mongoose.connection.readyState === 1
      ? await User.findOne({ email }).select("+password")
      : userStore.getUser(email);

    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Public registration can only create pending standard-user accounts.
    const role = "user";
    const status = "pending";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = mongoose.connection.readyState === 1
      ? await User.create({ name, email, password: passwordHash, role, status })
      : { id: `memory-${Date.now()}`, name, email, password: passwordHash, role, status };

    if (mongoose.connection.readyState !== 1) userStore.setUser(user);

    if (status === "pending") {
      return res.status(202).json({ pending: true, user: publicUser(user), message: "Your account is waiting for admin approval" });
    }

    return res.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "An account with this email already exists" });
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = mongoose.connection.readyState === 1
      ? await User.findOne({ email }).select("+password")
      : userStore.getUser(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status === "pending") {
      return res.status(403).json({ error: "Your account is waiting for admin approval" });
    }

    if (user.status === "rejected") {
      return res.status(403).json({ code: "ACCOUNT_REJECTED", error: "Appeal was rejected, re-apply?" });
    }

    return res.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/reapply", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = mongoose.connection.readyState === 1
      ? await User.findOne({ email }).select("+password")
      : userStore.getUser(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.status !== "rejected") {
      return res.status(400).json({ error: "This account does not need to re-apply" });
    }

    if (mongoose.connection.readyState === 1) {
      await User.updateOne({ email }, { status: "pending" });
    } else {
      user.status = "pending";
      userStore.setUser(user);
    }

    return res.status(202).json({ pending: true, message: "Your account has been re-submitted for admin approval" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;