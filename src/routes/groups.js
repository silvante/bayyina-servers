const express = require("express");
const router = express.Router();

const { getGroups, getGroup, createGroup, updateGroup, deleteGroup, searchGroups } = require("../controllers/groups.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /groups/search
 * Access: admin, teacher (own scope)
 */
router.get("/search", auth, roleCheck(["admin", "teacher"]), searchGroups);

/**
 * GET /groups
 * Access: admin (all), teacher (own groups)
 */
router.get("/", auth, roleCheck(["admin", "teacher"]), getGroups);

/**
 * GET /groups/:id
 * Access: admin, teacher (own)
 */
router.get("/:id", auth, roleCheck(["admin", "teacher"]), validateId("id"), getGroup);

/**
 * POST /groups
 * Access: admin only
 */
router.post("/", auth, roleCheck(["admin"]), createGroup);

/**
 * PUT /groups/:id
 * Access: admin only
 */
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateGroup);

/**
 * DELETE /groups/:id
 * Access: admin only
 */
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteGroup);

module.exports = router;
