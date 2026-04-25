const { app, express } = require("./index");

// Routes
const authRoute = require("../routes/auth");
const usersRoute = require("../routes/users");
const groupsRoute = require("../routes/groups");
const enrollmentsRoute = require("../routes/enrollments");
const paymentsRoute = require("../routes/payments");
const attendanceRoute = require("../routes/attendance");
const leadsRoute = require("../routes/leads");
const notificationsRoute = require("../routes/notifications");
const statisticsRoute = require("../routes/statistics");
const recordsRoute = require("../routes/records");
const salariesRoute = require("../routes/salaries");
const leadSourcesRoute = require("../routes/leadSources");
const courseTypesRoute = require("../routes/courseTypes");
const rejectionReasonsRoute = require("../routes/rejectionReasons");

// Error handler
const errorHandler = require("../middlewares/errorHandler");

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

app.use("/api/auth", authRoute);
app.use("/api/users", usersRoute);
app.use("/api/groups", groupsRoute);
app.use("/api/enrollments", enrollmentsRoute);
app.use("/api/payments", paymentsRoute);
app.use("/api/attendance", attendanceRoute);
app.use("/api/leads", leadsRoute);
app.use("/api/notifications", notificationsRoute);
app.use("/api/statistics", statisticsRoute);
app.use("/api/records", recordsRoute);
app.use("/api/salaries", salariesRoute);
app.use("/api/lead-sources", leadSourcesRoute);
app.use("/api/course-types", courseTypesRoute);
app.use("/api/rejection-reasons", rejectionReasonsRoute);

app.use(errorHandler);
