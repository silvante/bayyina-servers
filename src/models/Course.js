const mongoose = require("mongoose");

const Course = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    duration: { type: Number }, // duration in months
    price: { type: Number, required: true },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Course", Course);
