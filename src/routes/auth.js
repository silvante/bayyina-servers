const express = require("express");
const router = express.Router();

const { login, sendOtp, verifyOtp, profile } = require("../controllers/auth.controller");
const { auth } = require("../middlewares/auth");

/**
 * POST /auth/login
 * Login with phone + password
 * Access: Public
 */
router.post("/login", login);

/**
 * POST /auth/send-otp
 * Send OTP code to phone number
 * Access: Public
 */
router.post("/send-otp", sendOtp);

/**
 * POST /auth/verify-otp
 * Verify OTP and get token
 * Access: Public
 */
router.post("/verify-otp", verifyOtp);

/**
 * GET /auth/profile
 * Get current user profile
 * Access: Authenticated
 */
router.get("/profile", auth, profile);

module.exports = router;
