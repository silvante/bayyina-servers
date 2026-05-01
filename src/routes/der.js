const express = require("express");
const router  = express.Router();
const { auth, roleCheck } = require("../middlewares/auth");
const {
  getDerStats,
  getMyDerStats,
  getDerConfig,
  updateDerConfig,
} = require("../controllers/der.controller");

// GET /attendance/der/config  — admin
router.get("/config", auth, roleCheck(["admin"]), getDerConfig);

// PUT /attendance/der/config  — admin
router.put("/config", auth, roleCheck(["admin"]), updateDerConfig);

// GET /attendance/der/stats?group=&from=&to=  — admin, teacher
router.get("/stats", auth, roleCheck(["admin", "teacher"]), getDerStats);

// GET /attendance/der/my-stats?from=&to=&group=  — student
router.get("/my-stats", auth, roleCheck(["student"]), getMyDerStats);

module.exports = router;
