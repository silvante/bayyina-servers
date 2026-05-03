const mongoose = require("mongoose");
const texts = require("../data/texts");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");
const SalaryAdvance = require("../models/SalaryAdvance");
const Salary = require("../models/Salary");
const User = require("../models/User");
const recordService = require("../services/recordService");

const round = (n) => Math.round(Number(n) || 0);

function monthStart(input) {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function nextMonthStart(base, offsetMonths) {
  const d = new Date(base);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offsetMonths, 1, 0, 0, 0, 0));
}

// GET /salaries/advances
const getAdvances = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    // teacher sees own
    if (req.user.role === "teacher") filter.teacher = req.user._id;

    const [advances, total] = await Promise.all([
      SalaryAdvance.find(filter)
        .populate({ path: "teacher", select: "firstName lastName phone" })
        .populate({ path: "confirmedBy", select: "firstName lastName" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SalaryAdvance.countDocuments(filter),
    ]);

    res.json({
      advances,
      ...buildPaginationMeta(total, page, limit),
      code: "advancesFound",
      message: texts.advancesFound,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries/advances  (admin)
const createAdvance = async (req, res, next) => {
  try {
    const { teacher, type = "advance", months = 1, amount, note, date, salaryMonth } = req.body;

    if (!teacher || !amount || !date) {
      return res.status(400).json({ code: "missingField", message: texts.missingField });
    }
    if (!mongoose.Types.ObjectId.isValid(teacher)) {
      return res.status(400).json({ code: "missingField", message: "O'qituvchi ID noto'g'ri" });
    }

    const teacherDoc = await User.findById(teacher).select("firstName lastName role");
    if (!teacherDoc) {
      return res.status(404).json({ code: "userNotFound", message: texts.userNotFound });
    }
    if (teacherDoc.role !== "teacher") {
      return res.status(400).json({ code: "notATeacher", message: texts.notATeacher });
    }

    // For advance type: check no active advance already exists for covered months
    if (type === "advance") {
      const numMonths = Math.min(Math.max(Number(months) || 1, 1), 2);
      const now = new Date();
      const coveredMonths = [];
      for (let i = 1; i <= numMonths; i++) {
        coveredMonths.push(nextMonthStart(now, i));
      }

      // Check for existing active advance covering any of these months
      const conflict = await SalaryAdvance.findOne({
        teacher,
        status: { $in: ["pending", "confirmed"] },
        coveredMonths: { $in: coveredMonths },
      });
      if (conflict) {
        return res.status(400).json({
          code: "advanceExists",
          message: texts.advanceExists,
        });
      }

      const advance = await SalaryAdvance.create({
        teacher,
        type: "advance",
        months: numMonths,
        amount: round(Number(amount)),
        note: note?.trim(),
        date: new Date(date),
        status: "pending",
        coveredMonths,
        createdBy: req.user._id,
      });

      return res.status(201).json({
        advance,
        code: "advanceCreated",
        message: texts.advanceCreated,
      });
    }

    // Partial type
    const ms = salaryMonth ? monthStart(salaryMonth) : monthStart(new Date());
    if (!ms) {
      return res.status(400).json({ code: "invalidMonth", message: texts.invalidMonth });
    }

    const advance = await SalaryAdvance.create({
      teacher,
      type: "partial",
      months: 0,
      amount: round(Number(amount)),
      note: note?.trim(),
      date: new Date(date),
      status: "pending",
      salaryMonth: ms,
      createdBy: req.user._id,
    });

    res.status(201).json({
      advance,
      code: "advanceCreated",
      message: texts.advanceCreated,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries/advances/request  (teacher self-request for partial)
const requestPartialAdvance = async (req, res, next) => {
  try {
    const { amount, note, date } = req.body;
    const teacher = req.user._id;

    if (!amount || !date) {
      return res.status(400).json({ code: "missingField", message: texts.missingField });
    }

    const ms = monthStart(new Date());

    // Check existing pending request this month
    const existing = await SalaryAdvance.findOne({
      teacher,
      type: "partial",
      status: "pending",
      salaryMonth: ms,
    });
    if (existing) {
      return res.status(400).json({
        code: "advanceExists",
        message: "Siz allaqachon bu oy uchun so'rov yuborgansiz. Admin tasdiqlashini kuting.",
      });
    }

    const advance = await SalaryAdvance.create({
      teacher,
      type: "partial",
      months: 0,
      amount: round(Number(amount)),
      note: note?.trim(),
      date: new Date(date),
      status: "pending",
      salaryMonth: ms,
      createdBy: teacher,
    });

    res.status(201).json({
      advance,
      code: "advanceCreated",
      message: texts.advanceCreated,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /salaries/advances/:id/confirm  (admin)
const confirmAdvance = async (req, res, next) => {
  try {
    const advance = await SalaryAdvance.findById(req.params.id);
    if (!advance) {
      return res.status(404).json({ code: "advanceNotFound", message: texts.advanceNotFound });
    }
    if (advance.status !== "pending") {
      return res.status(400).json({ code: "alreadyConfirmed", message: texts.alreadyConfirmed });
    }

    const confirmed = await SalaryAdvance.findByIdAndUpdate(
      advance._id,
      { status: "confirmed", confirmedBy: req.user._id, confirmedAt: new Date() },
      { new: true },
    ).populate({ path: "teacher", select: "firstName lastName" });

    // Apply to existing salary records for covered months
    if (advance.type === "advance" && advance.coveredMonths?.length) {
      for (const cm of advance.coveredMonths) {
        const salary = await Salary.findOne({ teacher: advance.teacher, month: cm });
        if (salary) {
          const adv = round((salary.advanceDeducted || 0) + advance.amount / advance.months);
          const net = round((salary.totalAmount || 0) + (salary.bonus || 0) - (salary.deduction || 0) - adv);
          await Salary.findByIdAndUpdate(salary._id, { advanceDeducted: adv, netAmount: net });
        }
      }
    }

    // Partial: apply to salary for that month
    if (advance.type === "partial" && advance.salaryMonth) {
      const salary = await Salary.findOne({ teacher: advance.teacher, month: advance.salaryMonth });
      if (salary) {
        const adv = round((salary.advanceDeducted || 0) + advance.amount);
        const net = round((salary.totalAmount || 0) + (salary.bonus || 0) - (salary.deduction || 0) - adv);
        await Salary.findByIdAndUpdate(salary._id, { advanceDeducted: adv, netAmount: net });
      }
    }

    await recordService.createRecord({
      eventType: "ADVANCE_CONFIRMED",
      entityType: "SalaryAdvance",
      entityId: confirmed._id,
      entity: confirmed,
      actor: recordService.actorFromReq(req),
      refs: { teacherId: advance.teacher },
    });

    res.json({
      advance: confirmed,
      code: "advanceConfirmed",
      message: texts.advanceConfirmed,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /salaries/advances/:id  (admin)
const deleteAdvance = async (req, res, next) => {
  try {
    const advance = await SalaryAdvance.findById(req.params.id);
    if (!advance) {
      return res.status(404).json({ code: "advanceNotFound", message: texts.advanceNotFound });
    }

    // If confirmed, reverse the advanceDeducted from affected salaries
    if (advance.status === "confirmed") {
      if (advance.type === "advance" && advance.coveredMonths?.length) {
        for (const cm of advance.coveredMonths) {
          const salary = await Salary.findOne({ teacher: advance.teacher, month: cm });
          if (salary) {
            const adv = Math.max(0, round((salary.advanceDeducted || 0) - advance.amount / advance.months));
            const net = round((salary.totalAmount || 0) + (salary.bonus || 0) - (salary.deduction || 0) - adv);
            await Salary.findByIdAndUpdate(salary._id, { advanceDeducted: adv, netAmount: net });
          }
        }
      }
      if (advance.type === "partial" && advance.salaryMonth) {
        const salary = await Salary.findOne({ teacher: advance.teacher, month: advance.salaryMonth });
        if (salary) {
          const adv = Math.max(0, round((salary.advanceDeducted || 0) - advance.amount));
          const net = round((salary.totalAmount || 0) + (salary.bonus || 0) - (salary.deduction || 0) - adv);
          await Salary.findByIdAndUpdate(salary._id, { advanceDeducted: adv, netAmount: net });
        }
      }
    }

    await SalaryAdvance.findByIdAndDelete(advance._id);

    res.json({ code: "advanceDeleted", message: texts.advanceDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdvances,
  createAdvance,
  requestPartialAdvance,
  confirmAdvance,
  deleteAdvance,
};
