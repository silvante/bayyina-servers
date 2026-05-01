const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, buildSearchRegex } = require("../utils/helpers");
const Interest = require("../models/Interest");
const Lead = require("../models/Lead");
const recordService = require("../services/recordService");

const UPDATABLE_FIELDS = ["name"];

// GET /interests
const getInterests = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    const regex = buildSearchRegex(req.query.q);
    if (regex) filter.$or = [{ name: regex }];

    const [interests, total] = await Promise.all([
      Interest.find(filter)
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Interest.countDocuments(filter),
    ]);

    res.json({
      interests,
      ...buildPaginationMeta(total, page, limit),
      code: "interestsFound",
      message: texts.interestsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /interests/:id
const getInterest = async (req, res, next) => {
  try {
    const interest = await Interest.findById(req.params.id)
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!interest) {
      return res.status(404).json({ code: "interestNotFound", message: texts.interestNotFound });
    }

    res.json({ interest, code: "interestsFound", message: texts.interestsFound });
  } catch (err) {
    next(err);
  }
};

// POST /interests
const createInterest = async (req, res, next) => {
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ code: "missingField", message: "Qiziqish nomi kiritilishi shart" });
  }

  try {
    const interest = await Interest.create({
      name: String(name).trim(),
      createdBy: req.user._id,
    });

    const populated = await interest.populate({ path: "createdBy", select: "firstName lastName" });

    await recordService.createRecord({
      eventType: "INTEREST_CREATED",
      entityType: "System",
      entityId: interest._id,
      entity: interest,
      actor: recordService.actorFromReq(req),
    });

    res.status(201).json({ interest: populated, code: "interestCreated", message: texts.interestCreated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ code: "duplicateName", message: "Bu nomli qiziqish allaqachon mavjud" });
    }
    next(err);
  }
};

// PUT /interests/:id
const updateInterest = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, UPDATABLE_FIELDS);

    const existing = await Interest.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "interestNotFound", message: texts.interestNotFound });
    }

    const interest = await Interest.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!interest) {
      return res.status(404).json({ code: "interestNotFound", message: texts.interestNotFound });
    }

    const diff = recordService.diffFields(existing.toObject(), interest.toObject(), UPDATABLE_FIELDS);

    if (diff) {
      await recordService.createRecord({
        eventType: "INTEREST_UPDATED",
        entityType: "System",
        entityId: interest._id,
        entity: interest,
        actor: recordService.actorFromReq(req),
        changes: diff,
      });
    }

    res.json({ interest, code: "interestUpdated", message: texts.interestUpdated });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ code: "duplicateName", message: "Bu nomli qiziqish allaqachon mavjud" });
    }
    next(err);
  }
};

// DELETE /interests/:id
const deleteInterest = async (req, res, next) => {
  try {
    const interest = await Interest.findById(req.params.id);
    if (!interest) {
      return res.status(404).json({ code: "interestNotFound", message: texts.interestNotFound });
    }

    // Nullify references in leads before deleting
    await Lead.updateMany({ interest: req.params.id }, { $unset: { interest: "" } });

    await Interest.findByIdAndDelete(req.params.id);

    await recordService.createRecord({
      eventType: "INTEREST_DELETED",
      entityType: "System",
      entityId: interest._id,
      entity: interest,
      actor: recordService.actorFromReq(req),
    });

    res.json({ code: "interestDeleted", message: texts.interestDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getInterests, getInterest, createInterest, updateInterest, deleteInterest };
