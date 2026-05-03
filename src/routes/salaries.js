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
  bulkPay,
  deleteSalary,
} = require("../controllers/salaries.controller");
const {
  getDeductions,
  createDeduction,
  confirmDeduction,
  deleteDeduction,
} = require("../controllers/salaryDeductions.controller");
const {
  getAdvances,
  createAdvance,
  requestPartialAdvance,
  confirmAdvance,
  deleteAdvance,
} = require("../controllers/salaryAdvances.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

// ── Static / sub-resource routes first (before /:id catches them) ─────────────

router.get("/calculate",  auth, roleCheck(["admin"]), calculateSalary);
router.post("/generate",  auth, roleCheck(["admin"]), generateSalaries);
router.post("/bulk-pay",  auth, roleCheck(["admin"]), bulkPay);

// Deductions
router.get("/deductions",              auth, roleCheck(["admin"]), getDeductions);
router.post("/deductions",             auth, roleCheck(["admin"]), createDeduction);
router.put("/deductions/:id/confirm",  auth, roleCheck(["admin"]), validateId("id"), confirmDeduction);
router.delete("/deductions/:id",       auth, roleCheck(["admin"]), validateId("id"), deleteDeduction);

// Advances
router.get("/advances",                auth, roleCheck(["admin", "teacher"]), getAdvances);
router.post("/advances/request",       auth, roleCheck(["teacher"]), requestPartialAdvance);
router.post("/advances",               auth, roleCheck(["admin"]), createAdvance);
router.put("/advances/:id/confirm",    auth, roleCheck(["admin"]), validateId("id"), confirmAdvance);
router.delete("/advances/:id",         auth, roleCheck(["admin"]), validateId("id"), deleteAdvance);

// ── Collection ────────────────────────────────────────────────────────────────
router.get("/",   auth, roleCheck(["admin", "teacher"]), getSalaries);
router.post("/",  auth, roleCheck(["admin"]), createSalary);

// ── Single record ─────────────────────────────────────────────────────────────
router.get("/:id",        auth, roleCheck(["admin", "teacher"]), validateId("id"), getSalary);
router.put("/:id",        auth, roleCheck(["admin"]), validateId("id"), updateSalary);
router.post("/:id/pay",   auth, roleCheck(["admin"]), validateId("id"), paySalary);
router.delete("/:id",     auth, roleCheck(["admin"]), validateId("id"), deleteSalary);

module.exports = router;
