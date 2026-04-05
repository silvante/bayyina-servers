const agenda = require("../config/agenda");
const Payment = require("../models/Payment");

// Mark pending payments as overdue if their month has passed
agenda.define("mark-overdue-payments", async (job) => {
  try {
    const now = new Date();

    const result = await Payment.updateMany(
      {
        status: "pending",
        month: { $lt: new Date(now.getFullYear(), now.getMonth(), 1) },
      },
      { $set: { status: "overdue" } }
    );

    console.log(`Overdue payments marked: ${result.modifiedCount}`);
  } catch (error) {
    console.error("mark-overdue-payments job error:", error);
    throw error;
  }
});

// Schedule to run daily at midnight
agenda.on("ready", async () => {
  await agenda.every("0 0 * * *", "mark-overdue-payments");
});
