const mongoose = require("mongoose");

const RatingConfigSchema = new mongoose.Schema(
  {
    attendedDayPoints: { type: Number, default: 10, min: 0 },
    starMultiplier:    { type: Number, default: 2,  min: 0 },
    lookbackDays:      { type: Number, default: 30, min: 1 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RatingConfig", RatingConfigSchema);
