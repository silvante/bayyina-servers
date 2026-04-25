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
      type: {
        days: [
          {
            type: String,
            enum: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
          },
        ],
        time: { type: String, required: true },
      },
      required: true,
    },
    room: { type: String },
    salaryType: {
      type: String,
      enum: ["percentage", "per_student", "fixed"],
      default: "percentage",
    },
    salaryValue: { type: Number, default: 30 },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

Group.post("findOneAndDelete", async function (doc) {
  if (doc) {
    const Enrollment = require("./Enrollment");
    const Attendance = require("./Attendance");
    await Promise.all([
      Enrollment.deleteMany({ group: doc._id }),
      Attendance.deleteMany({ group: doc._id }),
    ]);
  }
});

module.exports = mongoose.model("Group", Group);
