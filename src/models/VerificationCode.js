const mongoose = require("mongoose");

const VerificationCode = new mongoose.Schema(
  {
    code: { type: Number, required: true },
    phone: { type: Number, required: true },
    isSent: { type: Boolean, required: true, default: false },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("VerificationCode", VerificationCode);
