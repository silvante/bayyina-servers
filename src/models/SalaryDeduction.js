const mongoose = require("mongoose");

const SalaryDeduction = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount:  { type: Number, required: true, min: 1 },
    reason:  { type: String, required: true },
    date:    { type: Date, required: true },
    month:   { type: Date, required: true }, // first day of the month to deduct from
    status:  { type: String, enum: ["pending", "confirmed"], default: "pending" },
    teacherName: { type: String },
    salary:  { type: mongoose.Schema.Types.ObjectId, ref: "Salary" },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

SalaryDeduction.index({ teacher: 1, month: 1 });

module.exports = mongoose.model("SalaryDeduction", SalaryDeduction);
