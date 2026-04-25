const crypto = require("crypto");
const texts = require("../data/texts");
const {
  getPagination,
  buildPaginationMeta,
  pickAllowedFields,
  buildSearchRegex,
} = require("../utils/helpers");
const Lead = require("../models/Lead");
const recordService = require("../services/recordService");

const ALLOWED_STATUSES = ["new", "contacted", "interested", "scheduled", "converted", "rejected"];
const ALLOWED_SOURCES = ["telegram", "instagram", "referral", "offline", "other"];
const ALLOWED_PAYMENT_STATUSES = ["unpaid", "partial", "paid"];
const ALLOWED_GENDERS = ["male", "female"];

const UPDATABLE_FIELDS = [
  "firstName",
  "phone",
  "telegramId",
  "gender",
  "age",
  "profession",
  "source",
  "interest",
  "group",
  "level",
  "status",
  "rejectionReason",
  "paymentStatus",
  "scheduledAt",
  "notes",
];

const generateUniqueLink = async () => {
  for (let i = 0; i < 5; i++) {
    const slug = crypto.randomBytes(6).toString("hex");
    const exists = await Lead.exists({ uniqueLink: slug });
    if (!exists) return slug;
  }
  return crypto.randomBytes(12).toString("hex");
};

// GET /leads
const getLeads = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.group) filter.group = req.query.group;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;

    if (req.query.search) {
      const term = String(req.query.search).trim();
      if (term) {
        const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const orClauses = [{ firstName: regex }];
        const asNumber = Number(term);
        if (!Number.isNaN(asNumber)) orClauses.push({ phone: asNumber });
        filter.$or = orClauses;
      }
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate({ path: "group", select: "name price" })
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Lead.countDocuments(filter),
    ]);

    res.json({
      leads,
      ...buildPaginationMeta(total, page, limit),
      code: "leadsFound",
      message: texts.leadsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /leads/:id
const getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate({ path: "group", select: "name price teacher" })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!lead) {
      return res.status(404).json({ code: "leadNotFound", message: texts.leadNotFound });
    }

    res.json({ lead, code: "leadsFound", message: texts.leadsFound });
  } catch (err) {
    next(err);
  }
};

// POST /leads
const createLead = async (req, res, next) => {
  const { firstName } = req.body;

  if (!firstName || !String(firstName).trim()) {
    return res.status(400).json({ code: "missingField", message: "Ism kiritilishi shart" });
  }

  const payload = pickAllowedFields(req.body, UPDATABLE_FIELDS);

  if (payload.status && !ALLOWED_STATUSES.includes(payload.status)) {
    return res.status(400).json({ code: "invalidLeadStatus", message: texts.invalidLeadStatus });
  }
  if (payload.source && !ALLOWED_SOURCES.includes(payload.source)) {
    return res.status(400).json({ code: "invalidField", message: "Manba noto'g'ri" });
  }
  if (payload.paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(payload.paymentStatus)) {
    return res.status(400).json({ code: "invalidField", message: "To'lov holati noto'g'ri" });
  }
  if (payload.gender && !ALLOWED_GENDERS.includes(payload.gender)) {
    return res.status(400).json({ code: "invalidField", message: "Jins noto'g'ri" });
  }
  if (payload.scheduledAt) payload.scheduledAt = new Date(payload.scheduledAt);

  try {
    const uniqueLink = await generateUniqueLink();
    const now = new Date();

    const lead = await Lead.create({
      ...payload,
      uniqueLink,
      lastActivityAt: now,
      createdBy: req.user?._id,
    });

    const populated = await lead.populate([
      { path: "group", select: "name price" },
      { path: "createdBy", select: "firstName lastName" },
    ]);

    await recordService.createRecord({
      eventType: "LEAD_CREATED",
      entityType: "Lead",
      entityId: lead._id,
      entity: lead,
      actor: recordService.actorFromReq(req),
      refs: {
        leadId: lead._id,
        groupId: lead.group || undefined,
      },
    });

    res.status(201).json({ lead: populated, code: "leadCreated", message: texts.leadCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /leads/:id
const updateLead = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, UPDATABLE_FIELDS);

    if (updates.status && !ALLOWED_STATUSES.includes(updates.status)) {
      return res.status(400).json({ code: "invalidLeadStatus", message: texts.invalidLeadStatus });
    }
    if (updates.source && !ALLOWED_SOURCES.includes(updates.source)) {
      return res.status(400).json({ code: "invalidField", message: "Manba noto'g'ri" });
    }
    if (updates.paymentStatus && !ALLOWED_PAYMENT_STATUSES.includes(updates.paymentStatus)) {
      return res.status(400).json({ code: "invalidField", message: "To'lov holati noto'g'ri" });
    }
    if (updates.gender && !ALLOWED_GENDERS.includes(updates.gender)) {
      return res.status(400).json({ code: "invalidField", message: "Jins noto'g'ri" });
    }
    if (updates.scheduledAt) updates.scheduledAt = new Date(updates.scheduledAt);

    updates.lastActivityAt = new Date();

    const existing = await Lead.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "leadNotFound", message: texts.leadNotFound });
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "group", select: "name price" })
      .populate({ path: "createdBy", select: "firstName lastName" });

    if (!lead) {
      return res.status(404).json({ code: "leadNotFound", message: texts.leadNotFound });
    }

    const actor = recordService.actorFromReq(req);
    const diff = recordService.diffFields(
      existing.toObject(),
      lead.toObject(),
      UPDATABLE_FIELDS,
    );

    if (diff) {
      await recordService.createRecord({
        eventType: "LEAD_UPDATED",
        entityType: "Lead",
        entityId: lead._id,
        entity: lead,
        actor,
        refs: { leadId: lead._id, groupId: lead.group?._id || lead.group || undefined },
        changes: diff,
      });
    }

    if (
      updates.status !== undefined &&
      String(existing.status) !== String(lead.status)
    ) {
      await recordService.createRecord({
        eventType: "LEAD_STATUS_CHANGED",
        entityType: "Lead",
        entityId: lead._id,
        entity: lead,
        actor,
        refs: { leadId: lead._id, groupId: lead.group?._id || lead.group || undefined },
        metadata: { from: existing.status, to: lead.status },
      });
    }

    res.json({ lead, code: "leadUpdated", message: texts.leadUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /leads/:id
const deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ code: "leadNotFound", message: texts.leadNotFound });
    }

    await recordService.createRecord({
      eventType: "LEAD_DELETED",
      entityType: "Lead",
      entityId: lead._id,
      entity: lead,
      actor: recordService.actorFromReq(req),
      refs: { leadId: lead._id, groupId: lead.group || undefined },
    });

    res.json({ code: "leadDeleted", message: texts.leadDeleted });
  } catch (err) {
    next(err);
  }
};

