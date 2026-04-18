const mongoose = require("mongoose");
const texts = require("../data/texts");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");
const Record = require("../models/Record");

const { EVENT_TYPES, ENTITY_TYPES } = Record;

const parseDateBound = (value, endOfDay = false) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  if (endOfDay) d.setUTCHours(23, 59, 59, 999);
  return d;
};

// GET /records — admin only
const getRecords = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    const {
      eventType,
      entityType,
      entityId,
      actorId,
      leadId,
      studentId,
      teacherId,
      groupId,
      enrollmentId,
      paymentId,
      attendanceId,
      from,
      to,
      search,
    } = req.query;

    if (eventType) {
      if (!EVENT_TYPES.includes(eventType)) {
        return res.status(400).json({ code: "invalidField", message: "Hodisa turi noto'g'ri" });
      }
      filter.eventType = eventType;
    }
    if (entityType) {
      if (!ENTITY_TYPES.includes(entityType)) {
        return res.status(400).json({ code: "invalidField", message: "Obyekt turi noto'g'ri" });
      }
      filter.entityType = entityType;
    }
    if (entityId && mongoose.Types.ObjectId.isValid(entityId)) filter.entityId = entityId;
    if (actorId && mongoose.Types.ObjectId.isValid(actorId)) filter["actor.userId"] = actorId;
    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) filter["refs.leadId"] = leadId;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter["refs.studentId"] = studentId;
    if (teacherId && mongoose.Types.ObjectId.isValid(teacherId)) filter["refs.teacherId"] = teacherId;
    if (groupId && mongoose.Types.ObjectId.isValid(groupId)) filter["refs.groupId"] = groupId;
    if (enrollmentId && mongoose.Types.ObjectId.isValid(enrollmentId)) filter["refs.enrollmentId"] = enrollmentId;
    if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) filter["refs.paymentId"] = paymentId;
    if (attendanceId && mongoose.Types.ObjectId.isValid(attendanceId)) filter["refs.attendanceId"] = attendanceId;

    const fromDate = parseDateBound(from);
    const toDate = parseDateBound(to, true);
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = fromDate;
      if (toDate) filter.createdAt.$lte = toDate;
    }

    if (search) {
      const term = String(search).trim();
      if (term) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ description: regex }, { code: regex }];
      }
    }

    const [records, total] = await Promise.all([
      Record.find(filter)
        .populate({ path: "actor.userId", select: "firstName lastName role" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Record.countDocuments(filter),
    ]);

    res.json({
      records,
      ...buildPaginationMeta(total, page, limit),
      code: "recordsFound",
      message: texts.recordsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /records/:id — by ObjectId or by code (REC-YYYYMMDD-NNNN)
const getRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { code: id };

    const record = await Record.findOne(query).populate({
      path: "actor.userId",
      select: "firstName lastName role",
    });

    if (!record) {
      return res.status(404).json({ code: "recordNotFound", message: texts.recordNotFound });
    }

    res.json({ record, code: "recordsFound", message: texts.recordsFound });
  } catch (err) {
    next(err);
  }
};

// GET /records/entity/:entityType/:entityId — full timeline for one entity
const getEntityTimeline = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;

    if (!ENTITY_TYPES.includes(entityType)) {
      return res.status(400).json({ code: "invalidField", message: "Obyekt turi noto'g'ri" });
    }
    if (!mongoose.Types.ObjectId.isValid(entityId)) {
      return res.status(400).json({ code: "invalidId", message: "ID noto'g'ri kiritildi" });
    }

    const { page, limit, skip } = getPagination(req.query);

    const refKey = {
      Lead: "refs.leadId",
      User: "refs.studentId",
      Enrollment: "refs.enrollmentId",
      Group: "refs.groupId",
      Payment: "refs.paymentId",
      Attendance: "refs.attendanceId",
    }[entityType];

    const baseFilter = { entityType, entityId };
    const filter = refKey
      ? { $or: [baseFilter, { [refKey]: entityId }] }
      : baseFilter;

    const [records, total] = await Promise.all([
      Record.find(filter)
        .populate({ path: "actor.userId", select: "firstName lastName role" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Record.countDocuments(filter),
    ]);

    res.json({
      records,
      ...buildPaginationMeta(total, page, limit),
      code: "recordsFound",
      message: texts.recordsFound,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRecords, getRecord, getEntityTimeline };
