const express = require("express");
const router = express.Router();

const {
  getRecords,
  getRecord,
  getEntityTimeline,
} = require("../controllers/records.controller");
const { auth, roleCheck } = require("../middlewares/auth");

router.get("/", auth, roleCheck(["admin"]), getRecords);
router.get(
  "/entity/:entityType/:entityId",
  auth,
  roleCheck(["admin"]),
  getEntityTimeline,
);
router.get("/:id", auth, roleCheck(["admin"]), getRecord);

module.exports = router;