// GET /leads/track/:uniqueLink — public
const trackLeadClick = async (req, res, next) => {
  try {
    const { uniqueLink } = req.params;
    const now = new Date();

    const lead = await Lead.findOne({ uniqueLink });
    if (!lead) {
      return res.status(404).json({ code: "leadNotFound", message: texts.leadNotFound });
    }

    const wasFirstClick = !lead.linkClickedAt;
    if (!lead.linkClickedAt) lead.linkClickedAt = now;
    lead.lastActivityAt = now;
    await lead.save();

    if (wasFirstClick) {
      await recordService.createRecord({
        eventType: "LEAD_LINK_CLICKED",
        entityType: "Lead",
        entityId: lead._id,
        entity: lead,
        actor: recordService.systemActor("Tizim"),
        refs: { leadId: lead._id, groupId: lead.group || undefined },
      });
    }

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// GET /leads/search
// Searches across firstName, telegramId, profession, interest, notes, level (text fields)
// and phone, age (numeric). Supports field filters: status, source, paymentStatus, gender,
// group, level, minAge, maxAge.
const searchLeads = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.gender) filter.gender = String(req.query.gender).toLowerCase();
    if (req.query.group) filter.group = req.query.group;
    if (req.query.level) filter.level = buildSearchRegex(req.query.level);
    if (req.query.profession) filter.profession = buildSearchRegex(req.query.profession);

    if (req.query.age !== undefined && req.query.age !== "") {
      const ageNum = Number(req.query.age);
      if (!Number.isNaN(ageNum)) filter.age = ageNum;
    }
    if (req.query.minAge !== undefined || req.query.maxAge !== undefined) {
      const ageRange = {};
      const min = Number(req.query.minAge);
      const max = Number(req.query.maxAge);
      if (!Number.isNaN(min)) ageRange.$gte = min;
      if (!Number.isNaN(max)) ageRange.$lte = max;
      if (Object.keys(ageRange).length) filter.age = ageRange;
    }

    const regex = buildSearchRegex(req.query.q);
    if (regex) {
      const orClauses = [
        { firstName: regex },
        { telegramId: regex },
        { profession: regex },
        { interest: regex },
        { notes: regex },
        { level: regex },
      ];
      const numeric = Number(String(req.query.q).trim());
      if (!Number.isNaN(numeric)) {
        orClauses.push({ phone: numeric });
        orClauses.push({ age: numeric });
      }
      filter.$or = orClauses;
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .populate({ path: "group", select: "name price" })
        .populate({ path: "createdBy", select: "firstName lastName" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Lead.countDocuments(filter),
    ]);

    res.json({
      leads,
      ...buildPaginationMeta(total, page, limit),
      code: "leadsFound",
      message: texts.leadsFound,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  trackLeadClick,
  searchLeads,
};
