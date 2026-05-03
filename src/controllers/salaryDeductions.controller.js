const mongoose = require("mongoose");
const texts = require("../data/texts");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");
const SalaryDeduction = require("../models/SalaryDeduction");
const Salary = require("../models/Salary");
const User = require("../models/User");
const recordService = require("../services/recordService");

const round = (n) => Math.round(Number(n) || 0);

function monthStart(input) {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

// GET /salaries/deductions
const getDeductions = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};
    if (req.query.teacher) filter.teacher = req.query.teacher;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.month) {
      const ms = monthStart(req.query.month);
      if (ms) filter.month = ms;
    }

    const [deductions, total] = await Promise.all([
      SalaryDeduction.find(filter)
        .populate({ path: "teacher", select: "firstName lastName phone" })
        .populate({ path: "confirmedBy", select: "firstName lastName" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SalaryDeduction.countDocuments(filter),
    ]);

    res.json({
      deductions,
      ...buildPaginationMeta(total, page, limit),
      code: "deductionsFound",
      message: texts.deductionsFound,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries/deductions
const createDeduction = async (req, res, next) => {
  try {
    const { teacher, amount, reason, date, month } = req.body;

    if (!teacher || !amount || !reason || !date || !month) {
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

    const ms = monthStart(month);
    if (!ms) {
      return res.status(400).json({ code: "invalidMonth", message: texts.invalidMonth });
    }

    const deduction = await SalaryDeduction.create({
      teacher,
      teacherName: [teacherDoc.firstName, teacherDoc.lastName].filter(Boolean).join(" "),
      amount: round(Number(amount)),
      reason: reason.trim(),
      date: new Date(date),
      month: ms,
      status: "pending",
      createdBy: req.user._id,
    });

    res.status(201).json({
      deduction,
      code: "deductionCreated",
      message: texts.deductionCreated,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /salaries/deductions/:id/confirm — apply deduction to salary
const confirmDeduction = async (req, res, next) => {
  try {
    const deduction = await SalaryDeduction.findById(req.params.id);
    if (!deduction) {
      return res.status(404).json({ code: "deductionNotFound", message: texts.deductionNotFound });
    }
    if (deduction.status === "confirmed") {
      return res.status(400).json({ code: "alreadyConfirmed", message: texts.alreadyConfirmed });
    }

    // Find salary for teacher + month (optional — if not yet generated, still confirm)
    const salary = await Salary.findOne({ teacher: deduction.teacher, month: deduction.month });

    const updatePayload = {
      status: "confirmed",
      confirmedBy: req.user._id,
      confirmedAt: new Date(),
    };

    if (salary) {
      const newDeduction = round((salary.deduction || 0) + deduction.amount);
      const newNet = round((salary.totalAmount || 0) + (salary.bonus || 0) - newDeduction - (salary.advanceDeducted || 0));
      await Salary.findByIdAndUpdate(salary._id, { deduction: newDeduction, netAmount: newNet });
      updatePayload.salary = salary._id;
    }

    const confirmed = await SalaryDeduction.findByIdAndUpdate(
      deduction._id,
      updatePayload,
      { new: true },
    ).populate({ path: "teacher", select: "firstName lastName" });

    await recordService.createRecord({
      eventType: "DEDUCTION_CONFIRMED",
      entityType: "SalaryDeduction",
      entityId: confirmed._id,
      entity: confirmed,
      actor: recordService.actorFromReq(req),
      refs: { teacherId: deduction.teacher, salaryId: salary._id },
    });

    res.json({
      deduction: confirmed,
      code: "deductionConfirmed",
      message: texts.deductionConfirmed,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /salaries/deductions/:id
const deleteDeduction = async (req, res, next) => {
  try {
    const deduction = await SalaryDeduction.findById(req.params.id);
    if (!deduction) {
      return res.status(404).json({ code: "deductionNotFound", message: texts.deductionNotFound });
    }

    if (deduction.status === "confirmed") {
      // Reverse the deduction from the salary
      const salary = await Salary.findOne({ teacher: deduction.teacher, month: deduction.month });
      if (salary) {
        const newDeduction = Math.max(0, round((salary.deduction || 0) - deduction.amount));
        const newNet = round((salary.totalAmount || 0) + (salary.bonus || 0) - newDeduction - (salary.advanceDeducted || 0));
        await Salary.findByIdAndUpdate(salary._id, { deduction: newDeduction, netAmount: newNet });
      }
    }

    await SalaryDeduction.findByIdAndDelete(deduction._id);

    res.json({ code: "deductionDeleted", message: texts.deductionDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDeductions, createDeduction, confirmDeduction, deleteDeduction };
