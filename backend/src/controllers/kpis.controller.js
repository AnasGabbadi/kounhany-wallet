const kpisService = require('../services/kpis.service');
const pool = require('../config/db');
const redis = require('../config/redis');
const blnkService = require('../services/blnk.service');

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
            const limit = Math.min(parseInt(req.query.limit) || 10, 1000);
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

    async getAllBalances(req, res, next) {
        try {
            const cacheKey = 'kpis:all-balances';
            const cached = await redis.get(cacheKey);
            if (cached) return res.json({ success: true, data: JSON.parse(cached) });

            const result = await pool.query(`
      SELECT 
        c.client_id,
        cw.available_balance_id,
        cw.blocked_balance_id,
        cw.receivable_balance_id
      FROM clients c
      JOIN client_wallets cw ON c.client_id = cw.client_id
      WHERE c.active = true
    `);

            const balances = await Promise.all(result.rows.map(async (row) => {
                try {
                    const [avail, blocked, recv] = await Promise.all([
                        blnkService.getBalance(row.available_balance_id),
                        blnkService.getBalance(row.blocked_balance_id),
                        blnkService.getBalance(row.receivable_balance_id),
                    ]);
                    return {
                        client_id: row.client_id,
                        available: avail.balance / 10000,
                        blocked: blocked.balance / 10000,
                        receivable: recv.balance / 10000,
                    };
                } catch {
                    return { client_id: row.client_id, available: 0, blocked: 0, receivable: 0 };
                }
            }));

            await redis.setEx(cacheKey, 300, JSON.stringify(balances));
            res.json({ success: true, data: balances });
        } catch (err) { next(err); }
    },
};

module.exports = kpisController;