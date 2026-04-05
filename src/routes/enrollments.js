const express = require("express");
const router = express.Router();

const {
  getEnrollments,
  getEnrollment,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
} = require("../controllers/enrollments.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /enrollments
 * Access: admin, teacher, student (scoped)
 */
router.get("/", auth, getEnrollments);

/**
 * GET /enrollments/:id
 * Access: admin, teacher, student (own)
 */
router.get("/:id", auth, validateId("id"), getEnrollment);

/**
 * POST /enrollments
 * Access: admin, teacher
 */
router.post("/", auth, roleCheck(["admin", "teacher"]), createEnrollment);

/**
 * PUT /enrollments/:id
 * Update enrollment status
 * Access: admin, teacher
 */
router.put("/:id", auth, roleCheck(["admin", "teacher"]), validateId("id"), updateEnrollment);

/**
 * DELETE /enrollments/:id
 * Access: admin only
 */
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteEnrollment);

module.exports = router;
