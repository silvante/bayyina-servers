const Agenda = require("agenda");

let _agenda = null;

const initAgenda = () => {
  _agenda = new Agenda({
    db: {
      address: process.env.MONGODB_URL,
      collection: "agendaJobs",
    },
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
