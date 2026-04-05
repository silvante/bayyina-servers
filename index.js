require("dotenv").config();
const { app } = require("./src/start");
const connectDB = require("./src/config/db");
const { startAgenda } = require("./src/jobs");
const logger = require("./src/config/logger");

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    logger.info("Starting Bayyina CRM Backend...");

    await connectDB();
    logger.info("Database connection established");

    await startAgenda();
    logger.info("Agenda job scheduler started");

    require("./src/start/routes");
    logger.info("Routes initialized");

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    logger.error("Failed to start application", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
})();
