const adminService = require("../services/adminService");

async function getRequests(req, res, next) {
  try {
    return res.json({ requests: await adminService.getRequests() });
  } catch (error) {
    return next(error);
  }
}

async function decideRequest(req, res, next) {
  const { decision } = req.body;
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ error: "Decision must be approve or reject" });
  }

  try {
    const user = await adminService.decideRequest(req.params.id, decision);
    if (!user) return res.status(404).json({ error: "Pending request not found" });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { decideRequest, getRequests };
