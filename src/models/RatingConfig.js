const mongoose = require("mongoose");

const RatingConfigSchema = new mongoose.Schema(
  {
    lookbackDays: { type: Number, default: 30, min: 1 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RatingConfig", RatingConfigSchema);
