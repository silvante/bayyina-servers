const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, buildSearchRegex } = require("../utils/helpers");
const RejectionReason = require("../models/RejectionReason");
const recordService = require("../services/recordService");

const UPDATABLE_FIELDS = ["title", "description"];

// GET /rejection-reasons
const getRejectionReasons = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    const regex = buildSearchRegex(req.query.q);
    if (regex) filter.$or = [{ title: regex }, { description: regex }];

    const [rejectionReasons, total] = await Promise.all([
      RejectionReason.find(filter)
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      RejectionReason.countDocuments(filter),
    ]);

    res.json({
      rejectionReasons,
      ...buildPaginationMeta(total, page, limit),
      code: "rejectionReasonsFound",
      message: texts.rejectionReasonsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /rejection-reasons/:id
const getRejectionReason = async (req, res, next) => {
  try {
    const rejectionReason = await RejectionReason.findById(req.params.id)
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!rejectionReason) {
      return res.status(404).json({ code: "rejectionReasonNotFound", message: texts.rejectionReasonNotFound });
    }

    res.json({ rejectionReason, code: "rejectionReasonsFound", message: texts.rejectionReasonsFound });
  } catch (err) {
    next(err);
  }
};

// POST /rejection-reasons — admin only
const createRejectionReason = async (req, res, next) => {
  const { title } = req.body;

  if (!title || !String(title).trim()) {
    return res.status(400).json({ code: "missingField", message: "Rad etish sababi kiritilishi shart" });
  }

  try {
    const rejectionReason = await RejectionReason.create({
      title,
      description: req.body.description,
      createdBy: req.user._id,
    });

    const populated = await rejectionReason.populate({ path: "createdBy", select: "firstName lastName" });

    await recordService.createRecord({
      eventType: "REJECTION_REASON_CREATED",
      entityType: "RejectionReason",
      entityId: rejectionReason._id,
      entity: rejectionReason,
      actor: recordService.actorFromReq(req),
      refs: { rejectionReasonId: rejectionReason._id },
    });

    res.status(201).json({ rejectionReason: populated, code: "rejectionReasonCreated", message: texts.rejectionReasonCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /rejection-reasons/:id — admin only
const updateRejectionReason = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, UPDATABLE_FIELDS);

    const existing = await RejectionReason.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "rejectionReasonNotFound", message: texts.rejectionReasonNotFound });
    }

    const rejectionReason = await RejectionReason.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!rejectionReason) {
      return res.status(404).json({ code: "rejectionReasonNotFound", message: texts.rejectionReasonNotFound });
    }

    const diff = recordService.diffFields(existing.toObject(), rejectionReason.toObject(), UPDATABLE_FIELDS);

    if (diff) {
      await recordService.createRecord({
        eventType: "REJECTION_REASON_UPDATED",
        entityType: "RejectionReason",
        entityId: rejectionReason._id,
        entity: rejectionReason,
        actor: recordService.actorFromReq(req),
        refs: { rejectionReasonId: rejectionReason._id },
        changes: diff,
      });
    }

    res.json({ rejectionReason, code: "rejectionReasonUpdated", message: texts.rejectionReasonUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /rejection-reasons/:id — admin only
const deleteRejectionReason = async (req, res, next) => {
  try {
    const rejectionReason = await RejectionReason.findByIdAndDelete(req.params.id);
    if (!rejectionReason) {
      return res.status(404).json({ code: "rejectionReasonNotFound", message: texts.rejectionReasonNotFound });
    }

    await recordService.createRecord({
      eventType: "REJECTION_REASON_DELETED",
      entityType: "RejectionReason",
      entityId: rejectionReason._id,
      entity: rejectionReason,
      actor: recordService.actorFromReq(req),
      refs: { rejectionReasonId: rejectionReason._id },
    });

    res.json({ code: "rejectionReasonDeleted", message: texts.rejectionReasonDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getRejectionReasons, getRejectionReason, createRejectionReason, updateRejectionReason, deleteRejectionReason };
