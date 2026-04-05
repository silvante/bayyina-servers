const express = require("express");
const router = express.Router();

const { getCourses, getCourse, createCourse, updateCourse, deleteCourse } = require("../controllers/courses.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /courses
 * Access: authenticated
 */
router.get("/", auth, getCourses);

/**
 * GET /courses/:id
 * Access: authenticated
 */
router.get("/:id", auth, validateId("id"), getCourse);

/**
 * POST /courses
 * Access: admin only
 */
router.post("/", auth, roleCheck(["admin"]), createCourse);

/**
 * PUT /courses/:id
 * Access: admin only
 */
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateCourse);

/**
 * DELETE /courses/:id
 * Access: admin only
 */
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteCourse);

module.exports = router;
