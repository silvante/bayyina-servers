const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta } = require("../utils/helpers");
const Group = require("../models/Group");

// GET /groups
const getGroups = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    // Teachers only see their own groups
    if (req.user.role === "teacher") {
      filter.teacher = req.user._id;
    }

    const [groups, total] = await Promise.all([
      Group.find(filter)
        .populate({ path: "teacher", select: "firstName lastName phone" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Group.countDocuments(filter),
    ]);

    res.json({
      groups,
      ...buildPaginationMeta(total, page, limit),
      code: "groupsFound",
      message: texts.groupsFound,
    });
  } catch (err) {
    next(err);
  }
};

// GET /groups/:id
const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate({ path: "teacher", select: "firstName lastName phone" });

    if (!group) {
      return res.status(404).json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    // Teacher can only access own group
    if (req.user.role === "teacher" && String(group.teacher._id) !== String(req.user._id)) {
      return res.status(403).json({ code: "forbidden", message: texts.forbidden });
    }

    res.json({ group, code: "groupsFound", message: texts.groupsFound });
  } catch (err) {
    next(err);
  }
};

// POST /groups — admin only
const createGroup = async (req, res, next) => {
  const { name, description, price, teacher, schedule, room } = req.body;

  if (!name) {
    return res.status(400).json({ code: "missingField", message: "Guruh nomi kiritilishi shart" });
  }
  if (price === undefined || price === null) {
    return res.status(400).json({ code: "missingField", message: "Narx kiritilishi shart" });
  }
  if (!teacher) {
    return res.status(400).json({ code: "missingField", message: "O'qituvchi kiritilishi shart" });
  }
  if (!schedule) {
    return res.status(400).json({ code: "missingField", message: "Dars jadvali kiritilishi shart" });
  }
  if (!schedule.time) {
    return res.status(400).json({ code: "missingField", message: "Dars vaqti kiritilishi shart" });
  }

  const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  if (schedule.days && schedule.days.some((d) => !validDays.includes(d))) {
    return res.status(400).json({ code: "invalidField", message: "Noto'g'ri kun kiritildi. Faqat haftaning kunlari qabul qilinadi" });
  }

  try {
    const group = await Group.create({
      name,
      description,
      price,
      teacher,
      schedule,
      room,
      createdBy: req.user._id,
    });

    const populated = await group.populate({ path: "teacher", select: "firstName lastName phone" });

    res.status(201).json({ group: populated, code: "groupCreated", message: texts.groupCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /groups/:id — admin only
const updateGroup = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, [
      "name", "description", "price", "teacher", "schedule", "room",
    ]);

    const group = await Group.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "teacher", select: "firstName lastName phone" });

    if (!group) {
      return res.status(404).json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    res.json({ group, code: "groupUpdated", message: texts.groupUpdated });
  } catch (err) {
    next(err);
  }
};

// DELETE /groups/:id — admin only
const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ code: "groupNotFound", message: texts.groupNotFound });
    }
    res.json({ code: "groupDeleted", message: texts.groupDeleted });
  } catch (err) {
    next(err);
  }
};

module.exports = { getGroups, getGroup, createGroup, updateGroup, deleteGroup };
