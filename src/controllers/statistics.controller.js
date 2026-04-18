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

    const [byStatus, bySource, byGender, monthlyTrend] = await Promise.all([
      Lead.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),

      Lead.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $project: { _id: 0, source: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),

      Lead.aggregate([
        { $match: { ...baseMatch, gender: { $exists: true, $ne: null } } },
        { $group: { _id: "$gender", count: { $sum: 1 } } },
        { $project: { _id: 0, gender: "$_id", count: 1 } },
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
          { $unwind: { path: "$groupInfo", preserveNullAndEmpty: true } },
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
        { $unwind: { path: "$groupInfo", preserveNullAndEmpty: true } },
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

module.exports = {
  getOverview,
  getLeadStats,
  getStudentStats,
  getRevenueStats,
  getAttendanceStats,
};
