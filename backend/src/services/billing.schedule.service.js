const pool = require('../config/db');
const logistiqueBilling = require('../jobs/logistique.billing');

const billingScheduleService = {
  async list() {
    const result = await pool.query(
      'SELECT * FROM billing_schedules ORDER BY scheduled_at DESC'
    );
    return result.rows;
  },

  async create({ label, period, scheduled_at }) {
    const result = await pool.query(
      `INSERT INTO billing_schedules (label, period, scheduled_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [label, period, scheduled_at]
    );
    const schedule = result.rows[0];
    if (new Date(scheduled_at) <= new Date()) {
      setImmediate(() => billingScheduleService.execute(schedule));
    }
    return schedule;
  },

  async update(id, { label, period, scheduled_at }) {
    const result = await pool.query(
      `UPDATE billing_schedules
       SET label = $1, period = $2, scheduled_at = $3, updated_at = NOW()
       WHERE id = $4 AND status = 'PENDING'
       RETURNING *`,
      [label, period, scheduled_at, id]
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await pool.query(
      `DELETE FROM billing_schedules WHERE id = $1 AND status = 'PENDING' RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  },

  async runPending() {
    const result = await pool.query(
      `SELECT * FROM billing_schedules
       WHERE status = 'PENDING' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC`
    );
    if (result.rows.length === 0) return 0;
    console.log(`[BillingSchedule] ${result.rows.length} planification(s) à exécuter`);
    for (const schedule of result.rows) {
      await billingScheduleService.execute(schedule);
    }
    return result.rows.length;
  },

  async execute(schedule) {
    await pool.query(
      `UPDATE billing_schedules SET status = 'RUNNING', updated_at = NOW() WHERE id = $1`,
      [schedule.id]
    );
    console.log(`[BillingSchedule] Running schedule #${schedule.id} period=${schedule.period}`);
    try {
      await logistiqueBilling.runBilling(schedule.period);
      await pool.query(
        `UPDATE billing_schedules
         SET status = 'DONE', result_summary = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify({ period: schedule.period, executed_at: new Date().toISOString() }), schedule.id]
      );
      console.log(`[BillingSchedule] Done schedule #${schedule.id}`);
    } catch (err) {
      const errorMessage = (err.message || String(err)).slice(0, 500);
      await pool.query(
        `UPDATE billing_schedules
         SET status = 'ERROR', error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [errorMessage, schedule.id]
      );
      console.error(`[BillingSchedule] Error schedule #${schedule.id}: ${errorMessage}`);
    }
  },
};

module.exports = billingScheduleService;
