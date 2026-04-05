const bcrypt = require("bcrypt");
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
    isActive: { type: Boolean, default: true },
    avatar: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
  },
  { timestamps: true }
);

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

User.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await hashPassword(this.password);
  next();
});

const updateHooks = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "findByIdAndUpdate",
];

updateHooks.forEach((hook) => {
  User.pre(hook, async function (next) {
    const update = this.getUpdate();
    if (update && update.password) {
      update.password = await hashPassword(update.password);
      this.setUpdate(update);
    }
    next();
  });
});

User.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", User);
