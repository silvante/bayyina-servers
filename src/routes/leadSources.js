const express = require("express");
const router = express.Router();

const { getLeadSources, getLeadSource, createLeadSource, updateLeadSource, deleteLeadSource } = require("../controllers/leadSources.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

router.get("/", auth, roleCheck(["admin"]), getLeadSources);
router.get("/:id", auth, roleCheck(["admin"]), validateId("id"), getLeadSource);
router.post("/", auth, roleCheck(["admin"]), createLeadSource);
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateLeadSource);
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteLeadSource);

module.exports = router;
