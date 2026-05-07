const pool = require('../config/db');
const blnkService = require('./blnk.service');
const redis = require('../config/redis');

const CACHE_TTL = 30;

const kpisService = {

    async getOverview(period = 'all') {
        const dateFilter = this._getDateFilter(period);

        const [txStats, clientStats, wallets] = await Promise.all([
            pool.query(`
                SELECT
                    COUNT(*) as total_transactions,
                    COUNT(CASE WHEN type = 'PAYMENT' THEN 1 END) as total_payments,
                    COUNT(CASE WHEN type = 'BLOCK' THEN 1 END) as total_blocks,
                    COUNT(CASE WHEN type = 'CONFIRM' THEN 1 END) as total_confirms,
                    COUNT(CASE WHEN type = 'EXTERNAL_DEBT' THEN 1 END) as total_debts,
                    COUNT(CASE WHEN type = 'EXTERNAL_PAYMENT' THEN 1 END) as total_ext_payments,
                    COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as total_errors,
                    COALESCE(SUM(CASE WHEN type = 'PAYMENT' THEN amount::numeric ELSE 0 END), 0) as volume_payments,
                    COALESCE(SUM(CASE WHEN type = 'BLOCK' THEN amount::numeric ELSE 0 END), 0) as volume_blocks,
                    COALESCE(SUM(CASE WHEN type = 'CONFIRM' THEN amount::numeric ELSE 0 END), 0) as volume_confirms,
                    COALESCE(SUM(CASE WHEN type = 'EXTERNAL_DEBT' THEN amount::numeric ELSE 0 END), 0) as volume_debts,
                    COALESCE(SUM(amount::numeric), 0) as volume_total
                FROM transaction_logs
                ${dateFilter}
            `),
            pool.query(`
                SELECT
                    COUNT(*) as total_clients,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
                    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month
                FROM clients
            `),
            pool.query(`
                SELECT available_balance_id, blocked_balance_id, receivable_balance_id
                FROM client_wallets
            `),
        ]);

        // Soldes Blnk — cache Redis 30s (368 wallets × 3 = 1104 appels sans cache)
        let totalAvailable = 0, totalBlocked = 0, totalReceivable = 0;

        const cacheKey = 'kpis:balances';
        const cached = await redis.get(cacheKey);

        if (cached) {
            ({ totalAvailable, totalBlocked, totalReceivable } = JSON.parse(cached));
        } else {
            await Promise.all(wallets.rows.map(async (w) => {
                try {
                    const [avail, blocked, recv] = await Promise.all([
                        blnkService.getBalance(w.available_balance_id),
                        blnkService.getBalance(w.blocked_balance_id),
                        blnkService.getBalance(w.receivable_balance_id),
                    ]);
                    totalAvailable += avail.balance / 10000;
                    totalBlocked += blocked.balance / 10000;
                    totalReceivable += recv.balance / 10000;
                } catch (e) { }
            }));

            await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({
                totalAvailable, totalBlocked, totalReceivable,
            }));
        }

        const tx = txStats.rows[0];
        const cl = clientStats.rows[0];
        const successRate = tx.total_transactions > 0
            ? ((tx.total_transactions - tx.total_errors) / tx.total_transactions * 100).toFixed(1)
            : 100;

        return {
            period,
            clients: {
                total: parseInt(cl.total_clients),
                new_this_week: parseInt(cl.new_this_week),
                new_this_month: parseInt(cl.new_this_month),
            },
            balances: {
                available: totalAvailable,
                blocked: totalBlocked,
                receivable: totalReceivable,
                total_encours: totalBlocked + totalReceivable,
                total_assets: totalAvailable + totalBlocked + totalReceivable,
            },
            transactions: {
                total: parseInt(tx.total_transactions),
                payments: parseInt(tx.total_payments),
                blocks: parseInt(tx.total_blocks),
                confirms: parseInt(tx.total_confirms),
                debts: parseInt(tx.total_debts),
                errors: parseInt(tx.total_errors),
                success_rate: parseFloat(successRate),
            },
            volumes: {
                payments: parseFloat(tx.volume_payments),
                blocks: parseFloat(tx.volume_blocks),
                confirms: parseFloat(tx.volume_confirms),
                debts: parseFloat(tx.volume_debts),
                total: parseFloat(tx.volume_total),
            },
        };
    },

    async getTransactionsTrend(days = 7) {
        const result = await pool.query(`
            SELECT
                DATE(created_at) as date,
                COUNT(*) as total,
                COUNT(CASE WHEN type = 'PAYMENT' THEN 1 END) as payments,
                COUNT(CASE WHEN type = 'BLOCK' THEN 1 END) as blocks,
                COUNT(CASE WHEN type = 'CONFIRM' THEN 1 END) as confirms,
                COUNT(CASE WHEN type = 'EXTERNAL_DEBT' THEN 1 END) as debts,
                COALESCE(SUM(amount::numeric), 0) as volume
            FROM transaction_logs
            WHERE created_at >= NOW() - INTERVAL '${days} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);
        return result.rows.map((r) => ({
            date: r.date,
            total: parseInt(r.total),
            payments: parseInt(r.payments),
            blocks: parseInt(r.blocks),
            confirms: parseInt(r.confirms),
            debts: parseInt(r.debts),
            volume: parseFloat(r.volume),
        }));
    },

    async getTopClients() {
        const result = await pool.query(`
            SELECT
                c.client_id, c.name, c.email,
                COUNT(tl.id) as total_transactions,
                COALESCE(SUM(tl.amount), 0) as total_volume,
                COALESCE(SUM(CASE WHEN tl.type = 'PAYMENT' THEN tl.amount ELSE 0 END), 0) as total_recharged,
                COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_DEBT' THEN tl.amount ELSE 0 END), 0) as total_debt,
                COUNT(CASE WHEN tl.status = 'ERROR' THEN 1 END) as total_errors,
                MAX(tl.created_at) as last_activity
            FROM clients c
            LEFT JOIN transaction_logs tl ON c.client_id = tl.client_id
            GROUP BY c.client_id, c.name, c.email
            ORDER BY total_volume DESC
            LIMIT 10
        `);
        return result.rows.map((r) => ({
            client_id: r.client_id,
            name: r.name,
            email: r.email,
            total_transactions: parseInt(r.total_transactions),
            total_volume: parseFloat(r.total_volume),
            total_recharged: parseFloat(r.total_recharged),
            total_debt: parseFloat(r.total_debt),
            total_errors: parseInt(r.total_errors),
            last_activity: r.last_activity,
        }));
    },

    async getAlerts() {
        const alerts = [];

        const [errorsResult, debtsResult, zeroBalanceResult, inactivityResult] = await Promise.all([
            pool.query(`
                SELECT client_id, COUNT(*) as error_count
                FROM transaction_logs
                WHERE status = 'ERROR' AND created_at >= NOW() - INTERVAL '24 hours'
                GROUP BY client_id HAVING COUNT(*) > 0
            `),
            pool.query(`
                SELECT c.client_id, c.name,
                    COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_DEBT' THEN tl.amount::numeric ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_PAYMENT' THEN tl.amount::numeric ELSE 0 END), 0) as net_debt
                FROM clients c
                LEFT JOIN transaction_logs tl ON c.client_id = tl.client_id
                GROUP BY c.client_id, c.name
                HAVING (
                    COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_DEBT' THEN tl.amount::numeric ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_PAYMENT' THEN tl.amount::numeric ELSE 0 END), 0)
                ) > 1000
            `),
            pool.query(`
                SELECT c.client_id, c.name, cw.available_balance_id,
                    COALESCE(SUM(CASE WHEN tl.type = 'BLOCK' THEN tl.amount::numeric ELSE 0 END), 0) as total_blocked
                FROM clients c
                JOIN client_wallets cw ON c.client_id = cw.client_id
                LEFT JOIN transaction_logs tl ON c.client_id = tl.client_id
                GROUP BY c.client_id, c.name, cw.available_balance_id
                HAVING COALESCE(SUM(CASE WHEN tl.type = 'BLOCK' THEN tl.amount::numeric ELSE 0 END), 0) > 0
            `),
            pool.query(`
                SELECT COUNT(*) as recent_tx
                FROM transaction_logs
                WHERE created_at >= NOW() - INTERVAL '24 hours'
            `),
        ]);

        errorsResult.rows.forEach((r) => {
            alerts.push({
                category: 'financial', type: 'error', severity: 'high',
                message: `${r.error_count} erreur(s) de transaction pour le client ${r.client_id}`,
                client_id: r.client_id, created_at: new Date(),
            });
        });

        debtsResult.rows.forEach((r) => {
            alerts.push({
                category: 'financial', type: 'warning', severity: 'medium',
                message: `Dette nette élevée de ${parseFloat(r.net_debt).toLocaleString('fr-FR')} MAD pour ${r.name}`,
                client_id: r.client_id, created_at: new Date(),
            });
        });

        await Promise.all(zeroBalanceResult.rows.map(async (r) => {
            try {
                const balance = await this._getBlnkBalance(r.available_balance_id);
                if (balance === 0 && parseFloat(r.total_blocked) > 0) {
                    alerts.push({
                        category: 'financial', type: 'warning', severity: 'medium',
                        message: `Solde disponible à zéro avec ${parseFloat(r.total_blocked).toLocaleString('fr-FR')} MAD bloqué pour ${r.name}`,
                        client_id: r.client_id, created_at: new Date(),
                    });
                }
            } catch { }
        }));

        if (parseInt(inactivityResult.rows[0].recent_tx) === 0) {
            alerts.push({
                category: 'financial', type: 'info', severity: 'low',
                message: 'Aucune transaction enregistrée dans les dernières 24 heures',
                client_id: null, created_at: new Date(),
            });
        }

        const [blnkHealth, dbHealth, errorRateResult] = await Promise.all([
            this._checkService(`${process.env.BLNK_URL || 'http://blnk:5001'}/health`),
            this._checkDatabase(),
            pool.query(`
                SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as errors
                FROM transaction_logs WHERE created_at >= NOW() - INTERVAL '1 hour'
            `),
        ]);

        if (blnkHealth.status !== 'OK') alerts.push({
            category: 'system', type: 'error', severity: 'high',
            message: 'Blnk Ledger inaccessible — les transactions sont bloquées',
            client_id: null, created_at: new Date(),
        });

        if (dbHealth.status !== 'OK') alerts.push({
            category: 'system', type: 'error', severity: 'high',
            message: 'PostgreSQL inaccessible — perte de données possible',
            client_id: null, created_at: new Date(),
        });

        const total = parseInt(errorRateResult.rows[0].total);
        const errors = parseInt(errorRateResult.rows[0].errors);
        if (total > 0 && (errors / total) > 0.1) {
            alerts.push({
                category: 'system', type: 'warning', severity: 'high',
                message: `Taux d'erreur élevé : ${((errors / total) * 100).toFixed(0)}% sur la dernière heure (${errors}/${total})`,
                client_id: null, created_at: new Date(),
            });
        }

        return alerts;
    },

    async _getBlnkBalance(balanceId) {
        try {
            const balance = await blnkService.getBalance(balanceId);
            return balance.balance / 10000;
        } catch { return 0; }
    },

    _getDateFilter(period) {
        switch (period) {
            case 'today': return `WHERE DATE(created_at) = CURRENT_DATE`;
            case 'week': return `WHERE created_at >= NOW() - INTERVAL '7 days'`;
            case 'month': return `WHERE created_at >= NOW() - INTERVAL '30 days'`;
            default: return '';
        }
    },

    async _checkService(url) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
            return { status: res.ok ? 'OK' : 'ERROR' };
        } catch { return { status: 'ERROR' }; }
    },

    async _checkDatabase() {
        try {
            await pool.query('SELECT 1');
            return { status: 'OK' };
        } catch (err) {
            console.error('[DB Health Check]', err.message);
            return { status: 'ERROR' };
        }
    },
};

module.exports = kpisService;