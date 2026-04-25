const express = require("express");
const router = express.Router();

const { getCourseTypes, getCourseType, createCourseType, updateCourseType, deleteCourseType } = require("../controllers/courseTypes.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

router.get("/", auth, roleCheck(["admin"]), getCourseTypes);
router.get("/:id", auth, roleCheck(["admin"]), validateId("id"), getCourseType);
router.post("/", auth, roleCheck(["admin"]), createCourseType);
router.put("/:id", auth, roleCheck(["admin"]), validateId("id"), updateCourseType);
router.delete("/:id", auth, roleCheck(["admin"]), validateId("id"), deleteCourseType);

module.exports = router;
