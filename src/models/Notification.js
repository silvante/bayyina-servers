const mongoose = require("mongoose");

const Feedback = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["teacher", "admin"],
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: { type: String, required: true, trim: true },
  },
  { timestamps: true, _id: true }
);

const Notification = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["complaint", "suggestion", "question", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved"],
      default: "open",
      index: true,
    },
    feedback: { type: [Feedback], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", Notification);
