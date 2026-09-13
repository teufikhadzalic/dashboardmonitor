const jwt = require("jsonwebtoken");

const jwtSecret = process.env.JWT_SECRET || "cs-asop-development-secret";

function createToken(user) {
  return jwt.sign(
    { userId: user._id || user.id, email: user.email, role: user.role || "user", status: user.status || "approved" },
    jwtSecret,
    { expiresIn: "7d" }
  );
}

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

function verifyToken(token) {
  return jwt.verify(token, jwtSecret);
}

module.exports = { createToken, requireAuth, requireAdmin, verifyToken };