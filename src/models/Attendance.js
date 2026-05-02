const mongoose = require("mongoose");

const Attendance = new mongoose.Schema(
  {
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["present", "absent"],
      required: true,
    },
    grade: {
      type: Number,
      enum: [null, 2, 3, 4, 5],
      default: null,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: { type: String },
  },
  { timestamps: true },
);

Attendance.index({ enrollment: 1, date: 1 }, { unique: true });
Attendance.index({ group: 1, date: 1 });
Attendance.index({ student: 1, date: -1 });

module.exports = mongoose.model("Attendance", Attendance);
