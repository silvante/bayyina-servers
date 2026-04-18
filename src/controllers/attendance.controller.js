const texts = require("../data/texts");
const {
  getPagination,
  buildPaginationMeta,
  normaliseDate,
  getWeekdayName,
  expandScheduleDates,
} = require("../utils/helpers");
const Attendance = require("../models/Attendance");
const Enrollment = require("../models/Enrollment");
const Group = require("../models/Group");
const User = require("../models/User");
const recordService = require("../services/recordService");

const ALLOWED_STATUSES = ["present", "absent"];

const getOwnGroupIds = async (teacherId) =>
  Group.find({ teacher: teacherId }).distinct("_id");

// POST /attendance/bulk — teacher of own group
const bulkMarkAttendance = async (req, res, next) => {
  try {
    const { group: groupId, date, entries } = req.body;

    if (!groupId) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Guruh kiritilishi shart" });
    }
    if (!date) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Sana kiritilishi shart" });
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Davomat ro'yxati bo'sh" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    if (String(group.teacher) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ code: "notGroupTeacher", message: texts.notGroupTeacher });
    }

    const sessionDate = normaliseDate(date);
    if (!sessionDate) {
      return res
        .status(400)
        .json({ code: "invalidSessionDate", message: texts.invalidSessionDate });
    }

    const weekday = getWeekdayName(sessionDate);
    if (!group.schedule.days.includes(weekday)) {
      return res
        .status(400)
        .json({ code: "invalidSessionDate", message: texts.invalidSessionDate });
    }

    const enrollmentIds = entries.map((e) => e.enrollment);
    const enrollments = await Enrollment.find({
      _id: { $in: enrollmentIds },
      group: group._id,
    });

    const enrollmentMap = new Map(
      enrollments.map((e) => [String(e._id), e]),
    );

    const ops = [];
    for (const entry of entries) {
      const enrollment = enrollmentMap.get(String(entry.enrollment));
      if (!enrollment) {
        return res.status(400).json({
          code: "enrollmentNotInGroup",
          message: texts.enrollmentNotInGroup,
        });
      }
      if (!ALLOWED_STATUSES.includes(entry.status)) {
        return res
          .status(400)
          .json({ code: "invalidStatus", message: "Status noto'g'ri" });
      }

      ops.push({
        updateOne: {
          filter: { enrollment: enrollment._id, date: sessionDate },
          update: {
            $set: {
              status: entry.status,
              note: entry.note || "",
              markedBy: req.user._id,
              group: group._id,
              student: enrollment.student,
            },
            $setOnInsert: {
              enrollment: enrollment._id,
              date: sessionDate,
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length) await Attendance.bulkWrite(ops);

    const records = await Attendance.find({
      group: group._id,
      date: sessionDate,
    })
      .populate({ path: "student", select: "firstName lastName phone" })
      .sort({ createdAt: 1 });

    const markedEnrollmentIds = new Set(entries.map((e) => String(e.enrollment)));
    const actor = recordService.actorFromReq(req);
    for (const att of records) {
      if (!markedEnrollmentIds.has(String(att.enrollment))) continue;
      await recordService.createRecord({
        eventType: "ATTENDANCE_MARKED",
        entityType: "Attendance",
        entityId: att._id,
        entity: att,
        actor,
        refs: {
          studentId: att.student?._id || att.student,
          groupId: att.group,
          enrollmentId: att.enrollment,
          attendanceId: att._id,
        },
        metadata: { student: att.student },
      });
    }

    res.status(201).json({
      attendance: records,
      code: "attendanceMarked",
      message: texts.attendanceMarked,
    });
  } catch (err) {
    next(err);
  }
};

// GET /attendance
const getAttendances = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.group) filter.group = req.query.group;
    if (req.query.student) filter.student = req.query.student;
    if (req.query.enrollment) filter.enrollment = req.query.enrollment;
    if (req.query.status && ALLOWED_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) {
        const from = normaliseDate(req.query.from);
        if (from) filter.date.$gte = from;
      }
      if (req.query.to) {
        const to = normaliseDate(req.query.to);
        if (to) filter.date.$lte = to;
      }
    }

    if (req.user.role === "student") {
      filter.student = req.user._id;
    } else if (req.user.role === "teacher") {
      const ownGroupIds = await getOwnGroupIds(req.user._id);
      if (filter.group) {
        const allowed = ownGroupIds.some(
          (id) => String(id) === String(filter.group),
        );
        if (!allowed) {
          return res
            .status(403)
            .json({ code: "forbidden", message: texts.forbidden });
        }
      } else {
        filter.group = { $in: ownGroupIds };
      }
    }

    const [attendance, total] = await Promise.all([
      Attendance.find(filter)
        .populate({ path: "student", select: "firstName lastName phone" })
        .populate({ path: "group", select: "name schedule" })
        .skip(skip)
        .limit(limit)
        .sort({ date: -1, createdAt: -1 }),
      Attendance.countDocuments(filter),
    ]);

    res.json({
      attendance,
      ...buildPaginationMeta(total, page, limit),
      code: "attendanceFound",
      message: texts.attendanceFound,
    });
  } catch (err) {
    next(err);
  }
};

const assertCanReadGroup = async (req, group) => {
  if (req.user.role === "admin") return true;
  if (
    req.user.role === "teacher" &&
    String(group.teacher) === String(req.user._id)
  ) {
    return true;
  }
  if (req.user.role === "student") {
    const enrolled = await Enrollment.exists({
      group: group._id,
      student: req.user._id,
    });
    return !!enrolled;
  }
  return false;
};

