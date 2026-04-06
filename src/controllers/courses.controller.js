const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta } = require("../utils/helpers");
const Course = require("../models/Course");

// GET /courses
const getCourses = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Course.countDocuments(filter),
    ]);

    res.json({
      courses,
      ...buildPaginationMeta(total, page, limit),
      code: "coursesFound",
      message: texts.coursesFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /courses/:id
const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!course) {
      return res.status(404).json({ code: "courseNotFound", message: texts.courseNotFound });
    }

    res.json({ course, code: "coursesFound", message: texts.coursesFound });
  } catch (err) {
    next(err);
  }
};

// POST /courses — admin only
const createCourse = async (req, res, next) => {
  const { name, description, duration, price } = req.body;

  if (!name) {
    return res.status(400).json({ code: "missingField", message: "Kurs nomi kiritilishi shart" });
  }

  if (price === undefined || price === null) {
    return res.status(400).json({ code: "missingField", message: "Narx kiritilishi shart" });
  }

  try {
    const course = await Course.create({
      name,
      description,
      duration,
      price,
      createdBy: req.user._id,
    });

    res.status(201).json({ course, code: "courseCreated", message: texts.courseCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /courses/:id — admin only
const updateCourse = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, ["name", "description", "duration", "price", "isActive"]);

    const course = await Course.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!course) {
      return res.status(404).json({ code: "courseNotFound", message: texts.courseNotFound });
    }

    res.json({ course, code: "courseUpdated", message: texts.courseUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /courses/:id — admin only
const deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res.status(404).json({ code: "courseNotFound", message: texts.courseNotFound });
    }
    res.json({ code: "courseDeleted", message: texts.courseDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCourses, getCourse, createCourse, updateCourse, deleteCourse };
