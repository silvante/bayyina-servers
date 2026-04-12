const mongoose = require("mongoose");

const Enrollment = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "completed", "dropped"],
    },
    enrolledAt: { type: Date, default: Date.now },
    discount: { type: Number, default: 0 },
    discountReason: { type: String },
    paymentDay: { type: Number, min: 1, max: 31 },
    lastPaymentDate: { type: Date },
    nextPaymentDate: { type: Date },
    debt: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Enrollment", Enrollment);
