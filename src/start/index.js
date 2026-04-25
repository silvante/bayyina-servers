const cors = require("cors");
const express = require("express");
const hpp = require("hpp");
const helmet = require("helmet");
const xss = require("xss-clean");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const requestLogger = require("../middlewares/logger");
const setupSwagger = require("../../docs/setup");

// Register models
require("../models/User");
require("../models/Group");
require("../models/Enrollment");
require("../models/Payment");
require("../models/Salary");
require("../models/VerificationCode");

const app = express();

app.use(requestLogger);

const corsOptions = {
  // origin: function (origin, callback) {
  //   const allowedOrigins = process.env.ALLOWED_ORIGINS.split(",").filter(Boolean);
  //   if (!origin || allowedOrigins.includes(origin)) {
  //     callback(null, true);
  //   } else {
  //     callback(new Error("CORS tomonidan bloklandi"));
  //   }
  // },
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

app.use(cors(corsOptions));

const limiter = rateLimit({
  max: 120,
  legacyHeaders: false,
  standardHeaders: true,
  windowMs: 3 * 60 * 1000,
  message: {
    code: "tooManyRequests",
    message:
      "Juda ko'p so'rovlar yuborildi. Iltimos, 3 daqiqadan keyin urinib ko'ring",
  },
});

app.use(limiter);

const isDev = process.env.NODE_ENV !== "production";

app.use(
  helmet({
    contentSecurityPolicy: isDev
      ? false // Swagger UI needs unsafe-inline scripts — disable CSP in dev
      : {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

setupSwagger(app);

module.exports = { app, express };
