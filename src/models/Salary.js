const mongoose = require("mongoose");

const SalaryGroupBreakdown = new mongoose.Schema(
  {
    group: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
    groupName: { type: String },
    salaryType: {
      type: String,
      enum: ["percentage", "per_student", "fixed"],
    },
    salaryValue: { type: Number, default: 0 },
    studentCount: { type: Number, default: 0 },
    paidStudentsCount: { type: Number, default: 0 },
    groupRevenue: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false },
);

const Salary = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    month: { type: Date, required: true },
    groups: { type: [SalaryGroupBreakdown], default: [] },
    totalAmount: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    deduction: { type: Number, default: 0 },
    netAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    paidAt: { type: Date },
    note: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

Salary.index({ teacher: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Salary", Salary);
