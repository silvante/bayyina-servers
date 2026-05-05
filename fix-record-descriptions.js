require("dotenv").config();
const mongoose = require("mongoose");

const Record = require("./src/models/Record");
const SalaryDeduction = require("./src/models/SalaryDeduction");
const SalaryAdvance   = require("./src/models/SalaryAdvance");
const { formatters }  = require("./src/data/recordTexts");

const fmtAmount = (n) => {
  if (n == null) return "0";
  return Number(n).toLocaleString("uz-UZ");
};

async function run() {
  await mongoose.connect(process.env.MONGODB_URL);
  console.log("MongoDB ulandi");

  // ── Fix DEDUCTION_CONFIRMED records ───────────────────────────────────────
  const dedRecords = await Record.find({
    eventType: "DEDUCTION_CONFIRMED",
    $or: [
      { description: "DEDUCTION_CONFIRMED" },
      { description: { $exists: false } },
      { description: "" },
    ],
  });

  console.log(`DEDUCTION_CONFIRMED: ${dedRecords.length} ta tuzatish kerak`);

  let dFixed = 0;
  for (const rec of dedRecords) {
    const ded = await SalaryDeduction.findById(rec.entityId).select("teacherName amount");
    if (!ded) continue;
    const actor = rec.actor ?? { name: "Admin" };
    const desc = `${actor.name} ${ded.teacherName ?? "o'qituvchi"} uchun ${fmtAmount(ded.amount)} so'm ushlab qolishni tasdiqladi`;
    await Record.findByIdAndUpdate(rec._id, { description: desc });
    dFixed++;
  }
  console.log(`  → ${dFixed} ta tuzatildi`);

  // ── Fix ADVANCE_CONFIRMED records ─────────────────────────────────────────
  const advRecords = await Record.find({
    eventType: "ADVANCE_CONFIRMED",
    $or: [
      { description: "ADVANCE_CONFIRMED" },
      { description: { $exists: false } },
      { description: "" },
    ],
  });

  console.log(`ADVANCE_CONFIRMED: ${advRecords.length} ta tuzatish kerak`);

  let aFixed = 0;
  for (const rec of advRecords) {
    const adv = await SalaryAdvance.findById(rec.entityId).select("teacherName amount");
    if (!adv) continue;
    const actor = rec.actor ?? { name: "Admin" };
    const desc = `${actor.name} ${adv.teacherName ?? "o'qituvchi"} uchun ${fmtAmount(adv.amount)} so'm avansni tasdiqladi`;
    await Record.findByIdAndUpdate(rec._id, { description: desc });
    aFixed++;
  }
  console.log(`  → ${aFixed} ta tuzatildi`);

  await mongoose.disconnect();
  console.log("Tayyor ✅");
}

run().catch((err) => { console.error(err); process.exit(1); });
