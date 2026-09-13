const fs = require("fs");
const path = require("path");

const dataDirectory = path.join(__dirname, "..", "data");
const usersFile = path.join(dataDirectory, "users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch (error) {
    return [];
  }
}

const users = new Map(loadUsers().map((user) => [user.email, user]));

function saveUsers() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(usersFile, `${JSON.stringify([...users.values()], null, 2)}\n`);
}

function setUser(user) {
  users.set(user.email, user);
  saveUsers();
  return user;
}

function getUser(email) {
  return users.get(email);
}

function getUsers() {
  return [...users.values()];
}

module.exports = { getUser, getUsers, setUser };