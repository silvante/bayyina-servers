/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

const Lead          = require("./src/models/Lead");
const LeadSource    = require("./src/models/LeadSource");
const RejectionReason = require("./src/models/RejectionReason");
const CourseType    = require("./src/models/CourseType");
const User          = require("./src/models/User");

const TOTAL_LEADS = 400;
const MONTHS_BACK = 8;

const FIRST_NAMES = [
  "Ali","Bekzod","Dilshod","Eldor","Fazliddin","Hasan","Ibrohim","Jasur","Kamol",
  "Murod","Nodir","Otabek","Rustam","Sardor","Temur","Umid","Yusuf","Zafar",
  "Aziza","Barno","Charos","Dilfuza","Elnura","Feruza","Gulnora","Hilola",
  "Iroda","Jamila","Kamola","Laylo","Madina","Nilufar","Oynura","Parvina",
  "Rayhona","Sevara","Tursunoy","Umida","Yulduz","Zuhra","Maftuna","Nargiza",
  "Shahzoda","Zarina","Mohira","Sabina","Munira","Sarvinoz","Gulbahor","Malika",
  "Davron","Sanjar","Sherzod","Bahodir","Muzaffar","Asror","Hamid","Farhod",
];

const INTERESTS = [
  "Tajwid darslari","Arab tili o'rganish","Qur'on o'qishni o'rganish",
  "Aqida asoslarini o'rganish","Hadis ilmi","Fiqh darslari",
  "Bolam uchun qur'on darslari","Tajwid kursiga yozilmoqchi",
  "Arab tili B1 darajasiga qadar o'rganmoqchi","Onlayn darslar bormi?",
];

const NOTES = [
  "Qiziqishi yuqori","Ertaga qayta qo'ng'iroq qilish kerak",
  "Narx haqida so'radi","Vaqti cheklangan, kechki guruh izlaydi",
  "Bola uchun soraydi","Juda qiziqyapti, demo darsga taklif etildi",
  "Telegram orqali keldi","Do'sti tavsiya etdi","Avval ham murojaat qilgan",
  null, null, null,
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function randomDate(startMs, endMs) {
  return new Date(startMs + Math.random() * (endMs - startMs));
}

// Realistic status distribution:
// new 15%, contacted 20%, interested 18%, scheduled 12%, converted 22%, rejected 13%
function pickStatus() {
  const r = Math.random();
  if (r < 0.15) return "new";
  if (r < 0.35) return "contacted";
  if (r < 0.53) return "interested";
  if (r < 0.65) return "scheduled";
  if (r < 0.87) return "converted";
  return "rejected";
}

// More leads in recent months (realistic growth)
function monthWeight(monthsAgo) {
  // exponential growth: recent months have more leads
  return Math.pow(1.15, MONTHS_BACK - monthsAgo);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("Ulandi ✅");

  const [sources, reasons, courses, managers] = await Promise.all([
    LeadSource.find().lean(),
    RejectionReason.find().lean(),
    CourseType.find().lean(),
    User.find({ role: { $in: ["admin", "teacher"] } }).select("_id").lean(),
  ]);

  // Delete existing leads
  await Lead.deleteMany({});
  console.log("Eski leadlar o'chirildi");

  const now = new Date();
  const startMs = new Date(now.getFullYear(), now.getMonth() - MONTHS_BACK, 1).getTime();
  const endMs   = now.getTime();

  // Build weighted month buckets
  const totalWeight = Array.from({ length: MONTHS_BACK + 1 }, (_, i) => monthWeight(i)).reduce((a, b) => a + b, 0);

  const leads = [];
  let phoneBase = 998900010000;

  for (let i = 0; i < TOTAL_LEADS; i++) {
    // Pick a month bucket weighted toward recent
    let monthsAgo = 0;
    const r = Math.random() * totalWeight;
    let cum = 0;
    for (let m = MONTHS_BACK; m >= 0; m--) {
      cum += monthWeight(m);
      if (r <= cum) { monthsAgo = m; break; }
    }

    const bucketStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1).getTime();
    const bucketEnd   = monthsAgo === 0
      ? endMs
      : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0).getTime();

    const createdAt = randomDate(bucketStart, bucketEnd);
    const status    = pickStatus();

    // lastActivityAt: 1-14 days after creation, not in future
    const activityOffset = randInt(1, 14) * 86400000;
    const lastActivityAt = new Date(Math.min(createdAt.getTime() + activityOffset, now.getTime()));

    const scheduledAt = status === "scheduled"
      ? randomDate(createdAt.getTime(), now.getTime())
      : undefined;

    const rejectionReason = status === "rejected" && reasons.length
      ? rand(reasons)._id
      : undefined;

    const paymentStatus = status === "converted"
      ? rand(["unpaid", "partial", "paid"])
      : "unpaid";

    const gender = Math.random() > 0.45 ? "male" : "female";

    leads.push({
      firstName:       rand(FIRST_NAMES),
      phone:           phoneBase + i,
      gender,
      age:             randInt(14, 55),
      source:          sources.length ? rand(sources)._id : undefined,
      interest:        rand(INTERESTS),
      courseType:      courses.length ? rand(courses)._id : undefined,
      level:           rand(["Boshlang'ich", "O'rta", "Yuqori"]),
      status,
      rejectionReason,
      paymentStatus,
      scheduledAt,
      lastActivityAt,
      notes:           rand(NOTES),
      createdBy:       managers.length ? rand(managers)._id : undefined,
      uniqueLink:      `BAY-SEED-${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`,
      createdAt,
      updatedAt:       lastActivityAt,
    });
  }

  // Bulk insert in chunks
  const CHUNK = 100;
  let inserted = 0;
  for (let i = 0; i < leads.length; i += CHUNK) {
    await Lead.insertMany(leads.slice(i, i + CHUNK), { ordered: false }).catch(() => {});
    inserted += Math.min(CHUNK, leads.length - i);
  }

  // Print summary
  const byStatus = await Lead.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log(`\n✅ ${inserted} lead yaratildi\n`);
  console.log("Holat bo'yicha:");
  byStatus.forEach(({ _id, count }) => console.log(`  ${_id}: ${count}`));

  await mongoose.disconnect();
  console.log("\nTayyor 🎉");
})();
