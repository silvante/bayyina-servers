const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta } = require("../utils/helpers");
const Payment = require("../models/Payment");
const Enrollment = require("../models/Enrollment");

// Returns the next date that falls on `day` of month, starting from `fromDate`
function getNextPaymentDate(fromDate, day) {
  const d = new Date(fromDate);
  // Move to the next month
  d.setMonth(d.getMonth() + 1);
  // Clamp day to the last day of that month (e.g. day=31 in April → 30)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  d.setHours(0, 0, 0, 0);
  return d;
}

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
    const paidAt = new Date();

    const enrollmentDoc = await Enrollment.findById(enrollment).populate("group");
    if (!enrollmentDoc) {
      return res.status(404).json({ code: "enrollmentNotFound", message: "Ro'yxatga olish topilmadi" });
    }

    // Enrollment holati "active" bolmasa => Tolov rad etiladi
    if (enrollmentDoc.status !== "active") {
      return res.status(400).json({
        code: "enrollmentNotActive",
        message: `Bu o'quvchi ro'yxati "${enrollmentDoc.status}" holatida, to'lov qabul qilinmaydi`,
      });
    }

    // Shu Oy uchun Tolov allaqachon amalga oshirilgan bolsa => Takroriy tolov rad etiladi
    const paymentMonth = new Date(month);
    const monthStart = new Date(paymentMonth.getFullYear(), paymentMonth.getMonth(), 1);
    const monthEnd = new Date(paymentMonth.getFullYear(), paymentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Double payment are acceptable
    
    // const existingPayment = await Payment.findOne({
    //   enrollment,
    //   month: { $gte: monthStart, $lte: monthEnd },
    //   status: "paid",
    // });
    // if (existingPayment) {
    //   return res.status(400).json({
    //     code: "duplicatePayment",
    //     message: "Bu oy uchun to'lov allaqachon amalga oshirilgan",
    //   });
    // }

    // Chegirmani hisobga olgan holda samarali oylik to'lovni hisoblash
    const monthlyFee = enrollmentDoc.group?.price ?? 0;
    const effectiveFee = Math.max(0, monthlyFee - (enrollmentDoc.discount || 0));

    // Mavjud balans + yangi to'lov - mavjud qarz
    const existingDebt = enrollmentDoc.debt || 0;
    const totalAvailable = (enrollmentDoc.balance || 0) + amount - existingDebt;

    let newDebt, newBalance, shouldAdvanceNextPayment;

    if (totalAvailable === effectiveFee) {
      // Pul oylik tolovga teng => NextPaymentDate ozgaradi, debt: 0, balance: 0
      newDebt = 0;
      newBalance = 0;
      shouldAdvanceNextPayment = true;
    } else if (totalAvailable < effectiveFee) {
      // Pul oylik tolovdan kam => NextPaymentDate ozgarmaydi, debt: yetishmagan miqdor, balance: 0
      newDebt = effectiveFee - totalAvailable;
      newBalance = 0;
      shouldAdvanceNextPayment = false;
    } else {
      // Pul oylik tolovdan kop => NextPaymentDate ozgaradi, debt: 0, balance: ortiqcha miqdor
      newDebt = 0;
      newBalance = totalAvailable - effectiveFee;
      shouldAdvanceNextPayment = true;
    }

    const payment = await Payment.create({
      enrollment,
      student,
      amount,
      month: new Date(month),
      note,
      status: "paid",
      paidAt,
      createdBy: req.user._id,
    });

    const paymentDay = enrollmentDoc.paymentDay || paidAt.getDate();
    const enrollmentUpdate = {
      lastPaymentDate: paidAt,
      debt: newDebt,
      balance: newBalance,
      paymentDay,
      nextPaymentDate: shouldAdvanceNextPayment ? getNextPaymentDate(paidAt, paymentDay) : undefined,
    };

    await Enrollment.findByIdAndUpdate(enrollment, enrollmentUpdate);

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