// GET /attendance/session?group=&date=
const getSessionAttendance = async (req, res, next) => {
  try {
    const { group: groupId, date } = req.query;
    if (!groupId || !date) {
      return res.status(400).json({
        code: "missingField",
        message: "Guruh va sana kiritilishi shart",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    const allowed = await assertCanReadGroup(req, group);
    if (!allowed) {
      return res
        .status(403)
        .json({ code: "forbidden", message: texts.forbidden });
    }

    const sessionDate = normaliseDate(date);
    if (!sessionDate) {
      return res
        .status(400)
        .json({ code: "invalidSessionDate", message: texts.invalidSessionDate });
    }

    const weekday = getWeekdayName(sessionDate);
    const isValidSchedule = group.schedule.days.includes(weekday);

    const enrollmentFilter = { group: group._id, status: "active" };
    if (req.user.role === "student") {
      enrollmentFilter.student = req.user._id;
    }

    const enrollments = await Enrollment.find(enrollmentFilter).populate({
      path: "student",
      select: "firstName lastName phone",
    });

    const records = await Attendance.find({
      group: group._id,
      date: sessionDate,
      enrollment: { $in: enrollments.map((e) => e._id) },
    });

    const recordByEnrollment = new Map(
      records.map((r) => [String(r.enrollment), r]),
    );

    const rows = enrollments.map((enrollment) => {
      const record = recordByEnrollment.get(String(enrollment._id));
      return {
        enrollment: enrollment._id,
        student: enrollment.student,
        status: record ? record.status : null,
        note: record ? record.note : null,
        attendanceId: record ? record._id : null,
        markedAt: record ? record.updatedAt : null,
      };
    });

    res.json({
      group: { _id: group._id, name: group.name, schedule: group.schedule },
      date: sessionDate,
      weekday,
      isValidSchedule,
      rows,
      code: "attendanceFound",
      message: texts.attendanceFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /attendance/sessions?group=&from=&to=
const getScheduleSessions = async (req, res, next) => {
  try {
    const { group: groupId, from, to } = req.query;
    if (!groupId) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Guruh kiritilishi shart" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    const allowed = await assertCanReadGroup(req, group);
    if (!allowed) {
      return res
        .status(403)
        .json({ code: "forbidden", message: texts.forbidden });
    }

    const today = new Date();
    const defaultTo = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
      ),
    );
    const defaultFrom = new Date(defaultTo.getTime());
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);

    const rangeFrom = from ? normaliseDate(from) : defaultFrom;
    const rangeTo = to ? normaliseDate(to) : defaultTo;

    if (!rangeFrom || !rangeTo) {
      return res
        .status(400)
        .json({ code: "invalidSessionDate", message: texts.invalidSessionDate });
    }

    const sessions = expandScheduleDates(
      group.schedule.days,
      rangeFrom,
      rangeTo,
    );

    res.json({
      group: { _id: group._id, name: group.name, schedule: group.schedule },
      from: rangeFrom,
      to: rangeTo,
      sessions,
      code: "attendanceFound",
      message: texts.attendanceFound,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /attendance/:id — teacher of own group
const updateAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res
        .status(404)
        .json({ code: "attendanceNotFound", message: texts.attendanceNotFound });
    }

    const group = await Group.findById(attendance.group);
    if (!group || String(group.teacher) !== String(req.user._id)) {
      return res
        .status(403)
        .json({ code: "notGroupTeacher", message: texts.notGroupTeacher });
    }

    const { status, note } = req.body;
    if (status !== undefined) {
      if (!ALLOWED_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ code: "invalidStatus", message: "Status noto'g'ri" });
      }
      attendance.status = status;
    }
    if (note !== undefined) attendance.note = note;
    attendance.markedBy = req.user._id;
    await attendance.save();

    const studentDoc = await User.findById(attendance.student).select("firstName lastName");
    await recordService.createRecord({
      eventType: "ATTENDANCE_UPDATED",
      entityType: "Attendance",
      entityId: attendance._id,
      entity: attendance,
      actor: recordService.actorFromReq(req),
      refs: {
        studentId: attendance.student,
        groupId: attendance.group,
        enrollmentId: attendance.enrollment,
        attendanceId: attendance._id,
      },
      metadata: { student: studentDoc },
    });

    res.json({
      attendance,
      code: "attendanceUpdated",
      message: texts.attendanceUpdated,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /attendance/:id — admin only
const deleteAttendance = async (req, res, next) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance) {
      return res
        .status(404)
        .json({ code: "attendanceNotFound", message: texts.attendanceNotFound });
    }

    const studentDoc = await User.findById(attendance.student).select("firstName lastName");
    await recordService.createRecord({
      eventType: "ATTENDANCE_DELETED",
      entityType: "Attendance",
      entityId: attendance._id,
      entity: attendance,
      actor: recordService.actorFromReq(req),
      refs: {
        studentId: attendance.student,
        groupId: attendance.group,
        enrollmentId: attendance.enrollment,
        attendanceId: attendance._id,
      },
      metadata: { student: studentDoc },
    });

    res.json({
      code: "attendanceDeleted",
      message: texts.attendanceDeleted,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  bulkMarkAttendance,
  getAttendances,
  getSessionAttendance,
  getScheduleSessions,
  updateAttendance,
  deleteAttendance,
};
