const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const { createToken } = require("../middleware/auth");
const userStore = require("../utils/userStore");
const { resolveLoginEmail } = require("../utils/bootstrapAdmin");

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    role: user.role || "user",
    status: user.status || "approved",
  };
}

async function findUser(email) {
  return mongoose.connection.readyState === 1
    ? User.findOne({ email }).select("+password")
    : userStore.getUser(email);
}

function respond(status, body) {
  return { status, body };
}

async function register(body = {}) {
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (body.role === "admin") {
    return respond(403, { error: "Administrator accounts must be assigned through the privileged approval workflow" });
  }
  if (!name || !email || !password) {
    return respond(400, { error: "Name, email, and password are required" });
  }
  if (password.length < 6) {
    return respond(400, { error: "Password must be at least 6 characters" });
  }

  try {
    if (await findUser(email)) {
      return respond(409, { error: "An account with this email already exists" });
    }

    const user = {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role: "user",
      status: "pending",
    };
    const savedUser = mongoose.connection.readyState === 1
      ? await User.create(user)
      : userStore.setUser({ ...user, id: `memory-${Date.now()}` });

    return respond(202, {
      pending: true,
      user: publicUser(savedUser),
      message: "Your account is waiting for admin approval",
    });
  } catch (error) {
    if (error.code === 11000) {
      return respond(409, { error: "An account with this email already exists" });
    }
    throw error;
  }
}

async function login(body = {}) {
  const identifier = String(body.email || body.username || "").trim().toLowerCase();
  const user = await findUser(resolveLoginEmail(identifier));
  const password = String(body.password || "");

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return respond(401, { error: "Invalid email or password" });
  }
  if (user.status === "pending") {
    return respond(403, { error: "Your account is waiting for admin approval" });
  }
  if (user.status === "rejected") {
    return respond(403, { code: "ACCOUNT_REJECTED", error: "Appeal was rejected, re-apply?" });
  }

  return respond(200, { token: createToken(user), user: publicUser(user) });
}

async function reapply(body = {}) {
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const user = await findUser(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return respond(401, { error: "Invalid email or password" });
  }
  if (user.status !== "rejected") {
    return respond(400, { error: "This account does not need to re-apply" });
  }

  if (mongoose.connection.readyState === 1) {
    await User.updateOne({ email }, { status: "pending" });
  } else {
    user.status = "pending";
    userStore.setUser(user);
  }

  return respond(202, { pending: true, message: "Your account has been re-submitted for admin approval" });
}

module.exports = { login, reapply, register };
