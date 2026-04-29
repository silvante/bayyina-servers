const express = require("express");
const router = express.Router();
const { auth, roleCheck } = require("../middlewares/auth");
const {
  getOverview,
  getLeadStats,
  getStudentStats,
  getRevenueStats,
  getAttendanceStats,
  getLeadManagerStats,
} = require("../controllers/statistics.controller");

router.use(auth, roleCheck(["admin"]));

router.get("/overview", getOverview);
router.get("/leads", getLeadStats);
router.get("/leads/managers", getLeadManagerStats);
router.get("/students", getStudentStats);
router.get("/revenue", getRevenueStats);
router.get("/attendance", getAttendanceStats);

module.exports = router;
