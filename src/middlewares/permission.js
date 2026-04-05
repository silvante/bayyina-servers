/**
 * Role-based access control middleware
 * @param {...string} roles - Allowed roles
 */
const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        code: "forbidden",
        message: "Ruxsat berilmadi",
      });
    }
    next();
  };
};

module.exports = { checkRole };
