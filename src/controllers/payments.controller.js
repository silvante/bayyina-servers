const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, buildSearchRegex } = require("../utils/helpers");
const Payment = require("../models/Payment");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const recordService = require("../services/recordService");

const PAYMENT_UPDATABLE_FIELDS = ["status", "amount", "note", "paidAt"];

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

    const existingDebt = enrollmentDoc.debt || 0;
    const existingBalance = enrollmentDoc.balance || 0;

    // Shu oy uchun avvalroq to'lov bo'lganmi? (qo'shimcha to'lovmi yoki yangi oymi)
    const hasPriorPaymentForMonth = await Payment.exists({
      enrollment,
      month: { $gte: monthStart, $lte: monthEnd },
      status: "paid",
    });

    let newDebt, newBalance, shouldAdvanceNextPayment;

    if (hasPriorPaymentForMonth) {
      // Qo'shimcha to'lov: oylik to'lov majburiyati allaqachon hisoblangan.
      // Avval mavjud qarzni yopamiz, ortig'i balansga qo'shiladi.
      const totalAvailable = existingBalance + amount;

      if (totalAvailable >= existingDebt) {
        newDebt = 0;
        newBalance = totalAvailable - existingDebt;
        // Qarz hozir yopildi (ilgari bor edi) => keyingi to'lov sanasi suriladi
        shouldAdvanceNextPayment = existingDebt > 0;
      } else {
        newDebt = existingDebt - totalAvailable;
        newBalance = 0;
        shouldAdvanceNextPayment = false;
      }
    } else {
      // Yangi oy uchun birinchi to'lov: oylik to'lov majburiyati qo'shiladi.
      const totalAvailable = existingBalance + amount - existingDebt;

      if (totalAvailable >= effectiveFee) {
        newDebt = 0;
        newBalance = totalAvailable - effectiveFee;
        shouldAdvanceNextPayment = true;
      } else {
        newDebt = effectiveFee - totalAvailable;
        newBalance = 0;
        shouldAdvanceNextPayment = false;
      }
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

    const studentDoc = await User.findById(student).select("firstName lastName");
    const actor = recordService.actorFromReq(req);
    const refs = {
      studentId: student,
      enrollmentId: enrollment,
      groupId: enrollmentDoc.group?._id || enrollmentDoc.group,
      paymentId: payment._id,
    };

    await recordService.createRecord({
      eventType: "PAYMENT_CREATED",
      entityType: "Payment",
      entityId: payment._id,
      entity: payment,
      actor,
      refs,
      metadata: { student: studentDoc },
    });

    if (payment.status === "paid") {
      await recordService.createRecord({
        eventType: "PAYMENT_PAID",
        entityType: "Payment",
        entityId: payment._id,
        entity: payment,
        actor,
        refs,
        metadata: { student: studentDoc },
      });
    }

    res.status(201).json({ payment, code: "paymentCreated", message: texts.paymentCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /payments/:id — admin or teacher
const updatePayment = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, PAYMENT_UPDATABLE_FIELDS);

    if (updates.status === "paid" && !updates.paidAt) {
      updates.paidAt = new Date();
    }

    const existing = await Payment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "paymentNotFound", message: texts.paymentNotFound });
    }

    const payment = await Payment.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "student", select: "firstName lastName phone" });

    if (!payment) {
      return res.status(404).json({ code: "paymentNotFound", message: texts.paymentNotFound });
    }

    const actor = recordService.actorFromReq(req);
    const refs = {
      studentId: payment.student?._id || existing.student,
      enrollmentId: existing.enrollment,
      paymentId: payment._id,
    };
    const studentMeta = payment.student && payment.student.firstName
      ? payment.student
      : await User.findById(existing.student).select("firstName lastName");

    const diff = recordService.diffFields(
      existing.toObject(),
      payment.toObject(),
      PAYMENT_UPDATABLE_FIELDS,
    );

    if (diff) {
      await recordService.createRecord({
        eventType: "PAYMENT_UPDATED",
        entityType: "Payment",
        entityId: payment._id,
        entity: payment,
        actor,
        refs,
        changes: diff,
        metadata: { student: studentMeta },
      });
    }

    if (
      updates.status !== undefined &&
      existing.status !== payment.status &&
      payment.status === "paid"
    ) {
      await recordService.createRecord({
        eventType: "PAYMENT_PAID",
        entityType: "Payment",
        entityId: payment._id,
        entity: payment,
        actor,
        refs,
        metadata: { student: studentMeta },
      });
    }

    res.json({ payment, code: "paymentUpdated", message: texts.paymentUpdated });
  } catch (err) {
    next(err);
  }
};

// GET /payments/search
// Searches across note (text), amount and student phone (numeric). Free-text q
// also matches student first/last name. Filters: status, student, enrollment,
// minAmount, maxAmount, month (YYYY-MM), from, to (paidAt range).
const searchPayments = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.user.role === "student") {
      filter.student = req.user._id;
    } else if (req.query.student) {
      filter.student = req.query.student;
    }

    if (req.query.status) filter.status = req.query.status;
    if (req.query.enrollment) filter.enrollment = req.query.enrollment;

    if (req.query.amount !== undefined && req.query.amount !== "") {
      const amountNum = Number(req.query.amount);
      if (!Number.isNaN(amountNum)) filter.amount = amountNum;
    }
    if (req.query.minAmount !== undefined || req.query.maxAmount !== undefined) {
      const amountRange = {};
      const min = Number(req.query.minAmount);
      const max = Number(req.query.maxAmount);
      if (!Number.isNaN(min)) amountRange.$gte = min;
      if (!Number.isNaN(max)) amountRange.$lte = max;
      if (Object.keys(amountRange).length) filter.amount = amountRange;
    }

    if (req.query.month) {
      const match = /^(\d{4})-(\d{1,2})$/.exec(String(req.query.month).trim());
      if (match) {
        const year = Number(match[1]);
        const monthIdx = Number(match[2]) - 1;
        const start = new Date(year, monthIdx, 1);
        const end = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999);
        filter.month = { $gte: start, $lte: end };
      }
    }

    if (req.query.from || req.query.to) {
      const range = {};
      if (req.query.from) {
        const fromDate = new Date(req.query.from);
        if (!Number.isNaN(fromDate.getTime())) range.$gte = fromDate;
      }
      if (req.query.to) {
        const toDate = new Date(req.query.to);
        if (!Number.isNaN(toDate.getTime())) range.$lte = toDate;
      }
      if (Object.keys(range).length) filter.paidAt = range;
    }

    const regex = buildSearchRegex(req.query.q);
    if (regex) {
      const orClauses = [{ note: regex }];
      const numeric = Number(String(req.query.q).trim());
      if (!Number.isNaN(numeric)) {
        orClauses.push({ amount: numeric });
      }

      // Resolve student references by name/phone — but never override a student-scope filter.
      if (req.user.role !== "student") {
        const studentMatch = {
          role: "student",
          $or: [{ firstName: regex }, { lastName: regex }],
        };
        if (!Number.isNaN(numeric)) {
          studentMatch.$or.push({ phone: numeric });
        }
        const students = await User.find(studentMatch).select("_id");
        if (students.length) {
          orClauses.push({ student: { $in: students.map((s) => s._id) } });
        }
      }

      filter.$or = orClauses;
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

module.exports = { getPayments, getPayment, createPayment, updatePayment, searchPayments };
