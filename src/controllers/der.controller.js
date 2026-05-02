const Attendance   = require("../models/Attendance");
const Enrollment   = require("../models/Enrollment");
const Group        = require("../models/Group");
const RatingConfig = require("../models/RatingConfig");
const { normaliseDate } = require("../utils/helpers");

const getOwnGroupIds = (teacherId) =>
  Group.find({ teacher: teacherId }).distinct("_id");

async function getConfig() {
  let cfg = await RatingConfig.findOne();
  if (!cfg) cfg = await RatingConfig.create({});
  return cfg;
}

function buildDateRange(from, to, lookbackDays) {
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const toDate  = to  ? normaliseDate(to)  : todayUTC;
  const fromDate = from
    ? normaliseDate(from)
    : new Date(todayUTC.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  return { fromDate, toDate };
}

// GET /attendance/der/config
const getDerConfig = async (req, res, next) => {
  try {
    const cfg = await getConfig();
    res.json({ config: cfg });
  } catch (err) {
    next(err);
  }
};

// PUT /attendance/der/config  (admin only)
const updateDerConfig = async (req, res, next) => {
  try {
    const { lookbackDays } = req.body;
    let cfg = await RatingConfig.findOne();
    if (!cfg) cfg = new RatingConfig();
    if (lookbackDays !== undefined) cfg.lookbackDays = lookbackDays;
    await cfg.save();
    res.json({ config: cfg, message: "Sozlamalar saqlandi" });
  } catch (err) {
    next(err);
  }
};

// GET /attendance/der/stats?group=&from=&to=&student=
// Teacher: own groups only. Admin: any group or all groups.
const getDerStats = async (req, res, next) => {
  try {
    const cfg = await getConfig();
    const { fromDate, toDate } = buildDateRange(req.query.from, req.query.to, cfg.lookbackDays);

    const filter = { date: { $gte: fromDate, $lte: toDate } };

    if (req.user.role === "teacher") {
      const ownGroupIds = await getOwnGroupIds(req.user._id);
      if (req.query.group) {
        const allowed = ownGroupIds.some((id) => String(id) === req.query.group);
        if (!allowed) {
          return res.status(403).json({ code: "forbidden", message: "Ruxsat berilmadi" });
        }
        filter.group = req.query.group;
      } else {
        filter.group = { $in: ownGroupIds };
      }
    } else {
      if (req.query.group) filter.group = req.query.group;
    }

    if (req.query.student) filter.student = req.query.student;

    const records = await Attendance.find(filter)
      .populate({ path: "student", select: "firstName lastName" })
      .populate({ path: "group",   select: "name" })
      .lean();

    // Aggregate by student
    const byStudent = new Map();

    for (const r of records) {
      const key = String(r.student._id);
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          student:       r.student,
          group:         r.group,
          totalPresent:  0,
          totalAbsent:   0,
          totalSessions: 0,
          gradeSum:      0,
          gradeCount:    0,
        });
      }
      const s = byStudent.get(key);
      s.totalSessions++;
      if (r.status === "present") {
        s.totalPresent++;
        if (r.grade) {
          s.gradeSum  += r.grade;
          s.gradeCount++;
        }
      } else {
        s.totalAbsent++;
      }
    }

    const rows = Array.from(byStudent.values()).map((s) => {
      const avgGrade = s.gradeCount > 0 ? +(s.gradeSum / s.gradeCount).toFixed(2) : null;
      return { ...s, avgGrade };
    });

    // Sort by avgGrade desc, nulls last
    rows.sort((a, b) => {
      if (a.avgGrade == null && b.avgGrade == null) return 0;
      if (a.avgGrade == null) return 1;
      if (b.avgGrade == null) return -1;
      return b.avgGrade - a.avgGrade;
    });
    rows.forEach((r, i) => { r.rankGlobal = i + 1; });

    // Assign rank within group
    const byGroup = new Map();
    for (const r of rows) {
      const gid = String(r.group?._id ?? "");
      if (!byGroup.has(gid)) byGroup.set(gid, []);
      byGroup.get(gid).push(r);
    }
    for (const [, groupRows] of byGroup) {
      groupRows.sort((a, b) => {
        if (a.avgGrade == null && b.avgGrade == null) return 0;
        if (a.avgGrade == null) return 1;
        if (b.avgGrade == null) return -1;
        return b.avgGrade - a.avgGrade;
      });
      groupRows.forEach((r, i) => { r.rankInGroup = i + 1; });
    }

    res.json({
      stats: rows,
      from:  fromDate,
      to:    toDate,
    });
  } catch (err) {
    next(err);
  }
};

