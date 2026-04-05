const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  const isDevelopment = process.env.NODE_ENV === "development";

  const status = err.statusCode || 500;
  const code = err.code || "serverError";

  const message =
    status === 500
      ? "Serverda ichki xatolik"
      : err.message || "Xatolik yuz berdi";

  const errorInfo = {
    code,
    status,
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent"),
  };

  if (req.user) {
    errorInfo.userId = req.user._id || req.user.id;
  }

  if (req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    errorInfo.body = sanitizedBody;
  }

  if (status >= 500) {
    logger.error("Server error occurred", errorInfo);
  } else if (status >= 400) {
    logger.warn("Client error occurred", errorInfo);
  } else {
    logger.info("Error handled", errorInfo);
  }

  res.status(status).json({
    code,
    message,
    details: isDevelopment ? err.message || err : undefined,
  });
};

module.exports = errorHandler;
