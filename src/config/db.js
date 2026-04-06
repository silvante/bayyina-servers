const mongoose = require("mongoose");
const User = require("../models/User");

const MONGODB_URL = process.env.MONGODB_URL;
const ADMIN_PHONE = process.env.ADMIN_PHONE;

const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log("MongoDB ulandi! ✅");

    const admin = await User.findOne({ role: "admin" });

    if (!admin) {
      await User.create({
        role: "admin",
        firstName: "Admin",
        phone: Number(ADMIN_PHONE),
        password: "admin1234",
      });
      console.log("Admin muvaffaqiyatli yaratildi! ✅");
    }
  } catch (err) {
    console.error("MongoDB ulanmadi ❌", err);
    process.exit(1);
  }
};

module.exports = connectDB;
