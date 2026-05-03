const mongoose = require("mongoose");
const texts = require("../data/texts");
const {
  pickAllowedFields,
  getPagination,
  buildPaginationMeta,
} = require("../utils/helpers");
const Salary = require("../models/Salary");
const SalaryAdvance = require("../models/SalaryAdvance");
const SalaryDeduction = require("../models/SalaryDeduction");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const Payment = require("../models/Payment");
const User = require("../models/User");
const recordService = require("../services/recordService");

const SALARY_UPDATABLE_FIELDS = ["bonus", "deduction", "note", "status", "paidAt"];

const round = (n) => Math.round(Number(n) || 0);

// Returns the first millisecond of the month [start, end] for a given month input
function monthBounds(input) {
  const d = input ? new Date(input) : new Date();
  if (isNaN(d.getTime())) return null;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

// Compute the salary breakdown for a single teacher in a given month.
// Returns { teacher, month, groups: [...], totalAmount }.
async function computeTeacherSalary(teacherId, month) {
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const { start, end } = bounds;

  const [groups, teacherDoc] = await Promise.all([
    Group.find({ teacher: teacherId }).lean(),
    User.findById(teacherId).select("salaryType salaryValue minSalary").lean(),
  ]);
  const groupIds = groups.map((g) => g._id);

  // Active enrollment counts per group
  const enrollmentAgg = await Enrollment.aggregate([
    { $match: { group: { $in: groupIds }, status: "active" } },
    { $group: { _id: "$group", count: { $sum: 1 } } },
  ]);
  const enrollmentCountByGroup = Object.fromEntries(
    enrollmentAgg.map((e) => [String(e._id), e.count]),
  );

  // Paid revenue per group (joining payment → enrollment → group)
  const revenueAgg = await Payment.aggregate([
    {
      $match: {
        status: "paid",
        month: { $gte: start, $lte: end },
      },
    },
    {
      $lookup: {
        from: "enrollments",
        localField: "enrollment",
        foreignField: "_id",
        as: "enrollmentDoc",
      },
    },
    { $unwind: "$enrollmentDoc" },
    { $match: { "enrollmentDoc.group": { $in: groupIds } } },
    {
      $group: {
        _id: "$enrollmentDoc.group",
        revenue: { $sum: "$amount" },
        paidStudents: { $addToSet: "$student" },
      },
    },
    {
      $project: {
        revenue: 1,
        paidStudentsCount: { $size: "$paidStudents" },
      },
    },
  ]);
  const revenueByGroup = Object.fromEntries(
    revenueAgg.map((r) => [String(r._id), r]),
  );

  const breakdown = groups.map((g) => {
    const gid = String(g._id);
    const studentCount = enrollmentCountByGroup[gid] || 0;
    const rev = revenueByGroup[gid] || { revenue: 0, paidStudentsCount: 0 };
    const groupRevenue = rev.revenue || 0;
    const paidStudentsCount = rev.paidStudentsCount || 0;
    // Group override → teacher-level fallback → built-in default
    const salaryType  = g.salaryOverride ? g.salaryType  : (teacherDoc?.salaryType  || g.salaryType  || "percentage");
    const salaryValue = g.salaryOverride ? g.salaryValue : (teacherDoc?.salaryValue ?? g.salaryValue ?? 0);
    const minSalary   = g.salaryOverride ? g.minSalary   : (teacherDoc?.minSalary   ?? g.minSalary   ?? 0);

    let amount = 0;
    if (salaryType === "percentage") {
      amount = (groupRevenue * salaryValue) / 100;
    } else if (salaryType === "per_student") {
      amount = paidStudentsCount * salaryValue;
    } else if (salaryType === "fixed") {
      amount = salaryValue;
    }
    if (salaryType !== "fixed" && minSalary > 0) {
      amount = Math.max(amount, minSalary);
    }

    return {
      group: g._id,
      groupName: g.name,
      salaryType,
      salaryValue,
      minSalary,
      studentCount,
      paidStudentsCount,
      groupRevenue: round(groupRevenue),
      amount: round(amount),
    };
  });

  const totalAmount = breakdown.reduce((sum, b) => sum + b.amount, 0);

  return {
    teacher: teacherId,
    month: start,
    groups: breakdown,
    totalAmount: round(totalAmount),
  };
}

// GET /salaries — admin: all, teacher: own
const getSalaries = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.user.role === "teacher") {
      filter.teacher = req.user._id;
    } else if (req.query.teacher) {
      filter.teacher = req.query.teacher;
    }

    if (req.query.status) filter.status = req.query.status;

    if (req.query.month) {
      const bounds = monthBounds(req.query.month);
      if (!bounds) {
        return res
          .status(400)
          .json({ code: "invalidMonth", message: texts.invalidMonth });
      }
      filter.month = bounds.start;
    } else if (req.query.from || req.query.to) {
      const range = {};
      if (req.query.from) {
        const b = monthBounds(req.query.from);
        if (b) range.$gte = b.start;
      }
      if (req.query.to) {
        const b = monthBounds(req.query.to);
        if (b) range.$lte = b.start;
      }
      if (Object.keys(range).length) filter.month = range;
    }

    const [salaries, total] = await Promise.all([
      Salary.find(filter)
        .populate({ path: "teacher", select: "firstName lastName phone" })
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ month: -1, createdAt: -1 }),
      Salary.countDocuments(filter),
    ]);

    res.json({
      salaries,
      ...buildPaginationMeta(total, page, limit),
      code: "salariesFound",
      message: texts.salariesFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /salaries/:id
const getSalary = async (req, res, next) => {
  try {
    const salary = await Salary.findById(req.params.id)
      .populate({ path: "teacher", select: "firstName lastName phone" })
      .populate({ path: "groups.group", select: "name price salaryType salaryValue" })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!salary) {
      return res
        .status(404)
        .json({ code: "salaryNotFound", message: texts.salaryNotFound });
    }

    if (
      req.user.role === "teacher" &&
      String(salary.teacher._id) !== String(req.user._id)
    ) {
      return res.status(403).json({ code: "forbidden", message: texts.forbidden });
    }

    res.json({
      salary,
      code: "salariesFound",
      message: texts.salariesFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /salaries/calculate?teacher=<id>&month=YYYY-MM-01 — preview without persisting
const calculateSalary = async (req, res, next) => {
  try {
    const { teacher, month } = req.query;
    if (!teacher || !mongoose.Types.ObjectId.isValid(teacher)) {
      return res.status(400).json({
        code: "missingField",
        message: "O'qituvchi ID kiritilishi shart",
      });
    }

    const teacherDoc = await User.findById(teacher).select("firstName lastName phone role");
    if (!teacherDoc) {
      return res
        .status(404)
        .json({ code: "userNotFound", message: texts.userNotFound });
    }
    if (teacherDoc.role !== "teacher") {
      return res
        .status(400)
        .json({ code: "notATeacher", message: texts.notATeacher });
    }

    if (month && !monthBounds(month)) {
      return res
        .status(400)
        .json({ code: "invalidMonth", message: texts.invalidMonth });
    }

    const computed = await computeTeacherSalary(teacher, month);
    if (!computed) {
      return res
        .status(400)
        .json({ code: "invalidMonth", message: texts.invalidMonth });
    }

    res.json({
      preview: {
        ...computed,
        teacher: teacherDoc,
        bonus: 0,
        deduction: 0,
        netAmount: computed.totalAmount,
      },
      code: "salaryCalculated",
      message: texts.salaryCalculated,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries/generate — generate (persist) salaries for all teachers for a given month
const generateSalaries = async (req, res, next) => {
  try {
    const { month, teacherIds, overwrite } = req.body || {};
    const bounds = monthBounds(month);
    if (!bounds) {
      return res
        .status(400)
        .json({ code: "invalidMonth", message: texts.invalidMonth });
    }
    const monthStart = bounds.start;

    const teacherFilter = { role: "teacher" };
    if (Array.isArray(teacherIds) && teacherIds.length) {
      teacherFilter._id = { $in: teacherIds };
    }
    const teachers = await User.find(teacherFilter).select("firstName lastName phone");

    const results = [];
    const skipped = [];

    for (const t of teachers) {
      const computed = await computeTeacherSalary(t._id, month);
      if (!computed) continue;

      const existing = await Salary.findOne({ teacher: t._id, month: monthStart });
      if (existing && !overwrite) {
        skipped.push({ teacher: t._id, salaryId: existing._id, reason: "exists" });
        continue;
      }

      // Sum confirmed advances covering this month
      const advances = await SalaryAdvance.find({
        teacher: t._id,
        status: "confirmed",
        coveredMonths: monthStart,
      });
      const advanceDeducted = round(
        advances.reduce((sum, a) => sum + (a.months > 0 ? a.amount / a.months : a.amount), 0),
      );
      // Also check partial advance for this salary month
      const partialAdvances = await SalaryAdvance.find({
        teacher: t._id,
        type: "partial",
        status: "confirmed",
        salaryMonth: monthStart,
      });
      const partialDeducted = round(partialAdvances.reduce((sum, a) => sum + a.amount, 0));
      const totalAdvanceDeducted = round(advanceDeducted + partialDeducted);

      // Confirmed deductions for this month (salary not yet linked)
      const confirmedDeductions = await SalaryDeduction.find({
        teacher: t._id,
        status: "confirmed",
        month: monthStart,
        salary: { $exists: false },
      });
      const deductionFromRecords = round(
        confirmedDeductions.reduce((sum, d) => sum + d.amount, 0),
      );

      const bonus     = existing?.bonus     || 0;
      const deduction = round((existing?.deduction || 0) + deductionFromRecords);
      const payload = {
        teacher: t._id,
        month: monthStart,
        groups: computed.groups,
        totalAmount: computed.totalAmount,
        bonus,
        deduction,
        advanceDeducted: totalAdvanceDeducted,
        netAmount: round(computed.totalAmount + bonus - deduction - totalAdvanceDeducted),
        status: existing?.status === "paid" ? "paid" : "pending",
        createdBy: req.user._id,
      };

      let salary;
      if (existing) {
        salary = await Salary.findByIdAndUpdate(existing._id, payload, { new: true });
      } else {
        salary = await Salary.create(payload);
      }

      // Link previously unlinked confirmed deductions to this salary
      if (confirmedDeductions.length) {
        await SalaryDeduction.updateMany(
          { _id: { $in: confirmedDeductions.map((d) => d._id) } },
          { salary: salary._id },
        );
      }

      await recordService.createRecord({
        eventType: "SALARY_CREATED",
        entityType: "Salary",
        entityId: salary._id,
        entity: salary,
        actor: recordService.actorFromReq(req),
        refs: { teacherId: t._id, salaryId: salary._id },
        metadata: { teacher: t },
      });

      results.push(salary);
    }

    res.status(201).json({
      generated: results.length,
      skipped,
      salaries: results,
      code: "salariesGenerated",
      message: texts.salariesGenerated,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries — manually create a single salary record
const createSalary = async (req, res, next) => {
  const { teacher, month, bonus = 0, deduction = 0, note, amount } = req.body;

  if (!teacher) {
    return res.status(400).json({
      code: "missingField",
      message: "O'qituvchi kiritilishi shart",
    });
  }
  if (!month) {
    return res
      .status(400)
      .json({ code: "missingField", message: "Oy kiritilishi shart" });
  }

  const bounds = monthBounds(month);
  if (!bounds) {
    return res
      .status(400)
      .json({ code: "invalidMonth", message: texts.invalidMonth });
  }

  try {
    const teacherDoc = await User.findById(teacher).select("firstName lastName phone role");
    if (!teacherDoc) {
      return res
        .status(404)
        .json({ code: "userNotFound", message: texts.userNotFound });
    }
    if (teacherDoc.role !== "teacher") {
      return res
        .status(400)
        .json({ code: "notATeacher", message: texts.notATeacher });
    }

    const existing = await Salary.findOne({ teacher, month: bounds.start });
    if (existing) {
      return res.status(400).json({
        code: "salaryAlreadyExists",
        message: texts.salaryAlreadyExists,
      });
    }

    const computed = await computeTeacherSalary(teacher, month);
    // Agar admin qo'lda amount kiritse, u totalAmount bo'ladi; aks holda guruhlardan hisoblanadi
    const totalAmount = amount != null && amount !== "" ? round(Number(amount)) : (computed?.totalAmount || 0);
    const netAmount = round(totalAmount + Number(bonus || 0) - Number(deduction || 0));

    const salary = await Salary.create({
      teacher,
      month: bounds.start,
      groups: computed?.groups || [],
      totalAmount,
      bonus: Number(bonus) || 0,
      deduction: Number(deduction) || 0,
      netAmount,
      note,
      status: "pending",
      createdBy: req.user._id,
    });

    await recordService.createRecord({
      eventType: "SALARY_CREATED",
      entityType: "Salary",
      entityId: salary._id,
      entity: salary,
      actor: recordService.actorFromReq(req),
      refs: { teacherId: teacher, salaryId: salary._id },
      metadata: { teacher: teacherDoc },
    });

    res.status(201).json({
      salary,
      code: "salaryCreated",
      message: texts.salaryCreated,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /salaries/:id — update bonus/deduction/note/status
const updateSalary = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, SALARY_UPDATABLE_FIELDS);

    const existing = await Salary.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ code: "salaryNotFound", message: texts.salaryNotFound });
    }

    if (updates.status === "paid" && !updates.paidAt) {
      updates.paidAt = new Date();
    }

    const bonus =
      updates.bonus !== undefined ? Number(updates.bonus) : existing.bonus;
    const deduction =
      updates.deduction !== undefined
        ? Number(updates.deduction)
        : existing.deduction;
    updates.netAmount = round(
      (existing.totalAmount || 0) + (bonus || 0) - (deduction || 0) - (existing.advanceDeducted || 0),
    );

    const salary = await Salary.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).populate({ path: "teacher", select: "firstName lastName phone" });

    const teacherMeta = salary.teacher;
    const actor = recordService.actorFromReq(req);
    const refs = {
      teacherId: existing.teacher,
      salaryId: salary._id,
    };

    const diff = recordService.diffFields(
      existing.toObject(),
      salary.toObject(),
      [...SALARY_UPDATABLE_FIELDS, "netAmount"],
    );

    if (diff) {
      await recordService.createRecord({
        eventType: "SALARY_UPDATED",
        entityType: "Salary",
        entityId: salary._id,
        entity: salary,
        actor,
        refs,
        changes: diff,
        metadata: { teacher: teacherMeta },
      });
    }

    if (
      updates.status !== undefined &&
      existing.status !== salary.status &&
      salary.status === "paid"
    ) {
      await recordService.createRecord({
        eventType: "SALARY_PAID",
        entityType: "Salary",
        entityId: salary._id,
        entity: salary,
        actor,
        refs,
        metadata: { teacher: teacherMeta },
      });
    }

    res.json({
      salary,
      code: "salaryUpdated",
      message: texts.salaryUpdated,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries/:id/pay — convenience to mark as paid (optional body: { amount })
const paySalary = async (req, res, next) => {
  try {
    const existing = await Salary.findById(req.params.id);
    if (!existing) {
      return res
        .status(404)
        .json({ code: "salaryNotFound", message: texts.salaryNotFound });
    }

    if (existing.status === "paid") {
      return res.json({
        salary: existing,
        code: "salaryPaid",
        message: texts.salaryPaid,
      });
    }

    const updatePayload = { status: "paid", paidAt: new Date() };
    if (req.body?.amount != null && req.body.amount !== "") {
      updatePayload.netAmount = round(Number(req.body.amount));
    }

    const salary = await Salary.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true },
    ).populate({ path: "teacher", select: "firstName lastName phone" });

    const actor = recordService.actorFromReq(req);
    await recordService.createRecord({
      eventType: "SALARY_PAID",
      entityType: "Salary",
      entityId: salary._id,
      entity: salary,
      actor,
      refs: { teacherId: existing.teacher, salaryId: salary._id },
      metadata: { teacher: salary.teacher },
    });

    res.json({
      salary,
      code: "salaryPaid",
      message: texts.salaryPaid,
    });
  } catch (err) {
    next(err);
  }
};

// POST /salaries/bulk-pay — mark multiple salaries as paid
const bulkPay = async (req, res, next) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ code: "missingField", message: "IDs kiritilishi shart" });
    }

    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    let paid = 0;

    for (const id of validIds) {
      const existing = await Salary.findById(id);
      if (!existing || existing.status === "paid") continue;

      const salary = await Salary.findByIdAndUpdate(
        id,
        { status: "paid", paidAt: new Date() },
        { new: true },
      ).populate({ path: "teacher", select: "firstName lastName phone" });

      await recordService.createRecord({
        eventType: "SALARY_PAID",
        entityType: "Salary",
        entityId: salary._id,
        entity: salary,
        actor: recordService.actorFromReq(req),
        refs: { teacherId: existing.teacher, salaryId: salary._id },
        metadata: { teacher: salary.teacher },
      });

      paid++;
    }

    res.json({
      paid,
      code: "salaryPaid",
      message: `${paid} ta oylik to'landi`,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /salaries/:id
const deleteSalary = async (req, res, next) => {
  try {
    const salary = await Salary.findByIdAndDelete(req.params.id);
    if (!salary) {
      return res
        .status(404)
        .json({ code: "salaryNotFound", message: texts.salaryNotFound });
    }

    const teacherDoc = await User.findById(salary.teacher).select("firstName lastName");

    await recordService.createRecord({
      eventType: "SALARY_DELETED",
      entityType: "Salary",
      entityId: salary._id,
      entity: salary,
      actor: recordService.actorFromReq(req),
      refs: { teacherId: salary.teacher, salaryId: salary._id },
      metadata: { teacher: teacherDoc },
    });

    res.json({ code: "salaryDeleted", message: texts.salaryDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSalaries,
  getSalary,
  calculateSalary,
  generateSalaries,
  createSalary,
  updateSalary,
  paySalary,
  bulkPay,
  deleteSalary,
};
