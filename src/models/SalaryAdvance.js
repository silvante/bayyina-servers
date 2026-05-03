const mongoose = require("mongoose");

// type='advance'  → admin gives 1-2 future months salary upfront
// type='partial'  → teacher requests early withdrawal from current/upcoming salary
const SalaryAdvance = new mongoose.Schema(
  {
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type:    { type: String, enum: ["advance", "partial"], default: "advance" },
    months:  { type: Number, default: 1 }, // how many months advance covers (advance type)
    amount:  { type: Number, required: true, min: 1 },
    note:    { type: String },
    date:    { type: Date, required: true },
    status:  { type: String, enum: ["pending", "confirmed", "settled"], default: "pending" },
    teacherName: { type: String },
    // months this advance covers (first-day-of-month dates, advance type)
    coveredMonths: [{ type: Date }],
    // for partial type: which salary month this is drawn from
    salaryMonth: { type: Date },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedAt: { type: Date },
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

SalaryAdvance.index({ teacher: 1, status: 1 });

module.exports = mongoose.model("SalaryAdvance", SalaryAdvance);
