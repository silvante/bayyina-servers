const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, buildSearchRegex } = require("../utils/helpers");
const CourseType = require("../models/CourseType");
const recordService = require("../services/recordService");

const UPDATABLE_FIELDS = ["name", "type", "direction"];

// GET /course-types
const getCourseTypes = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.type) filter.type = buildSearchRegex(req.query.type);
    if (req.query.direction) filter.direction = buildSearchRegex(req.query.direction);

    const regex = buildSearchRegex(req.query.q);
    if (regex) filter.$or = [{ name: regex }, { type: regex }, { direction: regex }];

    const [courseTypes, total] = await Promise.all([
      CourseType.find(filter)
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      CourseType.countDocuments(filter),
    ]);

    res.json({
      courseTypes,
      ...buildPaginationMeta(total, page, limit),
      code: "courseTypesFound",
      message: texts.courseTypesFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /course-types/:id
const getCourseType = async (req, res, next) => {
  try {
    const courseType = await CourseType.findById(req.params.id)
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!courseType) {
      return res.status(404).json({ code: "courseTypeNotFound", message: texts.courseTypeNotFound });
    }

    res.json({ courseType, code: "courseTypesFound", message: texts.courseTypesFound });
  } catch (err) {
    next(err);
  }
};

// POST /course-types — admin only
const createCourseType = async (req, res, next) => {
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ code: "missingField", message: "Kurs turi nomi kiritilishi shart" });
  }

  try {
    const courseType = await CourseType.create({
      name,
      type: req.body.type,
      direction: req.body.direction,
      createdBy: req.user._id,
    });

    const populated = await courseType.populate({ path: "createdBy", select: "firstName lastName" });

    await recordService.createRecord({
      eventType: "COURSE_TYPE_CREATED",
      entityType: "CourseType",
      entityId: courseType._id,
      entity: courseType,
      actor: recordService.actorFromReq(req),
      refs: { courseTypeId: courseType._id },
    });

    res.status(201).json({ courseType: populated, code: "courseTypeCreated", message: texts.courseTypeCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /course-types/:id — admin only
const updateCourseType = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, UPDATABLE_FIELDS);

    const existing = await CourseType.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "courseTypeNotFound", message: texts.courseTypeNotFound });
    }

    const courseType = await CourseType.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!courseType) {
      return res.status(404).json({ code: "courseTypeNotFound", message: texts.courseTypeNotFound });
    }

    const diff = recordService.diffFields(existing.toObject(), courseType.toObject(), UPDATABLE_FIELDS);

    if (diff) {
      await recordService.createRecord({
        eventType: "COURSE_TYPE_UPDATED",
        entityType: "CourseType",
        entityId: courseType._id,
        entity: courseType,
        actor: recordService.actorFromReq(req),
        refs: { courseTypeId: courseType._id },
        changes: diff,
      });
    }

    res.json({ courseType, code: "courseTypeUpdated", message: texts.courseTypeUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /course-types/:id — admin only
const deleteCourseType = async (req, res, next) => {
  try {
    const courseType = await CourseType.findByIdAndDelete(req.params.id);
    if (!courseType) {
      return res.status(404).json({ code: "courseTypeNotFound", message: texts.courseTypeNotFound });
    }

    await recordService.createRecord({
      eventType: "COURSE_TYPE_DELETED",
      entityType: "CourseType",
      entityId: courseType._id,
      entity: courseType,
      actor: recordService.actorFromReq(req),
      refs: { courseTypeId: courseType._id },
    });

    res.json({ code: "courseTypeDeleted", message: texts.courseTypeDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getCourseTypes, getCourseType, createCourseType, updateCourseType, deleteCourseType };
