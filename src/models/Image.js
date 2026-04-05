const mongoose = require("mongoose");

const Image = new mongoose.Schema(
  {
    name: { type: String, required: true },
    original: {
      url: { type: String, required: true },
      size: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number, required: true },
    },
    sizes: {
      small: {
        url: { type: String, required: true },
        size: { type: Number, required: true },
        name: { type: String, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
      },
      medium: {
        url: { type: String, required: true },
        size: { type: Number, required: true },
        name: { type: String, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
      },
      large: {
        url: { type: String, required: true },
        size: { type: Number, required: true },
        name: { type: String, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
      },
    },
    createdBy: {
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Image", Image);
