const express = require("express");
const router  = express.Router();

const { getSelectOptions, getTypes } = require("../controllers/selectOptions.controller");
const { auth, roleCheck }            = require("../middlewares/auth");

// GET /select-options/types — available types meta
router.get("/types", auth, roleCheck(["admin"]), getTypes);

// GET /select-options?type=lead_source
router.get("/", auth, roleCheck(["admin"]), getSelectOptions);

module.exports = router;
