const texts = require("../data/texts");
const { getPagination, buildPaginationMeta } = require("../utils/helpers");
const Notification = require("../models/Notification");
const Group = require("../models/Group");
const Enrollment = require("../models/Enrollment");

const VALID_TYPES = ["complaint", "suggestion", "question", "other"];
const VALID_STATUSES = ["open", "in_progress", "resolved"];

const getOwnGroupIds = (teacherId) =>
  Group.find({ teacher: teacherId }).distinct("_id");

const populateNotification = (query) =>
  query
    .populate({ path: "sender", select: "firstName lastName phone role" })
    .populate({ path: "group", select: "name" })
    .populate({ path: "feedback.author", select: "firstName lastName role" });

// POST /notifications — student only
const createNotification = async (req, res, next) => {
  try {
    const { group: groupId, title, message, type } = req.body;

    if (!groupId) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Guruh kiritilishi shart" });
    }
    if (!title) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Sarlavha kiritilishi shart" });
    }
    if (!message) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Xabar matni kiritilishi shart" });
    }
    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ code: "invalidField", message: "Xabar turi noto'g'ri" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res
        .status(404)
        .json({ code: "groupNotFound", message: texts.groupNotFound });
    }

    const enrolled = await Enrollment.exists({
      student: req.user._id,
      group: group._id,
    });
    if (!enrolled) {
      return res.status(403).json({
        code: "notEnrolledInGroup",
        message: texts.notEnrolledInGroup,
      });
    }

    const notification = await Notification.create({
      group: group._id,
      sender: req.user._id,
      title,
      message,
      type: type || "other",
    });

    const populated = await populateNotification(
      Notification.findById(notification._id)
    );

    res.status(201).json({
      notification: populated,
      code: "notificationCreated",
      message: texts.notificationCreated,
    });
  } catch (err) {
    next(err);
  }
};

// GET /notifications
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = {};

    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.type && VALID_TYPES.includes(req.query.type)) {
      filter.type = req.query.type;
    }
    if (req.query.group) filter.group = req.query.group;

    if (req.user.role === "student") {
      filter.sender = req.user._id;
    } else if (req.user.role === "teacher") {
      const ownGroupIds = await getOwnGroupIds(req.user._id);
      if (filter.group) {
        const allowed = ownGroupIds.some(
          (id) => String(id) === String(filter.group)
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

    const [notifications, total] = await Promise.all([
      populateNotification(
        Notification.find(filter)
          .skip(skip)
          .limit(limit)
          .sort({ createdAt: -1 })
      ),
      Notification.countDocuments(filter),
    ]);

    res.json({
      notifications,
      ...buildPaginationMeta(total, page, limit),
      code: "notificationsFound",
      message: texts.notificationsFound,
    });
  } catch (err) {
    next(err);
  }
};

const canAccessNotification = async (req, notification) => {
  if (req.user.role === "admin") return true;
  if (req.user.role === "student") {
    return String(notification.sender._id || notification.sender) ===
      String(req.user._id);
  }
  if (req.user.role === "teacher") {
    const group = await Group.findById(notification.group._id || notification.group);
    return !!group && String(group.teacher) === String(req.user._id);
  }
  return false;
};

// GET /notifications/:id
const getNotification = async (req, res, next) => {
  try {
    const notification = await populateNotification(
      Notification.findById(req.params.id)
    );
    if (!notification) {
      return res.status(404).json({
        code: "notificationNotFound",
        message: texts.notificationNotFound,
      });
    }

    const allowed = await canAccessNotification(req, notification);
    if (!allowed) {
      return res
        .status(403)
        .json({ code: "forbidden", message: texts.forbidden });
    }

    res.json({
      notification,
      code: "notificationsFound",
      message: texts.notificationsFound,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /notifications/:id/status — admin or teacher of the group
const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ code: "invalidField", message: "Holat noto'g'ri" });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({
        code: "notificationNotFound",
        message: texts.notificationNotFound,
      });
    }

    if (req.user.role === "teacher") {
      const group = await Group.findById(notification.group);
      if (!group || String(group.teacher) !== String(req.user._id)) {
        return res
          .status(403)
          .json({ code: "forbidden", message: texts.forbidden });
      }
    }

    notification.status = status;
    await notification.save();

    const populated = await populateNotification(
      Notification.findById(notification._id)
    );

    res.json({
      notification: populated,
      code: "notificationUpdated",
      message: texts.notificationUpdated,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /notifications/:id — admin only
const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({
        code: "notificationNotFound",
        message: texts.notificationNotFound,
      });
    }
    res.json({
      code: "notificationDeleted",
      message: texts.notificationDeleted,
    });
  } catch (err) {
    next(err);
  }
};

// POST /notifications/:id/feedback — admin or teacher of the group
const addFeedback = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Xabar matni kiritilishi shart" });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({
        code: "notificationNotFound",
        message: texts.notificationNotFound,
      });
    }

    if (req.user.role === "teacher") {
      const group = await Group.findById(notification.group);
      if (!group || String(group.teacher) !== String(req.user._id)) {
        return res
          .status(403)
          .json({ code: "forbidden", message: texts.forbidden });
      }
    }

    notification.feedback.push({
      role: req.user.role,
      author: req.user._id,
      message,
    });
    await notification.save();

    const populated = await populateNotification(
      Notification.findById(notification._id)
    );

    res.status(201).json({
      notification: populated,
      code: "feedbackAdded",
      message: texts.feedbackAdded,
    });
  } catch (err) {
    next(err);
  }
};

// PUT /notifications/:id/feedback/:feedbackId — author only
const updateFeedback = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res
        .status(400)
        .json({ code: "missingField", message: "Xabar matni kiritilishi shart" });
    }

    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({
        code: "notificationNotFound",
        message: texts.notificationNotFound,
      });
    }

    const entry = notification.feedback.id(req.params.feedbackId);
    if (!entry) {
      return res.status(404).json({
        code: "feedbackNotFound",
        message: texts.feedbackNotFound,
      });
    }

    if (String(entry.author) !== String(req.user._id)) {
      return res.status(403).json({
        code: "notFeedbackAuthor",
        message: texts.notFeedbackAuthor,
      });
    }

    entry.message = message;
    await notification.save();

    const populated = await populateNotification(
      Notification.findById(notification._id)
    );

    res.json({
      notification: populated,
      code: "feedbackUpdated",
      message: texts.feedbackUpdated,
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /notifications/:id/feedback/:feedbackId — author or admin
const deleteFeedback = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({
        code: "notificationNotFound",
        message: texts.notificationNotFound,
      });
    }

    const entry = notification.feedback.id(req.params.feedbackId);
    if (!entry) {
      return res.status(404).json({
        code: "feedbackNotFound",
        message: texts.feedbackNotFound,
      });
    }

    const isAuthor = String(entry.author) === String(req.user._id);
    const isAdmin = req.user.role === "admin";
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        code: "notFeedbackAuthor",
        message: texts.notFeedbackAuthor,
      });
    }

    entry.deleteOne();
    await notification.save();

    res.json({
      code: "feedbackDeleted",
      message: texts.feedbackDeleted,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getNotification,
  updateStatus,
  deleteNotification,
  addFeedback,
  updateFeedback,
  deleteFeedback,
};
