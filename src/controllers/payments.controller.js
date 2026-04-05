const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta } = require("../utils/helpers");
const Payment = require("../models/Payment");

// GET /payments
const getPayments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.enrollment) filter.enrollment = req.query.enrollment;
    if (req.query.status) filter.status = req.query.status;

    // Students only see own payments
    if (req.user.role === "student") {
      filter.student = req.user._id;
    } else if (req.query.student) {
      filter.student = req.query.student;
    }

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate({ path: "student", select: "firstName lastName phone" })
        .populate({ path: "enrollment", select: "group status" })
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ month: -1 }),
      Payment.countDocuments(filter),
    ]);

    res.json({
      payments,
      ...buildPaginationMeta(total, page, limit),
      code: "paymentsFound",
      message: texts.paymentsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /payments/:id
const getPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate({ path: "student", select: "firstName lastName phone" })
      .populate({ path: "enrollment", select: "group status" });

    if (!payment) {
      return res.status(404).json({ code: "paymentNotFound", message: texts.paymentNotFound });
    }

    // Students can only see own payments
    if (req.user.role === "student" && String(payment.student._id) !== String(req.user._id)) {
      return res.status(403).json({ code: "forbidden", message: texts.forbidden });
    }

    res.json({ payment, code: "paymentsFound", message: texts.paymentsFound });
  } catch (err) {
    next(err);
  }
};

// POST /payments — admin or teacher
const createPayment = async (req, res, next) => {
  const { enrollment, student, amount, month, note } = req.body;

  if (!enrollment) {
    return res.status(400).json({ code: "missingField", message: "Ro'yxatga olish kiritilishi shart" });
  }
  if (!student) {
    return res.status(400).json({ code: "missingField", message: "O'quvchi kiritilishi shart" });
  }
  if (!amount || amount <= 0) {
    return res.status(400).json({ code: "missingField", message: "To'lov miqdori kiritilishi shart" });
  }
  if (!month) {
    return res.status(400).json({ code: "missingField", message: "Oy kiritilishi shart" });
  }

  try {
    const payment = await Payment.create({
      enrollment,
      student,
      amount,
      month: new Date(month),
      note,
      status: "paid",
      paidAt: new Date(),
      createdBy: req.user._id,
    });

    res.status(201).json({ payment, code: "paymentCreated", message: texts.paymentCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /payments/:id — admin or teacher
const updatePayment = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, ["status", "amount", "note", "paidAt"]);

    if (updates.status === "paid" && !updates.paidAt) {
      updates.paidAt = new Date();
    }

    const payment = await Payment.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "student", select: "firstName lastName phone" });

    if (!payment) {
      return res.status(404).json({ code: "paymentNotFound", message: texts.paymentNotFound });
    }

    res.json({ payment, code: "paymentUpdated", message: texts.paymentUpdated });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPayments, getPayment, createPayment, updatePayment };
