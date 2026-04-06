const mongoose = require("mongoose");

const Group = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    schedule: {
      days: [{ type: String }], // e.g. ["Monday", "Wednesday", "Friday"]
      time: { type: String }, // e.g. "09:00"
    },
    room: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", Group);
