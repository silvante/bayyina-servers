const { app, express } = require("./index");

// Routes
const authRoute = require("../routes/auth");
const usersRoute = require("../routes/users");
const groupsRoute = require("../routes/groups");
const enrollmentsRoute = require("../routes/enrollments");
const paymentsRoute = require("../routes/payments");

// Error handler
const errorHandler = require("../middlewares/errorHandler");

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use("/api/auth", authRoute);
app.use("/api/users", usersRoute);
app.use("/api/groups", groupsRoute);
app.use("/api/enrollments", enrollmentsRoute);
app.use("/api/payments", paymentsRoute);

app.use(errorHandler);
