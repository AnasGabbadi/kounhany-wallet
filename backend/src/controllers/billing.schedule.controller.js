const pool = require('../config/db');
const billingScheduleService = require('../services/billing.schedule.service');

const PERIOD_REGEX = /^\d{4}-\d{2}$/;

const list = async (req, res, next) => {
  try {
    const schedules = await billingScheduleService.list();
    res.json({ data: schedules });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { label, period, scheduled_at } = req.body;
    if (!label || !String(label).trim()) return res.status(400).json({ message: 'label requis' });
    if (!PERIOD_REGEX.test(period)) return res.status(400).json({ message: 'period invalide (format YYYY-MM attendu)' });
    if (!scheduled_at || isNaN(new Date(scheduled_at).getTime())) return res.status(400).json({ message: 'scheduled_at invalide' });

    const schedule = await billingScheduleService.create({
      label: String(label).trim(),
      period,
      scheduled_at: new Date(scheduled_at).toISOString(),
    });
    res.status(201).json({ data: schedule });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { label, period, scheduled_at } = req.body;
    if (!label || !String(label).trim()) return res.status(400).json({ message: 'label requis' });
    if (!PERIOD_REGEX.test(period)) return res.status(400).json({ message: 'period invalide (format YYYY-MM attendu)' });
    if (!scheduled_at || isNaN(new Date(scheduled_at).getTime())) return res.status(400).json({ message: 'scheduled_at invalide' });

    const schedule = await billingScheduleService.update(id, {
      label: String(label).trim(),
      period,
      scheduled_at: new Date(scheduled_at).toISOString(),
    });
    if (!schedule) return res.status(404).json({ message: 'Planification introuvable ou non modifiable (statut non PENDING)' });
    res.json({ data: schedule });
  } catch (err) {
    next(err);
  }
};

const deleteSchedule = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await billingScheduleService.delete(id);
    if (!deleted) return res.status(404).json({ message: 'Planification introuvable ou non supprimable (statut non PENDING)' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

const runNow = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await pool.query('SELECT * FROM billing_schedules WHERE id = $1', [id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Planification introuvable' });
    const schedule = result.rows[0];
    if (schedule.status === 'RUNNING') return res.status(409).json({ message: 'Exécution déjà en cours' });

    setImmediate(() => billingScheduleService.execute(schedule));
    res.json({ success: true, message: 'Exécution lancée' });
  } catch (err) {
    next(err);
  }
};

module.exports = { list, create, update, deleteSchedule, runNow };
