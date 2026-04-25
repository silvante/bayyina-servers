const express = require("express");
const router = express.Router();

const { getRejectionReasons, getRejectionReason, createRejectionReason, updateRejectionReason, deleteRejectionReason } = require("../controllers/rejectionReasons.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

router.get("/", auth, roleCheck(["admin"]), getRejectionReasons);
router.get("/:id", auth, roleCheck(["admin"]), validateId("id"), getRejectionReason);
router.post("/", auth, roleCheck(["admin"]), createRejectionReason);
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateRejectionReason);
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteRejectionReason);

module.exports = router;
