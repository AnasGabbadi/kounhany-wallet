require('dotenv').config();
const app = require('./app');
const dolibarrSync = require('./services/dolibarr.sync');
const platformService = require('./services/platform.service');
const logistiqueBilling = require('./jobs/logistique.billing');
const billingScheduleService = require('./services/billing.schedule.service');
const pool = require('./config/db');
const { PERMISSION_DEFINITIONS } = require('./config/permissions');
const { refreshCache: refreshAuthentikCache } = require('./services/authentik.service');
const cron = require('node-cron');

const PORT = process.env.PORT || 3000;

async function seedManagerPermissions() {
  const count = await pool.query("SELECT COUNT(*) FROM role_permissions WHERE role = 'manager'");
  if (parseInt(count.rows[0].count) > 0) return;

  for (const perm of PERMISSION_DEFINITIONS) {
    await pool.query(
      `INSERT INTO role_permissions (role, permission_key, enabled)
       VALUES ('manager', $1, $2)
       ON CONFLICT (role, permission_key) DO NOTHING`,
      [perm.key, perm.default]
    );
  }
  console.log('[Permissions] Seed manager permissions OK');
}

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

  try { await seedManagerPermissions(); } catch (e) { console.error('[Permissions] Seed error:', e.message); }

  // Refresh cache Authentik toutes les 5 minutes
  cron.schedule('*/5 * * * *', () => {
    if (process.env.AUTHENTIK_ADMIN_TOKEN) refreshAuthentikCache();
  });

  setInterval(async () => {
    try {
      await billingScheduleService.runPending();
    } catch (err) {
      console.error('[BillingSchedule] Erreur runPending:', err.message);
    }
  }, 60 * 1000);
};

startServer();