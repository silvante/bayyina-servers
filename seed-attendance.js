/* eslint-disable no-console */
/**
 * seed-attendance.js
 *
 * Mavjud DB ga o'chirmay davomat + baho qo'shadi.
 * Faqat oxirgi WINDOW_DAYS kunning yo'q bo'lgan yozuvlarini yaratadi
 * (duplicate enrollment+date juftligi bo'lsa o'tkazib yuboradi).
 *
 * Ishlatish:
 *   node seed-attendance.js
 *   node seed-attendance.js --days=90       # necha kunlik oyna
 *   node seed-attendance.js --present=0.85  # davomat foizi
 *   node seed-attendance.js --clear         # avval mavjud davomatlarni o'chiradi
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Enrollment = require("./src/models/Enrollment");
const Group      = require("./src/models/Group");
const Attendance = require("./src/models/Attendance");
const User       = require("./src/models/User");

// ── CLI args ───────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const getArg    = (name, def) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=")[1] : def;
};
const WINDOW_DAYS   = parseInt(getArg("days", "90"), 10);
const PRESENT_RATE  = parseFloat(getArg("present", "0.85"));
const DO_CLEAR      = args.includes("--clear");
const CHUNK         = 2000;

// ── Helpers ────────────────────────────────────────────────────────────────────
function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function weekdayName(date) {
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][date.getUTCDay()];
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.MONGODB_URL;
  if (!url) { console.error("MONGODB_URL topilmadi"); process.exit(1); }

  console.log("MongoDB ga ulanmoqda...");
  await mongoose.connect(url);
  console.log("Ulandi ✅");

  if (DO_CLEAR) {
    const { deletedCount } = await Attendance.deleteMany({});
    console.log(`⚠️  ${deletedCount} ta davomat o'chirildi`);
  }

  // ── Load enrollments + groups ──────────────────────────────────────────────
  const enrollments = await Enrollment
    .find({ status: { $ne: "dropped" } })
    .select("_id student group enrolledAt status")
    .lean();

  const groupIds = [...new Set(enrollments.map((e) => String(e.group)))];
  const groupDocs = await Group
    .find({ _id: { $in: groupIds } })
    .select("_id teacher schedule")
    .lean();

  const groupMap = new Map(groupDocs.map((g) => [String(g._id), g]));

  // ── Existing attendance index (enrollment+date) to avoid duplicates ────────
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86400000);

  console.log(`Mavjud davomatlar indekslanmoqda (oxirgi ${WINDOW_DAYS} kun)...`);
  const existingCursor = Attendance.find({
    date: { $gte: windowStart },
  }).select("enrollment date").lean().cursor();

  const existingSet = new Set();
  for await (const doc of existingCursor) {
    const d = new Date(doc.date);
    const key = `${doc.enrollment}|${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    existingSet.add(key);
  }
  console.log(`  ${existingSet.size} ta mavjud yozuv topildi`);

  // ── Generate new attendance docs ───────────────────────────────────────────
  console.log("Yangi davomat yozuvlari tayyorlanmoqda...");
  const docs = [];
  let skipped = 0;

  for (const en of enrollments) {
    const group = groupMap.get(String(en.group));
    if (!group?.schedule?.days?.length) continue;

    const allowedDays = new Set(group.schedule.days);
    const enrolledMs  = new Date(en.enrolledAt).getTime();
    const startMs     = Math.max(enrolledMs, windowStart.getTime());
    const cursor      = new Date(Date.UTC(
      new Date(startMs).getUTCFullYear(),
      new Date(startMs).getUTCMonth(),
      new Date(startMs).getUTCDate(),
    ));
    const endCursor = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    ));

    while (cursor <= endCursor) {
      if (allowedDays.has(weekdayName(cursor))) {
        const key = `${en._id}|${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}-${cursor.getUTCDate()}`;
        if (existingSet.has(key)) {
          skipped++;
        } else {
          const present = Math.random() < PRESENT_RATE;
          // Grades: realistic distribution (3-5 stars, occasional 2)
          const grade = present
            ? pickWeighted([2, 3, 4, 5], [5, 20, 42, 33])
            : null;
          docs.push({
            enrollment: en._id,
            group:      en.group,
            student:    en.student,
            date:       new Date(cursor.getTime()),
            status:     present ? "present" : "absent",
            grade,
            markedBy:   group.teacher,
            ...(Math.random() < 0.04 && {
              note: present ? "Vaqtida keldi" : "Sababsiz kelmadi",
            }),
          });
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  console.log(`  ${docs.length} ta yangi yozuv, ${skipped} ta mavjud (o'tkazib yuborildi)`);

  if (docs.length === 0) {
    console.log("Qo'shish uchun yangi yozuv yo'q.");
    await mongoose.disconnect();
    return;
  }

  // ── Insert in chunks ───────────────────────────────────────────────────────
  console.log("Saqlanmoqda...");
  let inserted = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    try {
      const res = await Attendance.insertMany(docs.slice(i, i + CHUNK), { ordered: false });
      inserted += res.length;
    } catch (err) {
      // ordered:false — partial success
      if (err.insertedDocs) inserted += err.insertedDocs.length;
    }
    process.stdout.write(`\r  ${Math.min(i + CHUNK, docs.length)} / ${docs.length}`);
  }
  console.log();

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalAtt  = await Attendance.countDocuments();
  const presentN  = await Attendance.countDocuments({ status: "present" });
  const gradeStats = await Attendance.aggregate([
    { $match: { grade: { $ne: null } } },
    { $group: { _id: "$grade", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  console.log("\n═══════════════════════════════════════════");
  console.log("DAVOMAT SEED YAKUNLANDI ✅");
  console.log("═══════════════════════════════════════════");
  console.log(`Jami davomat yozuvlari : ${totalAtt}`);
  console.log(`  Keldi   : ${presentN}  (${((presentN/totalAtt)*100).toFixed(1)}%)`);
  console.log(`  Kelmadi : ${totalAtt - presentN}  (${(((totalAtt-presentN)/totalAtt)*100).toFixed(1)}%)`);
  console.log("Baho taqsimoti:");
  for (const { _id, count } of gradeStats) {
    console.log(`  ${_id} yulduz : ${count} ta`);
  }
  console.log("═══════════════════════════════════════════\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Xatolik:", err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
