const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, buildSearchRegex } = require("../utils/helpers");
const LeadSource = require("../models/LeadSource");
const recordService = require("../services/recordService");

const UPDATABLE_FIELDS = ["name", "slug"];

// GET /lead-sources
const getLeadSources = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    const regex = buildSearchRegex(req.query.q);
    if (regex) filter.$or = [{ name: regex }, { slug: regex }];

    const [leadSources, total] = await Promise.all([
      LeadSource.find(filter)
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      LeadSource.countDocuments(filter),
    ]);

    res.json({
      leadSources,
      ...buildPaginationMeta(total, page, limit),
      code: "leadSourcesFound",
      message: texts.leadSourcesFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /lead-sources/:id
const getLeadSource = async (req, res, next) => {
  try {
    const leadSource = await LeadSource.findById(req.params.id)
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!leadSource) {
      return res.status(404).json({ code: "leadSourceNotFound", message: texts.leadSourceNotFound });
    }

    res.json({ leadSource, code: "leadSourcesFound", message: texts.leadSourcesFound });
  } catch (err) {
    next(err);
  }
};

// POST /lead-sources — admin only
const createLeadSource = async (req, res, next) => {
  const { name } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ code: "missingField", message: "Manba nomi kiritilishi shart" });
  }

  try {
    const leadSource = await LeadSource.create({
      name,
      slug: req.body.slug,
      createdBy: req.user._id,
    });

    const populated = await leadSource.populate({ path: "createdBy", select: "firstName lastName" });

    await recordService.createRecord({
      eventType: "LEAD_SOURCE_CREATED",
      entityType: "LeadSource",
      entityId: leadSource._id,
      entity: leadSource,
      actor: recordService.actorFromReq(req),
      refs: { leadSourceId: leadSource._id },
    });

    res.status(201).json({ leadSource: populated, code: "leadSourceCreated", message: texts.leadSourceCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /lead-sources/:id — admin only
const updateLeadSource = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, UPDATABLE_FIELDS);

    const existing = await LeadSource.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "leadSourceNotFound", message: texts.leadSourceNotFound });
    }

    const leadSource = await LeadSource.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!leadSource) {
      return res.status(404).json({ code: "leadSourceNotFound", message: texts.leadSourceNotFound });
    }

    const diff = recordService.diffFields(existing.toObject(), leadSource.toObject(), UPDATABLE_FIELDS);

    if (diff) {
      await recordService.createRecord({
        eventType: "LEAD_SOURCE_UPDATED",
        entityType: "LeadSource",
        entityId: leadSource._id,
        entity: leadSource,
        actor: recordService.actorFromReq(req),
        refs: { leadSourceId: leadSource._id },
        changes: diff,
      });
    }

    res.json({ leadSource, code: "leadSourceUpdated", message: texts.leadSourceUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /lead-sources/:id — admin only
const deleteLeadSource = async (req, res, next) => {
  try {
    const leadSource = await LeadSource.findByIdAndDelete(req.params.id);
    if (!leadSource) {
      return res.status(404).json({ code: "leadSourceNotFound", message: texts.leadSourceNotFound });
    }

    await recordService.createRecord({
      eventType: "LEAD_SOURCE_DELETED",
      entityType: "LeadSource",
      entityId: leadSource._id,
      entity: leadSource,
      actor: recordService.actorFromReq(req),
      refs: { leadSourceId: leadSource._id },
    });

    res.json({ code: "leadSourceDeleted", message: texts.leadSourceDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLeadSources, getLeadSource, createLeadSource, updateLeadSource, deleteLeadSource };
