const express = require("express");
const router = express.Router();

const {
  bulkMarkAttendance,
  getAttendances,
  getSessionAttendance,
  getScheduleSessions,
  getAttendanceSummary,
  updateAttendance,
  deleteAttendance,
} = require("../controllers/attendance.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /attendance
 * Access: admin, teacher (own groups), student (own records)
 */
router.get("/", auth, getAttendances);

/**
 * GET /attendance/session?group=&date=
 * Per-enrollment snapshot for a single session day.
 * Access: admin, teacher (own group), student (if enrolled)
 */
router.get("/session", auth, getSessionAttendance);

/**
 * GET /attendance/sessions?group=&from=&to=
 * Expand group schedule into concrete dates.
 * Access: admin, teacher (own group), student (if enrolled)
 */
router.get("/sessions", auth, getScheduleSessions);

/**
 * GET /attendance/summary?group=&month=YYYY-MM
 * Per-enrollment present count + total sessions for the month.
 * Access: admin, teacher (own group)
 */
router.get("/summary", auth, getAttendanceSummary);

/**
 * POST /attendance/bulk
 * Access: teacher only (own group)
 */
router.post("/bulk", auth, roleCheck(["teacher"]), bulkMarkAttendance);

/**
 * PUT /attendance/:id
 * Access: teacher only (own group)
 */
router.put(
  "/:id",
  auth,
  roleCheck(["teacher"]),
  validateId("id"),
  updateAttendance,
);

/**
 * DELETE /attendance/:id
 * Access: admin only
 */
router.delete(
  "/:id",
  auth,
  roleCheck(["admin"]),
  validateId("id"),
  deleteAttendance,
);

module.exports = router;
