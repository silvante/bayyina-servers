const Agenda = require("agenda");
const mongoose = require("mongoose");

let _agenda = null;

const initAgenda = () => {
  _agenda = new Agenda({
    mongo: mongoose.connection.db,
    db: { collection: "agendaJobs" },
    processEvery: "10 seconds",
    maxConcurrency: 20,
  });

  const graceful = () => {
    _agenda.stop(() => {
      console.log("Agenda to'xtatildi");
      process.exit(0);
    });
  };

  process.on("SIGTERM", graceful);
  process.on("SIGINT", graceful);

  return _agenda;
};

const getAgenda = () => _agenda;

module.exports = { initAgenda, getAgenda };
