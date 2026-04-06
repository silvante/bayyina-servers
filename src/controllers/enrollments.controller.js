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
          select: "name price teacher",
          populate: { path: "teacher", select: "firstName lastName" },
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
        populate: { path: "teacher", select: "firstName lastName" },
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
  const {
    student, group,
    courseType, startDate, monthlyFee, discount, discountReason,
    paymentDay, lastPaymentDate, nextPaymentDate, debt, balance,
  } = req.body;

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

    const enrollment = await Enrollment.create({
      student, group,
      ...(courseType && { courseType }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(monthlyFee != null && { monthlyFee }),
      ...(discount != null && { discount }),
      ...(discountReason && { discountReason }),
      ...(paymentDay != null && { paymentDay }),
      ...(lastPaymentDate && { lastPaymentDate: new Date(lastPaymentDate) }),
      ...(nextPaymentDate && { nextPaymentDate: new Date(nextPaymentDate) }),
      ...(debt != null && { debt }),
      ...(balance != null && { balance }),
    });

    const populated = await enrollment.populate([
      { path: "student", select: "firstName lastName phone" },
      { path: "group", select: "name price" },
    ]);

    res.status(201).json({ enrollment: populated, code: "enrollmentCreated", message: texts.enrollmentCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /enrollments/:id — update status and financial fields
const updateEnrollment = async (req, res, next) => {
  try {
    const { status, courseType, startDate, monthlyFee, discount, discountReason, paymentDay, lastPaymentDate, nextPaymentDate, debt, balance } = req.body;
    const allowedStatuses = ["active", "completed", "dropped"];

    const updates = {};

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ code: "invalidStatus", message: "Status noto'g'ri" });
      }
      updates.status = status;
    }

    if (courseType !== undefined) updates.courseType = courseType;
    if (startDate !== undefined) updates.startDate = new Date(startDate);
    if (monthlyFee !== undefined) updates.monthlyFee = monthlyFee;
    if (discount !== undefined) updates.discount = discount;
    if (discountReason !== undefined) updates.discountReason = discountReason;
    if (paymentDay !== undefined) updates.paymentDay = paymentDay;
    if (lastPaymentDate !== undefined) updates.lastPaymentDate = new Date(lastPaymentDate);
    if (nextPaymentDate !== undefined) updates.nextPaymentDate = new Date(nextPaymentDate);
    if (debt !== undefined) updates.debt = debt;
    if (balance !== undefined) updates.balance = balance;

    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      updates,
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
