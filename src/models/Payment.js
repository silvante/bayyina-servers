const mongoose = require("mongoose");

const Payment = new mongoose.Schema(
  {
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true },
    month: { type: Date, required: true }, // which month this payment is for
    status: {
      type: String,
      default: "pending",
      enum: ["paid", "pending", "overdue"],
    },
    paidAt: { type: Date },
    note: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", Payment);
