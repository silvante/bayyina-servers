const express = require("express");
const router = express.Router();

const { getUsers, getUser, createUser, updateUser, deleteUser } = require("../controllers/users.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * GET /users
 * Access: admin, teacher, student (scoped)
 */
router.get("/", auth, getUsers);

/**
 * GET /users/:id
 * Access: admin, teacher
 */
router.get("/:id", auth, validateId("id"), getUser);

/**
 * POST /users
 * Create teacher or student account
 * Access: admin only
 */
router.post("/", auth, roleCheck(["admin"]), createUser);

/**
 * PUT /users/:id
 * Access: admin (any user), student (self only)
 */
router.put("/:id", auth, validateId("id"), updateUser);

/**
 * DELETE /users/:id
 * Access: admin only
 */
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteUser);

module.exports = router;
