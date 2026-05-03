const axios = require("axios");
const texts = require("../data/texts");
const { pickAllowedFields, getPagination, buildPaginationMeta, buildSearchRegex } = require("../utils/helpers");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");
const User = require("../models/User");
const recordService = require("../services/recordService");

const GROUP_UPDATABLE_FIELDS = ["name", "description", "price", "teacher", "schedule", "room", "salaryOverride", "salaryType", "salaryValue", "minSalary", "showPaymentsToTeacher"];

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

    const isTeacher = req.user.role === "teacher";
    const result = isTeacher
      ? groups.map((g) => {
          const obj = g.toObject();
          if (!obj.showPaymentsToTeacher) delete obj.price;
          return obj;
        })
      : groups;

    res.json({
      groups: result,
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

    const enrollments = await Enrollment.find({ group: group._id })
      .select("-group -__v")
      .populate({ path: "student", select: "-password -__v" });

    const groupObj = group.toObject();
    if (req.user.role === "teacher" && !groupObj.showPaymentsToTeacher) {
      delete groupObj.price;
    }

    res.json({ group: groupObj, enrollments, code: "groupsFound", message: texts.groupsFound });
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

    await recordService.createRecord({
      eventType: "GROUP_CREATED",
      entityType: "Group",
      entityId: group._id,
      entity: group,
      actor: recordService.actorFromReq(req),
      refs: {
        groupId: group._id,
        teacherId: group.teacher,
      },
    });

    res.status(201).json({ group: populated, code: "groupCreated", message: texts.groupCreated });
  } catch (err) {
    next(err);
  }
};

// PUT /groups/:id — admin only
const updateGroup = async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, GROUP_UPDATABLE_FIELDS);

    const existing = await Group.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    const group = await Group.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate({ path: "teacher", select: "firstName lastName phone" });

    if (!group) {
      return res.status(404).json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    const diff = recordService.diffFields(
      existing.toObject(),
      group.toObject(),
      GROUP_UPDATABLE_FIELDS,
    );

    if (diff) {
      await recordService.createRecord({
        eventType: "GROUP_UPDATED",
        entityType: "Group",
        entityId: group._id,
        entity: group,
        actor: recordService.actorFromReq(req),
        refs: {
          groupId: group._id,
          teacherId: group.teacher?._id || group.teacher,
        },
        changes: diff,
      });
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

    await recordService.createRecord({
      eventType: "GROUP_DELETED",
      entityType: "Group",
      entityId: group._id,
      entity: group,
      actor: recordService.actorFromReq(req),
      refs: {
        groupId: group._id,
        teacherId: group.teacher,
      },
    });

    res.json({ code: "groupDeleted", message: texts.groupDeleted });
  } catch (err) {
    next(err);
  }
};

// GET /groups/search
// Searches across name, description, room, schedule.time (text fields) and price (numeric).
// Free-text q also matches teacher first/last name. Filters: teacher, day, minPrice, maxPrice.
const searchGroups = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.user.role === "teacher") {
      filter.teacher = req.user._id;
    } else if (req.query.teacher) {
      filter.teacher = req.query.teacher;
    }

    if (req.query.room) filter.room = buildSearchRegex(req.query.room);
    if (req.query.day) filter["schedule.days"] = req.query.day;

    if (req.query.price !== undefined && req.query.price !== "") {
      const priceNum = Number(req.query.price);
      if (!Number.isNaN(priceNum)) filter.price = priceNum;
    }
    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      const priceRange = {};
      const min = Number(req.query.minPrice);
      const max = Number(req.query.maxPrice);
      if (!Number.isNaN(min)) priceRange.$gte = min;
      if (!Number.isNaN(max)) priceRange.$lte = max;
      if (Object.keys(priceRange).length) filter.price = priceRange;
    }

    const regex = buildSearchRegex(req.query.q);
    if (regex) {
      const orClauses = [
        { name: regex },
        { description: regex },
        { room: regex },
        { "schedule.time": regex },
      ];
      const numeric = Number(String(req.query.q).trim());
      if (!Number.isNaN(numeric)) {
        orClauses.push({ price: numeric });
      }

      // Match by teacher name (admin only — teachers are already scoped to themselves).
      if (req.user.role !== "teacher") {
        const teachers = await User.find({
          role: "teacher",
          $or: [{ firstName: regex }, { lastName: regex }],
        }).select("_id");
        if (teachers.length) {
          orClauses.push({ teacher: { $in: teachers.map((t) => t._id) } });
        }
      }

      filter.$or = orClauses;
    }

    const [groups, total] = await Promise.all([
      Group.find(filter)
        .populate({ path: "teacher", select: "firstName lastName phone" })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      Group.countDocuments(filter),
    ]);

    const isTeacher = req.user.role === "teacher";
    const result = isTeacher
      ? groups.map((g) => {
          const obj = g.toObject();
          if (!obj.showPaymentsToTeacher) delete obj.price;
          return obj;
        })
      : groups;

    res.json({
      groups: result,
      ...buildPaginationMeta(total, page, limit),
      code: "groupsFound",
      message: texts.groupsFound,
    });
  } catch (err) {
    next(err);
  }
};

// POST /groups/:id/send-message — admin (any group) or teacher (own group)
const sendGroupMessage = async (req, res, next) => {
  const { message } = req.body;

  if (!message || !String(message).trim()) {
    return res.status(400).json({ code: "missingField", message: "Xabar matni kiritilishi shart" });
  }

  const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.MAIN_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return res.status(500).json({ code: "botTokenMissing", message: "BOT_TOKEN sozlanmagan" });
  }

  try {
    const group = await Group.findById(req.params.id).select("teacher");
    if (!group) {
      return res.status(404).json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    if (req.user.role === "teacher" && String(group.teacher) !== String(req.user._id)) {
      return res.status(403).json({ code: "forbidden", message: texts.forbidden });
    }

    const enrollments = await Enrollment.find({ group: group._id, status: "active" })
      .populate({ path: "student", select: "telegramId" });

    const ids = enrollments
      .map((e) => e.student?.telegramId)
      .filter((id) => id && String(id).trim() !== "");

    if (ids.length === 0) {
      return res.status(400).json({ code: "noRecipients", message: "Telegram ID bog'langan o'quvchilar topilmadi" });
    }

    const text = String(message).trim();
    let sent = 0;
    let failed = 0;

    for (const chatId of ids) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        });
        sent++;
      } catch {
        failed++;
      }
    }

    res.json({
      sent,
      failed,
      total: ids.length,
      code: "messagesSent",
      message: `${sent} ta xabar yuborildi`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getGroups, getGroup, createGroup, updateGroup, deleteGroup, searchGroups, sendGroupMessage };
