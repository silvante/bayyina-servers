const express = require("express");
const router = express.Router();

const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  trackLeadClick,
} = require("../controllers/leads.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /leads/track/:uniqueLink
 * Public — records a referral-link click.
 * Declared before /:id so it is not matched by the ObjectId validator.
 */
router.get("/track/:uniqueLink", trackLeadClick);

/**
 * GET /leads
 * Access: admin, teacher
 */
router.get("/", auth, roleCheck(["admin", "teacher"]), getLeads);

/**
 * GET /leads/:id
 * Access: admin, teacher
 */
router.get("/:id", auth, roleCheck(["admin", "teacher"]), validateId("id"), getLead);

/**
 * POST /leads
 * Access: admin, teacher
 */
router.post("/", auth, roleCheck(["admin", "teacher"]), createLead);

/**
 * PUT /leads/:id
 * Access: admin, teacher
 */
router.put("/:id", auth, roleCheck(["admin", "teacher"]), validateId("id"), updateLead);

/**
 * DELETE /leads/:id
 * Access: admin
 */
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteLead);

module.exports = router;
