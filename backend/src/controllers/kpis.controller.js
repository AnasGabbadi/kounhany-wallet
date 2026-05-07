const kpisService = require('../services/kpis.service');
const pool = require('../config/db');

const kpisController = {
    async overview(req, res, next) {
        try {
            const { period = 'all' } = req.query;
            const result = await kpisService.getOverview(period);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async transactionsTrend(req, res, next) {
        try {
            const { days = 7 } = req.query;
            const result = await kpisService.getTransactionsTrend(parseInt(days));
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async topClients(req, res, next) {
        try {
            const result = await kpisService.getTopClients();
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async alerts(req, res, next) {
        try {
            const result = await kpisService.getAlerts();
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async getRecentTransactions(req, res, next) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const result = await pool.query(`
      SELECT 
        tl.*,
        c.name as client_name
      FROM transaction_logs tl
      LEFT JOIN clients c ON tl.client_id = c.client_id
      ORDER BY tl.created_at DESC
      LIMIT $1
    `, [limit]);

            res.json({
                success: true,
                data: result.rows,
            });
        } catch (err) { next(err); }
    },
};

module.exports = kpisController;