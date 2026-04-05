const Agenda = require("agenda");
const mongoose = require("mongoose");

const agenda = new Agenda({
  mongo: mongoose.connection,
  db: { collection: "agendaJobs" },
  processEvery: "10 seconds",
  maxConcurrency: 20,
});

const graceful = () => {
  agenda.stop(() => {
    console.log("Agenda to'xtatildi");
    process.exit(0);
  });
};

process.on("SIGTERM", graceful);
process.on("SIGINT", graceful);

module.exports = agenda;
