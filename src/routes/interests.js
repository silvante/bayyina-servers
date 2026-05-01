const express = require("express");
const router = express.Router();

const { getInterests, getInterest, createInterest, updateInterest, deleteInterest } = require("../controllers/interests.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

router.get("/", auth, roleCheck(["admin", "teacher"]), getInterests);
router.get("/:id", auth, roleCheck(["admin"]), validateId("id"), getInterest);
router.post("/", auth, roleCheck(["admin"]), createInterest);
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateInterest);
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteInterest);

module.exports = router;
