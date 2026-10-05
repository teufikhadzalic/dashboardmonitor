const mongoose = require("mongoose");
const User = require("../models/User");
const userStore = require("../utils/userStore");

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

async function getRequests() {
  const users = mongoose.connection.readyState === 1
    ? await User.find({ status: "pending" }).sort({ createdAt: 1 })
    : userStore.getUsers().filter((user) => user.status === "pending");

  return users.map(publicRequest);
}

async function decideRequest(requestId, decision) {
  const status = decision === "approve" ? "approved" : "rejected";
  const user = mongoose.connection.readyState === 1
    ? await User.findOneAndUpdate({ _id: requestId, status: "pending" }, { status }, { new: true })
    : userStore.getUsers().find((entry) => String(entry.id) === requestId && entry.status === "pending");

  if (!user) return null;
  if (mongoose.connection.readyState !== 1) {
    user.status = status;
    userStore.setUser(user);
  }

  return publicRequest(user);
}

module.exports = { decideRequest, getRequests };
