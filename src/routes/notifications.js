const express = require("express");
const router = express.Router();

const {
  createNotification,
  getNotifications,
  getNotification,
  updateStatus,
  deleteNotification,
  addFeedback,
  updateFeedback,
  deleteFeedback,
} = require("../controllers/notifications.controller");
const { auth, roleCheck } = require("../middlewares/auth");
const validateId = require("../middlewares/validateId");

/**
 * POST /notifications
 * Access: student only
 */
router.post("/", auth, roleCheck(["student"]), createNotification);

/**
 * GET /notifications
 * Access: admin (all), teacher (own groups), student (own notifications)
 */
router.get("/", auth, getNotifications);

/**
 * GET /notifications/:id
 * Access: admin, teacher (own group), student (own notification)
 */
router.get("/:id", auth, validateId("id"), getNotification);

/**
 * PATCH /notifications/:id/status
 * Access: admin, teacher (own group)
 */
router.patch(
  "/:id/status",
  auth,
  roleCheck(["admin", "teacher"]),
  validateId("id"),
  updateStatus
);

/**
 * DELETE /notifications/:id
 * Access: admin only
 */
router.delete(
  "/:id",
  auth,
  roleCheck(["admin"]),
  validateId("id"),
  deleteNotification
);

/**
 * POST /notifications/:id/feedback
 * Access: admin, teacher (own group)
 */
router.post(
  "/:id/feedback",
  auth,
  roleCheck(["admin", "teacher"]),
  validateId("id"),
  addFeedback
);

/**
 * PUT /notifications/:id/feedback/:feedbackId
 * Access: author of the feedback entry
 */
router.put(
  "/:id/feedback/:feedbackId",
  auth,
  validateId(["id", "feedbackId"]),
  updateFeedback
);

/**
 * DELETE /notifications/:id/feedback/:feedbackId
 * Access: author of the entry or admin
 */
router.delete(
  "/:id/feedback/:feedbackId",
  auth,
  validateId(["id", "feedbackId"]),
  deleteFeedback
);

module.exports = router;
