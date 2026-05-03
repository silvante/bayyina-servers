require("dotenv").config();
const mongoose = require("mongoose");

const SalaryDeduction = require("./src/models/SalaryDeduction");
const SalaryAdvance   = require("./src/models/SalaryAdvance");
const User            = require("./src/models/User");

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("MongoDB ulandi");

  // ── Deductions ──────────────────────────────────────────────────────────────
  const deductions = await SalaryDeduction.find({ teacherName: { $exists: false } })
    .select("_id teacher teacherName");

  let dUpdated = 0;
  for (const d of deductions) {
    if (!d.teacher) continue;
    const teacher = await User.findById(d.teacher).select("firstName lastName");
    if (!teacher) continue;
    const name = [teacher.firstName, teacher.lastName].filter(Boolean).join(" ");
    await SalaryDeduction.findByIdAndUpdate(d._id, { teacherName: name });
    dUpdated++;
  }
  console.log(`Deductions: ${dUpdated} ta yangilandi (${deductions.length} ta tekshirildi)`);

  // ── Advances ────────────────────────────────────────────────────────────────
  const advances = await SalaryAdvance.find({ teacherName: { $exists: false } })
    .select("_id teacher teacherName");

  let aUpdated = 0;
  for (const a of advances) {
    if (!a.teacher) continue;
    const teacher = await User.findById(a.teacher).select("firstName lastName");
    if (!teacher) continue;
    const name = [teacher.firstName, teacher.lastName].filter(Boolean).join(" ");
    await SalaryAdvance.findByIdAndUpdate(a._id, { teacherName: name });
    aUpdated++;
  }
  console.log(`Advances: ${aUpdated} ta yangilandi (${advances.length} ta tekshirildi)`);

  await mongoose.disconnect();
  console.log("Tugadi ✅");
}

run().catch((err) => { console.error(err); process.exit(1); });
