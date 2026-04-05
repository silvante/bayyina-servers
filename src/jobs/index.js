const { initAgenda } = require("../config/agenda");
const { loadPaymentJobs } = require("./paymentJobs");

const startAgenda = async () => {
  try {
    const agenda = initAgenda();

    loadPaymentJobs();
    console.log("Agenda job'lari yuklandi ✅");

    await agenda.start();
    console.log("Agenda muvaffaqiyatli ishga tushdi ✅");
  } catch (error) {
    console.error("Agenda'ni ishga tushirishda xatolik ❌", error);
    throw error;
  }
};

module.exports = { startAgenda };