// GET /attendance/der/my-stats?from=&to=&group=
// Student: own stats + rank
const getMyDerStats = async (req, res, next) => {
  try {
    const cfg = await getConfig();
    const { fromDate, toDate } = buildDateRange(req.query.from, req.query.to, cfg.lookbackDays);

    // Determine which groups this student is in
    const enrollmentFilter = { student: req.user._id, status: "active" };
    if (req.query.group) enrollmentFilter.group = req.query.group;
    const enrollments = await Enrollment.find(enrollmentFilter).select("group").lean();
    const groupIds = enrollments.map((e) => e.group);

    // Fetch all attendance in those groups (for ranking)
    const allRecords = await Attendance.find({
      group: { $in: groupIds },
      date:  { $gte: fromDate, $lte: toDate },
    }).lean();

    // Aggregate by student across all groups
    const byStudent = new Map();
    for (const r of allRecords) {
      const key = String(r.student);
      if (!byStudent.has(key)) {
        byStudent.set(key, {
          studentId:     r.student,
          groupId:       r.group,
          totalPresent:  0,
          totalSessions: 0,
          gradeSum:      0,
          gradeCount:    0,
        });
      }
      const s = byStudent.get(key);
      s.totalSessions++;
      if (r.status === "present") {
        s.totalPresent++;
        if (r.grade) {
          s.gradeSum  += r.grade;
          s.gradeCount++;
        }
      }
    }

    const gradeSort = (a, b) => {
      if (a.avgGrade == null && b.avgGrade == null) return 0;
      if (a.avgGrade == null) return 1;
      if (b.avgGrade == null) return -1;
      return b.avgGrade - a.avgGrade;
    };
    const allRows = Array.from(byStudent.values()).map((s) => ({
      ...s,
      avgGrade: s.gradeCount > 0 ? +(s.gradeSum / s.gradeCount).toFixed(2) : null,
    }));
    allRows.sort(gradeSort);
    allRows.forEach((r, i) => { r.rankGlobal = i + 1; });

    const me = allRows.find((r) => String(r.studentId) === String(req.user._id));

    // Per-group rank for my groups
    const groupRanks = {};
    for (const en of enrollments) {
      const gid = String(en.group);
      const groupRows = allRows.filter((r) => String(r.groupId) === gid);
      groupRows.sort(gradeSort);
      const pos = groupRows.findIndex((r) => String(r.studentId) === String(req.user._id));
      groupRanks[gid] = { rank: pos + 1, total: groupRows.length };
    }

    const myStats = me
      ? {
          totalPresent:  me.totalPresent,
          totalAbsent:   me.totalSessions - me.totalPresent,
          totalSessions: me.totalSessions,
          avgGrade:      me.avgGrade,
          rankGlobal:    me.rankGlobal,
          totalGlobal:   allRows.length,
          groupRanks,
        }
      : {
          totalPresent: 0, totalAbsent: 0, totalSessions: 0,
          avgGrade: null, rankGlobal: null,
          totalGlobal: allRows.length, groupRanks,
        };

    res.json({ stats: myStats, from: fromDate, to: toDate });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDerStats, getMyDerStats, getDerConfig, updateDerConfig };
