const mongoose = require("mongoose");

const User = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String },
    phone: { type: Number, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      default: "student",
      enum: ["admin", "teacher", "student"],
    },
    telegramId: { type: String, unique: true, sparse: true },
    gender: { type: String, enum: ["male", "female"] },
    age: { type: Number },
    source: { type: String },
  },
  { timestamps: true },
);


User.post("findOneAndDelete", async function (doc) {
  if (doc && doc.role === "student") {
    const Enrollment = require("./Enrollment");
    await Enrollment.deleteMany({ student: doc._id });
  }
});

User.methods.comparePassword = async function (password) {
  return password === this.password;
};

module.exports = mongoose.model("User", User);