const mongoose = require("mongoose");

const Lead = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    phone: { type: Number },
    telegramId: { type: String, unique: true, sparse: true },
    gender: { type: String, enum: ["male", "female"] },
    age: { type: Number, min: 1, max: 120 },
    profession: { type: String },
    source: {
      type: String,
      enum: ["telegram", "instagram", "referral", "offline", "other"],
      default: "other",
    },
    interest: { type: String },
    uniqueLink: { type: String, unique: true, index: true },
    linkClickedAt: { type: Date, default: null },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    level: { type: String },
    status: {
      type: String,
      enum: ["new", "contacted", "interested", "scheduled", "converted", "rejected"],
      default: "new",
    },
    rejectionReason: { type: String },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
    },
    scheduledAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now },
    notes: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

Lead.index({ status: 1, createdAt: -1 });
Lead.index({ source: 1 });

module.exports = mongoose.model("Lead", Lead);
