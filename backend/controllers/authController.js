const authService = require("../services/authService");

function handle(serviceMethod) {
  return async (req, res, next) => {
    try {
      const result = await serviceMethod(req.body);
      return res.status(result.status).json(result.body);
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  login: handle(authService.login),
  reapply: handle(authService.reapply),
  register: handle(authService.register),
};
