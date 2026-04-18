const { getAgenda } = require("../config/agenda");
const Payment = require("../models/Payment");
const recordService = require("../services/recordService");

const loadPaymentJobs = () => {
  const agenda = getAgenda();

  // Mark pending payments as overdue if their month has passed
  agenda.define("mark-overdue-payments", async (job) => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const overdueCandidates = await Payment.find({
        status: "pending",
        month: { $lt: monthStart },
      }).select("_id student enrollment amount");

      const result = await Payment.updateMany(
        { _id: { $in: overdueCandidates.map((p) => p._id) } },
        { $set: { status: "overdue" } }
      );

      const populated = await Payment.find({ _id: { $in: overdueCandidates.map((p) => p._id) } })
        .populate({ path: "student", select: "firstName lastName" });

      const systemActor = recordService.systemActor("Tizim");
      for (const p of populated) {
        await recordService.createRecord({
          eventType: "PAYMENT_OVERDUE",
          entityType: "Payment",
          entityId: p._id,
          entity: p,
          actor: systemActor,
          refs: {
            studentId: p.student?._id || p.student,
            enrollmentId: p.enrollment,
            paymentId: p._id,
          },
          metadata: { student: p.student },
        });
      }

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
};

module.exports = { loadPaymentJobs };
