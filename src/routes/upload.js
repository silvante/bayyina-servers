const express = require("express");
const router = express.Router();

const { uploadImage } = require("../controllers/upload.controller");
const { auth } = require("../middlewares/auth");
const { upload } = require("../utils/multer");

/**
 * POST /upload/image
 * Upload a single image
 * Access: authenticated
 */
router.post("/image", auth, upload.single("image"), uploadImage);

module.exports = router;
