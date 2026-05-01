const { normaliseDate } = require("../utils/helpers");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");
const Payment = require("../models/Payment");
const Attendance = require("../models/Attendance");

function parseDateRange(query, field = "createdAt") {
  const filter = {};
  const start = normaliseDate(query.startDate);
  const end = normaliseDate(query.endDate);
  if (start || end) {
    filter[field] = {};
    if (start) filter[field].$gte = start;
    if (end) filter[field].$lte = end;
  }
  return filter;
}

function thisMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
  return { start, end };
}

function last6MonthsStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
}

const getOverview = async (req, res, next) => {
  try {
    const { start: monthStart, end: monthEnd } = thisMonthRange();

    const [totalLeads, activeStudentIds, revenueAgg, attendanceAgg] =
      await Promise.all([
        Lead.countDocuments(),

        Enrollment.distinct("student", { status: "active" }),

        Payment.aggregate([
          {
            $match: {
              status: "paid",
              paidAt: { $gte: monthStart, $lte: monthEnd },
            },
          },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),

        Attendance.aggregate([
          { $match: { date: { $gte: monthStart, $lte: monthEnd } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              present: {
                $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
              },
            },
          },
        ]),
      ]);

    const revenueThisMonth = revenueAgg[0]?.total ?? 0;
    const attTotal = attendanceAgg[0]?.total ?? 0;
    const attPresent = attendanceAgg[0]?.present ?? 0;
    const attendanceRate =
      attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalLeads,
        totalActiveStudents: activeStudentIds.length,
        revenueThisMonth,
        attendanceRateThisMonth: attendanceRate,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getLeadStats = async (req, res, next) => {
  try {
    const dateFilter = parseDateRange(req.query, "createdAt");
    const baseMatch = Object.keys(dateFilter).length ? dateFilter : {};
    const trendStart = last6MonthsStart();

    const [byStatus, bySource, byGender, byRejectionReason, monthlyTrend] = await Promise.all([
      Lead.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),

      Lead.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "leadsources",
            localField: "_id",
            foreignField: "_id",
            as: "sourceInfo",
          },
        },
        { $unwind: { path: "$sourceInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            source: { $ifNull: ["$sourceInfo.name", "Noma'lum"] },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),

      Lead.aggregate([
        { $match: { ...baseMatch, gender: { $exists: true, $ne: null } } },
        { $group: { _id: "$gender", count: { $sum: 1 } } },
        { $project: { _id: 0, gender: "$_id", count: 1 } },
      ]),

      Lead.aggregate([
        { $match: { ...baseMatch, status: "rejected", rejectionReason: { $exists: true, $ne: null } } },
        { $group: { _id: "$rejectionReason", count: { $sum: 1 } } },
        {
          $lookup: {
            from: "rejectionreasons",
            localField: "_id",
            foreignField: "_id",
            as: "reasonInfo",
          },
        },
        { $unwind: { path: "$reasonInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            reason: { $ifNull: ["$reasonInfo.title", "Noma'lum"] },
            count: 1,
          },
        },
        { $sort: { count: -1 } },
      ]),

      Lead.aggregate([
        {
          $match: {
            createdAt: { $gte: trendStart },
            ...baseMatch,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            total: { $sum: 1 },
            converted: {
              $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] },
            },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            total: 1,
            converted: 1,
          },
        },
      ]),
    ]);

    const totalLeads = byStatus.reduce((s, r) => s + r.count, 0);
    const convertedCount =
      byStatus.find((r) => r.status === "converted")?.count ?? 0;
    const conversionRate =
      totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalLeads,
        conversionRate,
        byStatus,
        bySource,
        byGender,
        byRejectionReason,
        monthlyTrend,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getStudentStats = async (req, res, next) => {
  try {
    const dateFilter = parseDateRange(req.query, "enrolledAt");
    const baseMatch = Object.keys(dateFilter).length ? dateFilter : {};

    const [enrollmentsByStatus, debtOverview, studentsPerGroup, genderDist] =
      await Promise.all([
        Enrollment.aggregate([
          { $match: baseMatch },
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $project: { _id: 0, status: "$_id", count: 1 } },
        ]),

        Enrollment.aggregate([
          { $match: { ...baseMatch, status: "active" } },
          {
            $group: {
              _id: null,
              totalEnrollments: { $sum: 1 },
              inDebtCount: {
                $sum: { $cond: [{ $gt: ["$debt", 0] }, 1, 0] },
              },
              totalDebt: { $sum: "$debt" },
              totalBalance: { $sum: "$balance" },
            },
          },
        ]),

        Enrollment.aggregate([
          { $match: { ...baseMatch, status: "active" } },
          { $group: { _id: "$group", studentCount: { $sum: 1 } } },
          {
            $lookup: {
              from: "groups",
              localField: "_id",
              foreignField: "_id",
              as: "groupInfo",
            },
          },
          { $unwind: { path: "$groupInfo", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              groupId: "$_id",
              groupName: "$groupInfo.name",
              studentCount: 1,
            },
          },
          { $sort: { studentCount: -1 } },
        ]),

        User.aggregate([
          {
            $match: {
              role: "student",
              gender: { $exists: true, $ne: null },
            },
          },
          { $group: { _id: "$gender", count: { $sum: 1 } } },
          { $project: { _id: 0, gender: "$_id", count: 1 } },
        ]),
      ]);

    const debt = debtOverview[0] ?? {
      totalEnrollments: 0,
      inDebtCount: 0,
      totalDebt: 0,
      totalBalance: 0,
    };

    res.json({
      success: true,
      data: {
        enrollmentsByStatus,
        genderDistribution: genderDist,
        debtOverview: {
          activeEnrollments: debt.totalEnrollments,
          studentsInDebt: debt.inDebtCount,
          totalOutstandingDebt: debt.totalDebt,
          totalBalance: debt.totalBalance,
        },
        studentsPerGroup,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getRevenueStats = async (req, res, next) => {
  try {
    const dateFilter = parseDateRange(req.query, "paidAt");
    const baseMatch = Object.keys(dateFilter).length ? dateFilter : {};
    const trendStart = last6MonthsStart();

    const [monthlyRevenue, statusDist, totalDebtAgg, collectedAgg, expectedAgg] =
      await Promise.all([
        Payment.aggregate([
          {
            $match: {
              status: "paid",
              paidAt: { $gte: trendStart },
              ...baseMatch,
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$paidAt" },
                month: { $month: "$paidAt" },
              },
              collected: { $sum: "$amount" },
              payments: { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
          {
            $project: {
              _id: 0,
              year: "$_id.year",
              month: "$_id.month",
              collected: 1,
              payments: 1,
            },
          },
        ]),

        Payment.aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              total: { $sum: "$amount" },
            },
          },
          { $project: { _id: 0, status: "$_id", count: 1, total: 1 } },
        ]),

        Enrollment.aggregate([
          { $match: { status: "active" } },
          {
            $group: {
              _id: null,
              totalDebt: { $sum: "$debt" },
              totalBalance: { $sum: "$balance" },
            },
          },
        ]),

        Payment.aggregate([
          { $match: { status: "paid", ...baseMatch } },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),

        Enrollment.aggregate([
          { $match: { status: "active" } },
          {
            $lookup: {
              from: "groups",
              localField: "group",
              foreignField: "_id",
              as: "groupInfo",
            },
          },
          { $unwind: "$groupInfo" },
          {
            $group: {
              _id: null,
              expected: {
                $sum: {
                  $max: [
                    {
                      $subtract: [
                        "$groupInfo.price",
                        { $ifNull: ["$discount", 0] },
                      ],
                    },
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    const debtData = totalDebtAgg[0] ?? { totalDebt: 0, totalBalance: 0 };
    const collected = collectedAgg[0] ?? { total: 0, count: 0 };
    const expectedTotal = expectedAgg[0]?.expected ?? 0;

    res.json({
      success: true,
      data: {
        monthlyRevenue,
        totalCollected: collected.total,
        totalPaymentsCount: collected.count,
        expectedMonthlyRevenue: expectedTotal,
        totalOutstandingDebt: debtData.totalDebt,
        totalBalance: debtData.totalBalance,
        paymentStatusDistribution: statusDist,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getAttendanceStats = async (req, res, next) => {
  try {
    const dateFilter = parseDateRange(req.query, "date");
    const baseMatch = Object.keys(dateFilter).length ? dateFilter : {};
    const trendStart = last6MonthsStart();

    const [overall, byGroup, monthlyTrend] = await Promise.all([
      Attendance.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
            },
            absent: {
              $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] },
            },
          },
        },
      ]),

      Attendance.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$group",
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
            },
          },
        },
        {
          $lookup: {
            from: "groups",
            localField: "_id",
            foreignField: "_id",
            as: "groupInfo",
          },
        },
        { $unwind: { path: "$groupInfo", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            groupId: "$_id",
            groupName: "$groupInfo.name",
            total: 1,
            present: 1,
            attendanceRate: {
              $cond: [
                { $gt: ["$total", 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
        { $sort: { attendanceRate: -1 } },
      ]),

      Attendance.aggregate([
        {
          $match: {
            date: { $gte: trendStart },
            ...baseMatch,
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            total: { $sum: 1 },
            present: {
              $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] },
            },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
        {
          $project: {
            _id: 0,
            year: "$_id.year",
            month: "$_id.month",
            total: 1,
            present: 1,
            attendanceRate: {
              $cond: [
                { $gt: ["$total", 0] },
                {
                  $round: [
                    { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
                    1,
                  ],
                },
                0,
              ],
            },
          },
        },
      ]),
    ]);

    const ov = overall[0] ?? { total: 0, present: 0, absent: 0 };
    const overallRate =
      ov.total > 0 ? Math.round((ov.present / ov.total) * 100) : 0;

    res.json({
      success: true,
      data: {
        overall: {
          total: ov.total,
          present: ov.present,
          absent: ov.absent,
          attendanceRate: overallRate,
        },
        byGroup,
        monthlyTrend,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getLeadManagerStats = async (req, res, next) => {
  try {
    const dateFilter = parseDateRange(req.query, "createdAt");
    const baseMatch = Object.keys(dateFilter).length ? dateFilter : {};

    const managerStats = await Lead.aggregate([
      { $match: { createdBy: { $exists: true, $ne: null }, ...baseMatch } },
      {
        $group: {
          _id: "$createdBy",
          total:     { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          rejected:  { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
          new:       { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "manager",
        },
      },
      { $unwind: { path: "$manager", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          managerId: "$_id",
          name: {
            $concat: [
              { $ifNull: ["$manager.firstName", ""] },
              " ",
              { $ifNull: ["$manager.lastName", ""] },
            ],
          },
          role:      { $ifNull: ["$manager.role", "unknown"] },
          total:     1,
          converted: 1,
          rejected:  1,
          new:       1,
          conversionRate: {
            $cond: [
              { $gt: ["$total", 0] },
              { $round: [{ $multiply: [{ $divide: ["$converted", "$total"] }, 100] }, 1] },
              0,
            ],
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json({ success: true, data: { managers: managerStats } });
  } catch (err) {
    next(err);
  }
};

const getMonthlyIncomeStats = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd   = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [paidAgg, pendingAgg, overdueAgg] = await Promise.all([
      Payment.aggregate([
        { $match: { status: "paid", paidAt: { $gte: yearStart, $lte: yearEnd } } },
        { $group: { _id: { $month: "$paidAt" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "pending", createdAt: { $gte: yearStart, $lte: yearEnd } } },
        { $group: { _id: { $month: "$createdAt" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: "overdue", createdAt: { $gte: yearStart, $lte: yearEnd } } },
        { $group: { _id: { $month: "$createdAt" }, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    const byMonth = (agg) => {
      const map = {};
      agg.forEach((r) => { map[r._id] = { amount: r.amount, count: r.count }; });
      return map;
    };

    const paid    = byMonth(paidAgg);
    const pending = byMonth(pendingAgg);
    const overdue = byMonth(overdueAgg);

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        month:   m,
        year,
        paid:    paid[m]?.amount    ?? 0,
        paidCount:    paid[m]?.count     ?? 0,
        pending: pending[m]?.amount  ?? 0,
        pendingCount: pending[m]?.count   ?? 0,
        overdue: overdue[m]?.amount  ?? 0,
        overdueCount: overdue[m]?.count   ?? 0,
        total:   (paid[m]?.amount ?? 0) + (pending[m]?.amount ?? 0) + (overdue[m]?.amount ?? 0),
      };
    });

    const totalPaid    = months.reduce((s, m) => s + m.paid, 0);
    const bestMonth    = months.reduce((best, m) => (m.paid > best.paid ? m : best), months[0]);
    const totalPayments = months.reduce((s, m) => s + m.paidCount, 0);

    res.json({
      success: true,
      data: {
        year,
        months,
        summary: {
          totalPaid,
          totalPayments,
          bestMonth: bestMonth.month,
          avgPerMonth: totalPayments > 0 ? Math.round(totalPaid / 12) : 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

const getInterestStats = async (req, res, next) => {
  try {
    const dateFilter = parseDateRange(req.query, "createdAt");
    const baseMatch = Object.keys(dateFilter).length ? dateFilter : {};

    const byInterest = await Lead.aggregate([
      { $match: { ...baseMatch, interest: { $exists: true, $ne: null } } },
      { $group: { _id: "$interest", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "interests",
          localField: "_id",
          foreignField: "_id",
          as: "interestInfo",
        },
      },
      { $unwind: { path: "$interestInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          // ObjectId + matched → real name; ObjectId + deleted → "O'chirilgan"; string (old data) → the string itself
          name: {
            $cond: {
              if: { $gt: [{ $ifNull: ["$interestInfo", null] }, null] },
              then: "$interestInfo.name",
              else: {
                $cond: {
                  if: { $eq: [{ $type: "$_id" }, "string"] },
                  then: "$_id",
                  else: "O'chirilgan",
                },
              },
            },
          },
          count: 1,
        },
      },
      // Merge duplicate names (e.g. same string interest from old data)
      { $group: { _id: "$name", count: { $sum: "$count" } } },
      { $project: { _id: 0, name: "$_id", count: 1 } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, data: { byInterest } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOverview,
  getLeadStats,
  getStudentStats,
  getRevenueStats,
  getAttendanceStats,
  getLeadManagerStats,
  getMonthlyIncomeStats,
  getInterestStats,
};
