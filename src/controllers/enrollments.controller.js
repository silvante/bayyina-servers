const texts = require("../data/texts");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");
const Enrollment = require("../models/Enrollment");

// GET /enrollments
const getEnrollments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.group) filter.group = req.query.group;
    if (req.query.student) filter.student = req.query.student;
    if (req.query.status) filter.status = req.query.status;

    // Students only see own enrollments
    if (req.user.role === "student") {
      filter.student = req.user._id;
    }

    const [enrollments, total] = await Promise.all([
      Enrollment.find(filter)
        .populate({ path: "student", select: "firstName lastName phone" })
        .populate({
          path: "group",
          select: "name course teacher",
          populate: [
            { path: "course", select: "name price" },
            { path: "teacher", select: "firstName lastName" },
          ],
        })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Enrollment.countDocuments(filter),
    ]);

    res.json({
      enrollments,
      ...buildPaginationMeta(total, page, limit),
      code: "enrollmentsFound",
      message: texts.enrollmentsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /enrollments/:id
const getEnrollment = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate({ path: "student", select: "firstName lastName phone" })
      .populate({
        path: "group",
        populate: [
          { path: "course", select: "name price" },
          { path: "teacher", select: "firstName lastName" },
        ],
      });

    if (!enrollment) {
      return res.status(404).json({ code: "enrollmentNotFound", message: texts.enrollmentNotFound });
    }

    // Students can only see own enrollment
    if (req.user.role === "student" && String(enrollment.student._id) !== String(req.user._id)) {
      return res.status(403).json({ code: "forbidden", message: texts.forbidden });
    }

    res.json({ enrollment, code: "enrollmentsFound", message: texts.enrollmentsFound });
  } catch (err) {
    next(err);
  }
};

// POST /enrollments — admin or teacher
const createEnrollment = async (req, res, next) => {
  const { student, group } = req.body;

  if (!student) {
    return res.status(400).json({ code: "missingField", message: "O'quvchi kiritilishi shart" });
  }
  if (!group) {
    return res.status(400).json({ code: "missingField", message: "Guruh kiritilishi shart" });
  }

  try {
    const existing = await Enrollment.findOne({ student, group, status: "active" });
    if (existing) {
      return res.status(400).json({ code: "alreadyEnrolled", message: texts.alreadyEnrolled });
    }

    const enrollment = await Enrollment.create({ student, group });

    const populated = await enrollment.populate([
      { path: "student", select: "firstName lastName phone" },
      { path: "group", select: "name course" },
    ]);

    res.status(201).json({ enrollment: populated, code: "enrollmentCreated", message: texts.enrollmentCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /enrollments/:id — update status
const updateEnrollment = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["active", "completed", "dropped"];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ code: "invalidStatus", message: "Status noto'g'ri" });
    }

    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate({ path: "student", select: "firstName lastName phone" });

    if (!enrollment) {
      return res.status(404).json({ code: "enrollmentNotFound", message: texts.enrollmentNotFound });
    }

    res.json({ enrollment, code: "enrollmentUpdated", message: texts.enrollmentUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /enrollments/:id — admin only
const deleteEnrollment = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findByIdAndDelete(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ code: "enrollmentNotFound", message: texts.enrollmentNotFound });
    }
    res.json({ code: "enrollmentDeleted", message: texts.enrollmentDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getEnrollments, getEnrollment, createEnrollment, updateEnrollment, deleteEnrollment };
