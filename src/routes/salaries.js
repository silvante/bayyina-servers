const express = require("express");
const router = express.Router();

const {
  getSalaries,
  getSalary,
  calculateSalary,
  generateSalaries,
  createSalary,
  updateSalary,
  paySalary,
  deleteSalary,
} = require("../controllers/salaries.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /salaries/calculate
 * Preview a teacher's salary for a given month without persisting.
 * Access: admin only
 */
router.get("/calculate", auth, roleCheck(["admin"]), calculateSalary);

/**
 * POST /salaries/generate
 * Generate salary records for all teachers (or a subset) for a given month.
 * Access: admin only
 */
router.post("/generate", auth, roleCheck(["admin"]), generateSalaries);

/**
 * GET /salaries
 * Access: admin (all), teacher (own only — auto-filtered)
 */
router.get("/", auth, roleCheck(["admin", "teacher"]), getSalaries);

/**
 * GET /salaries/:id
 * Access: admin, teacher (own)
 */
router.get("/:id", auth, roleCheck(["admin", "teacher"]), validateId("id"), getSalary);

/**
 * POST /salaries
 * Manually create a single salary record. Auto-computes from groups + payments.
 * Access: admin only
 */
router.post("/", auth, roleCheck(["admin"]), createSalary);

/**
 * PUT /salaries/:id
 * Update bonus, deduction, note or status (which triggers SALARY_PAID record on paid).
 * Access: admin only
 */
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateSalary);

/**
 * POST /salaries/:id/pay
 * Convenience endpoint to mark a salary as paid (status=paid, paidAt=now).
 * Access: admin only
 */
router.post("/:id/pay", auth, roleCheck(["admin"]), validateId("id"), paySalary);

/**
 * DELETE /salaries/:id
 * Access: admin only
 */
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteSalary);

module.exports = router;
