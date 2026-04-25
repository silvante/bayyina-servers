/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const url = process.env.MONGODB_URL;
  if (!url) {
    console.error("MONGODB_URL .env faylida topilmadi!");
    process.exit(1);
  }

  console.log("MongoDB ga ulanmoqda...");
  await mongoose.connect(url);
  const dbName = mongoose.connection.name;
  console.log(`Ulandi ✅  (DB: ${dbName})`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  if (collections.length === 0) {
    console.log("Bazada hech qanday collection yo'q.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Topilgan collectionlar (${collections.length}):`);
  collections.forEach((c) => console.log(`  - ${c.name}`));

  console.log("\nButun bazani o'chirish boshlandi...");
  await mongoose.connection.dropDatabase();
  console.log(`✅ "${dbName}" bazasi to'liq o'chirildi.`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Bazani tozalashda xatolik:", err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
