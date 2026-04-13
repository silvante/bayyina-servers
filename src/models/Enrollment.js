const mongoose = require("mongoose");

const Enrollment = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    status: {
      type: String,
      default: "active",
      enum: ["active", "completed", "dropped"],
    },
    enrolledAt: { type: Date, default: Date.now },
    discount: { type: Number, default: 0 },
    discountReason: { type: String },
    paymentDay: { type: Number, min: 1, max: 31 },
    lastPaymentDate: { type: Date },
    nextPaymentDate: { type: Date },
    debt: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

Enrollment.post("findOneAndDelete", async function (doc) {
  if (doc) {
    const Attendance = require("./Attendance");
    await Attendance.deleteMany({ enrollment: doc._id });
  }
});

module.exports = mongoose.model("Enrollment", Enrollment);

// Agar Pul guruh oylik toloviga teng bolsa => NextPaymentDay ozgaradi, debt: 0, balance: 0
// Agar Pul guruh oylik tolovidan kam bolsa => NextPaymentDay ozgarmaydi, debt: qarz miqdoriga, balance: 0
// Agar Pul Guruh oylik tolovidan Kop bolsa => NextPaymentDay ozgaradi, debt: 0, balance: qolgan pulga teng boladi

// Agar o'quvchida avvalgi Balans bo'lsa va Balans + Pul = Oylik tolov bolsa => NextPaymentDate ozgaradi, debt: 0, balance: 0
// Agar o'quvchida avvalgi Balans bo'lsa va Balans + Pul < Oylik tolov bolsa => NextPaymentDate ozgarmaydi, debt: yetishmagan miqdor, balance: 0
// Agar o'quvchida avvalgi Balans bo'lsa va Balans + Pul > Oylik tolov bolsa => NextPaymentDate ozgaradi, debt: 0, balance: ortiqcha miqdor

// Agar o'quvchida Chegirma bo'lsa => Samarali Oylik tolov = Guruh narxi - Chegirma; qolgan qoidalar shu samarali tolovga nisbatan qollanadi
// Agar Enrollment holati "active" bolmasa (dropped yoki completed) => Tolov rad etiladi
// Agar shu Oy uchun Tolov allaqachon amalga oshirilgan bolsa => Takroriy tolov rad etiladi