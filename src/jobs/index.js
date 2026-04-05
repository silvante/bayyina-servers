const agenda = require("../config/agenda");

const loadJobs = () => {
  require("./paymentJobs");
  console.log("Agenda job'lari yuklandi ✅");
};

const startAgenda = async () => {
  try {
    loadJobs();
    await agenda.start();
    console.log("Agenda muvaffaqiyatli ishga tushdi ✅");
  } catch (error) {
    console.error("Agenda'ni ishga tushirishda xatolik ❌", error);
    throw error;
  }
};

module.exports = { loadJobs, startAgenda };
