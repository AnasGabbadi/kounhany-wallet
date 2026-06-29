require('dotenv').config();
const app = require('./app');
const dolibarrSync = require('./services/dolibarr.sync');
const platformService = require('./services/platform.service');
const logistiqueBilling = require('./jobs/logistique.billing');
const billingScheduleService = require('./services/billing.schedule.service');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT} — mode: ${process.env.NODE_ENV}`);
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      console.log(`Swagger available at http://localhost:${PORT}/api-docs`);
    }
  });
  await platformService.init();
  await dolibarrSync.start();
  logistiqueBilling.start();

  setInterval(async () => {
    try {
      await billingScheduleService.runPending();
    } catch (err) {
      console.error('[BillingSchedule] Erreur runPending:', err.message);
    }
  }, 60 * 1000);
};

startServer();