const express = require("express");
const router = express.Router();

const { getPayments, getPayment, createPayment, updatePayment, searchPayments } = require("../controllers/payments.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /payments/search
 * Access: admin, teacher, student (scoped)
 */
router.get("/search", auth, searchPayments);

/**
 * GET /payments
 * Access: admin, teacher, student (scoped)
 */
router.get("/", auth, getPayments);

/**
 * GET /payments/:id
 * Access: admin, teacher, student (own)
 */
router.get("/:id", auth, validateId("id"), getPayment);

/**
 * POST /payments
 * Access: admin, teacher
 */
router.post("/", auth, roleCheck(["admin", "teacher"]), createPayment);

/**
 * PUT /payments/:id
 * Access: admin, teacher
 */
router.put("/:id", auth, roleCheck(["admin", "teacher"]), validateId("id"), updatePayment);

module.exports = router;
