const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

const {
  BOOTSTRAP_EMAIL,
  BOOTSTRAP_USERNAME,
  bootstrapSuperuser,
  resolveLoginEmail,
} = require("../utils/bootstrapAdmin");

test("development bootstrap creates an approved admin with a hashed requested password", async () => {
  let storedUser;
  const user = await bootstrapSuperuser({
    isProduction: false,
    findByEmail: async () => null,
    saveUser: async (newUser) => {
      storedUser = newUser;
      return newUser;
    },
  });

  assert.equal(user, storedUser);
  assert.equal(user.name, "Admintest");
  assert.equal(user.email, BOOTSTRAP_EMAIL);
  assert.equal(user.role, "admin");
  assert.equal(user.status, "approved");
  assert.notEqual(user.password, "Password");
  assert.equal(await bcrypt.compare("Password", user.password), true);
});

test("production bootstrap does not inspect or modify users", async () => {
  let touchedStorage = false;
  const user = await bootstrapSuperuser({
    isProduction: true,
    findByEmail: async () => { touchedStorage = true; },
    saveUser: async () => { touchedStorage = true; },
  });

  assert.equal(user, null);
  assert.equal(touchedStorage, false);
});

test("bootstrap leaves an existing account unchanged", async () => {
  const existing = { email: BOOTSTRAP_EMAIL, role: "user" };
  let saved = false;
  const user = await bootstrapSuperuser({
    isProduction: false,
    findByEmail: async () => existing,
    saveUser: async () => { saved = true; },
  });

  assert.equal(user, null);
  assert.equal(saved, false);
  assert.equal(existing.role, "user");
});

test("requested username resolves to the bootstrap account email", () => {
  assert.equal(resolveLoginEmail(BOOTSTRAP_USERNAME), BOOTSTRAP_EMAIL);
  assert.equal(resolveLoginEmail("person@example.com"), "person@example.com");
});