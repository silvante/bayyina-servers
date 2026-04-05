const path = require("path");
const fs = require("fs");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");

const swaggerDocument = yaml.load(
  fs.readFileSync(path.join(__dirname, "swagger.yaml"), "utf8")
);

const swaggerOptions = {
  customSiteTitle: "Bayyina CRM API Docs",
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar-wrapper .link span { display: none; }
    .swagger-ui .topbar-wrapper::after { content: "Bayyina CRM API"; color: #fff; font-size: 18px; font-weight: bold; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: "list",
    filter: true,
  },
};

/**
 * Mount Swagger UI on the given Express app.
 * Docs are served at /api-docs (non-production only by default).
 *
 * @param {import("express").Application} app
 */
function setupSwagger(app) {
  if (process.env.NODE_ENV === "production" && process.env.SWAGGER_ENABLED !== "true") {
    return;
  }

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));

  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerDocument);
  });
}

module.exports = setupSwagger;
