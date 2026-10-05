const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const userStore = require("./userStore");

const BOOTSTRAP_USERNAME = "admintest";
const BOOTSTRAP_EMAIL = "admintest@example.com";
const BOOTSTRAP_PASSWORD = "Password";

function resolveLoginEmail(identifier) {
  return identifier === BOOTSTRAP_USERNAME ? BOOTSTRAP_EMAIL : identifier;
}

async function bootstrapSuperuser(options = {}) {
  const isProduction = options.isProduction ?? process.env.NODE_ENV === "production";
  if (isProduction) return null;

  const findByEmail = options.findByEmail || (async (email) => (
    mongoose.connection.readyState === 1
      ? User.findOne({ email })
      : userStore.getUser(email)
  ));
  const saveUser = options.saveUser || (async (user) => (
    mongoose.connection.readyState === 1
      ? User.create(user)
      : userStore.setUser(user)
  ));

  if (await findByEmail(BOOTSTRAP_EMAIL)) return null;

  const user = {
    name: "Admintest",
    email: BOOTSTRAP_EMAIL,
    password: await bcrypt.hash(BOOTSTRAP_PASSWORD, 10),
    role: "admin",
    status: "approved",
  };

  if (mongoose.connection.readyState !== 1) user.id = `memory-${Date.now()}`;

  return saveUser(user);
}

module.exports = { BOOTSTRAP_EMAIL, BOOTSTRAP_USERNAME, bootstrapSuperuser, resolveLoginEmail };