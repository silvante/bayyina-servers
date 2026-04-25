const mongoose = require("mongoose");

const EVENT_TYPES = [
  // Users
  "USER_STUDENT_CREATED",
  "USER_TEACHER_CREATED",
  "USER_ADMIN_CREATED",
  "USER_UPDATED",
  "USER_DELETED",

  // Leads
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "LEAD_STATUS_CHANGED",
  "LEAD_DELETED",
  "LEAD_LINK_CLICKED",

  // Enrollments
  "ENROLLMENT_CREATED",
  "ENROLLMENT_UPDATED",
  "ENROLLMENT_COMPLETED",
  "ENROLLMENT_DROPPED",
  "ENROLLMENT_DELETED",

  // Groups
  "GROUP_CREATED",
  "GROUP_UPDATED",
  "GROUP_DELETED",

  // Payments
  "PAYMENT_CREATED",
  "PAYMENT_PAID",
  "PAYMENT_OVERDUE",
  "PAYMENT_UPDATED",
  "PAYMENT_DELETED",

  // Attendance
  "ATTENDANCE_MARKED",
  "ATTENDANCE_UPDATED",
  "ATTENDANCE_DELETED",

  // Salaries
  "SALARY_CREATED",
  "SALARY_UPDATED",
  "SALARY_PAID",
  "SALARY_DELETED",
];

const ENTITY_TYPES = [
  "Lead",
  "User",
  "Enrollment",
  "Group",
  "Payment",
  "Attendance",
  "Salary",
  "System",
];

const Record = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, enum: EVENT_TYPES, index: true },
    entityType: { type: String, required: true, enum: ENTITY_TYPES },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, required: true },
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      role: { type: String, enum: ["admin", "teacher", "student", "system"], required: true },
      name: { type: String, required: true },
    },
    refs: {
      leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
      enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Enrollment" },
      paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
      attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance" },
      salaryId: { type: mongoose.Schema.Types.ObjectId, ref: "Salary" },
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed },
      after: { type: mongoose.Schema.Types.Mixed },
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

Record.index({ createdAt: -1 });
Record.index({ entityType: 1, entityId: 1, createdAt: -1 });
Record.index({ "actor.userId": 1, createdAt: -1 });
Record.index({ "refs.leadId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.studentId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.teacherId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.groupId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.enrollmentId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.paymentId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.attendanceId": 1, createdAt: -1 }, { sparse: true });
Record.index({ "refs.salaryId": 1, createdAt: -1 }, { sparse: true });

module.exports = mongoose.model("Record", Record);
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.ENTITY_TYPES = ENTITY_TYPES;
