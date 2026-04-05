const logger = require("../config/logger");

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  const requestInfo = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get("user-agent") || "unknown",
  };

  if (req.user) {
    requestInfo.userId = req.user._id || req.user.id;
  }

  logger.info("Incoming request", requestInfo);

  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;
    const responseInfo = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: requestInfo.ip,
    };

    if (res.statusCode >= 500) {
      logger.error("Server error response", responseInfo);
    } else if (res.statusCode >= 400) {
      logger.warn("Client error response", responseInfo);
    } else {
      logger.info("Response sent", responseInfo);
    }

    originalSend.call(this, data);
  };

  next();
};

module.exports = requestLogger;
