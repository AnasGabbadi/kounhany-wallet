const pool = require('../config/db');
const blnkService = require('./blnk.service');

const kpisService = {

    async getOverview(period = 'all') {
        const dateFilter = this._getDateFilter(period);

        // Totaux transactions
        const txStats = await pool.query(`
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
        `);

        // Nombre de clients
        const clientStats = await pool.query(`
      SELECT
        COUNT(*) as total_clients,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month
      FROM clients
    `);

        // Soldes globaux depuis nos logs
        const balanceStats = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'PAYMENT' THEN amount
                         WHEN type IN ('BLOCK', 'CONFIRM', 'EXTERNAL_DEBT') THEN -amount
                         ELSE 0 END), 0) as net_flow
      FROM transaction_logs
      ${dateFilter}
    `);

        // Soldes réels depuis Blnk via client_wallets
        const wallets = await pool.query(`
      SELECT available_balance_id, blocked_balance_id, receivable_balance_id
      FROM client_wallets
    `);

        let totalAvailable = 0, totalBlocked = 0, totalReceivable = 0;

        await Promise.all(wallets.rows.map(async (w) => {
            try {
                const [avail, blocked, recv] = await Promise.all([
                    blnkService.getBalance(w.available_balance_id),
                    blnkService.getBalance(w.blocked_balance_id),
                    blnkService.getBalance(w.receivable_balance_id),
                ]);
                totalAvailable += avail.balance / 100;
                totalBlocked += blocked.balance / 100;
                totalReceivable += recv.balance / 100;
            } catch (e) { }
        }));

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
        c.client_id,
        c.name,
        c.email,
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

        // ── FINANCIER ─────────────────────────────────────────

        // Clients avec erreurs récentes
        const errorsResult = await pool.query(`
    SELECT client_id, COUNT(*) as error_count
    FROM transaction_logs
    WHERE status = 'ERROR' AND created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY client_id
    HAVING COUNT(*) > 0
  `);
        errorsResult.rows.forEach((r) => {
            alerts.push({
                category: 'financial',
                type: 'error',
                severity: 'high',
                message: `${r.error_count} erreur(s) de transaction pour le client ${r.client_id}`,
                client_id: r.client_id,
                created_at: new Date(),
            });
        });

        // Clients avec dettes élevées
        const debtsResult = await pool.query(`
    SELECT
      c.client_id, c.name,
      COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_DEBT' THEN tl.amount::numeric ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_PAYMENT' THEN tl.amount::numeric ELSE 0 END), 0) as net_debt
    FROM clients c
    LEFT JOIN transaction_logs tl ON c.client_id = tl.client_id
    GROUP BY c.client_id, c.name
    HAVING (
      COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_DEBT' THEN tl.amount::numeric ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN tl.type = 'EXTERNAL_PAYMENT' THEN tl.amount::numeric ELSE 0 END), 0)
    ) > 1000
  `);
        debtsResult.rows.forEach((r) => {
            alerts.push({
                category: 'financial',
                type: 'warning',
                severity: 'medium',
                message: `Dette nette élevée de ${parseFloat(r.net_debt).toLocaleString('fr-FR')} MAD pour ${r.name}`,
                client_id: r.client_id,
                created_at: new Date(),
            });
        });

        // Clients avec solde disponible à zéro mais encours actif
        const zeroBalanceResult = await pool.query(`
    SELECT c.client_id, c.name,
      COALESCE(SUM(CASE WHEN tl.type = 'BLOCK' THEN tl.amount::numeric ELSE 0 END), 0) as total_blocked
    FROM clients c
    LEFT JOIN transaction_logs tl ON c.client_id = tl.client_id
    GROUP BY c.client_id, c.name
    HAVING COALESCE(SUM(CASE WHEN tl.type = 'BLOCK' THEN tl.amount::numeric ELSE 0 END), 0) > 0
  `);
        for (const r of zeroBalanceResult.rows) {
            try {
                const wallet = await pool.query(
                    'SELECT available_balance_id FROM client_wallets WHERE client_id = $1',
                    [r.client_id]
                );
                if (wallet.rows.length > 0) {
                    const balance = await this._getBlnkBalance(wallet.rows[0].available_balance_id);
                    if (balance === 0 && parseFloat(r.total_blocked) > 0) {
                        alerts.push({
                            category: 'financial',
                            type: 'warning',
                            severity: 'medium',
                            message: `Solde disponible à zéro avec ${parseFloat(r.total_blocked).toLocaleString('fr-FR')} MAD bloqué pour ${r.name}`,
                            client_id: r.client_id,
                            created_at: new Date(),
                        });
                    }
                }
            } catch { }
        }

        // Inactivité 24h
        const inactivityResult = await pool.query(`
    SELECT COUNT(*) as recent_tx
    FROM transaction_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours'
  `);
        if (parseInt(inactivityResult.rows[0].recent_tx) === 0) {
            alerts.push({
                category: 'financial',
                type: 'info',
                severity: 'low',
                message: 'Aucune transaction enregistrée dans les dernières 24 heures',
                client_id: null,
                created_at: new Date(),
            });
        }

        // ── SYSTÈME ───────────────────────────────────────────

        // Vérification Blnk
        const blnkHealth = await this._checkService(
            `${process.env.BLNK_URL || 'http://blnk:5001'}/health`
        );
        if (blnkHealth.status !== 'OK') {
            alerts.push({
                category: 'system',
                type: 'error',
                severity: 'high',
                message: 'Blnk Ledger inaccessible — les transactions sont bloquées',
                client_id: null,
                created_at: new Date(),
            });
        }

        // Vérification base de données
        const dbHealth = await this._checkDatabase();
        if (dbHealth.status !== 'OK') {
            alerts.push({
                category: 'system',
                type: 'error',
                severity: 'high',
                message: 'PostgreSQL inaccessible — perte de données possible',
                client_id: null,
                created_at: new Date(),
            });
        }

        // Taux d'erreur élevé
        const errorRateResult = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as errors
    FROM transaction_logs
    WHERE created_at >= NOW() - INTERVAL '1 hour'
  `);
        const total = parseInt(errorRateResult.rows[0].total);
        const errors = parseInt(errorRateResult.rows[0].errors);
        if (total > 0 && (errors / total) > 0.1) {
            alerts.push({
                category: 'system',
                type: 'warning',
                severity: 'high',
                message: `Taux d'erreur élevé : ${((errors / total) * 100).toFixed(0)}% sur la dernière heure (${errors}/${total})`,
                client_id: null,
                created_at: new Date(),
            });
        }

        return alerts;
    },

    async _getBlnkBalance(balanceId) {
        try {
            const blnkService = require('./blnk.service');
            const balance = await blnkService.getBalance(balanceId);
            return balance.balance / 100;
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

    async getSystemInfo() {
        const formatUptime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            if (h > 0) return `${h}h ${m}m`;
            if (m > 0) return `${m}m ${s}s`;
            return `${s}s`;
        };

        const blnkHealth = await this._checkService(
            `${process.env.BLNK_URL || 'http://blnk:5001'}/health`
        );
        const redisHealth = await this._checkRedis();
        const dbHealth = await this._checkDatabase();

        const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
        const uptime = process.uptime();

        return {
            environment: env,
            version: process.env.APP_VERSION || '1.0.0',
            uptime_human: formatUptime(uptime),
            uptime_seconds: Math.floor(uptime),
            swagger_url: env !== 'production'
                ? `${process.env.APP_URL || 'http://localhost:3000'}/api-docs`
                : null,
            services: {
                backend: {
                    name: 'Backend API',
                    status: 'OK',
                    detail: 'Node.js + Express',
                },
                blnk: {
                    name: 'Blnk Ledger',
                    status: blnkHealth.status,
                    detail: blnkHealth.status === 'OK' ? 'Opérationnel' : 'Connexion échouée',
                },
                database: {
                    name: 'PostgreSQL',
                    status: dbHealth.status,
                    detail: dbHealth.status === 'OK' ? 'Opérationnel' : 'Connexion échouée',
                },
                redis: {
                    name: 'Redis',
                    status: redisHealth.status,
                    detail: redisHealth.status === 'OK' ? 'Opérationnel' : 'Connexion échouée',
                },
            },
        };
    },

    async _checkService(url) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
            return { status: res.ok ? 'OK' : 'ERROR' };
        } catch (err) {
            console.error('[Service Health Check]', url, err.message);
            return { status: 'ERROR' };
        }
    },

    async _checkDatabase() {
        const start = Date.now();
        try {
            await pool.query('SELECT 1');
            return { status: 'OK' };
        } catch (err) {
            // Log interne seulement — jamais retourné au client
            console.error('[DB Health Check]', err.message);
            return { status: 'ERROR' };
        }
    },

    async _checkRedis() {
        const blnk = await this._checkService(
            `${process.env.BLNK_URL || 'http://blnk:5001'}/health`
        );
        return {
            status: blnk.status,
            detail: blnk.status === 'OK'
                ? 'Opérationnel — géré par Blnk'
                : 'Vérifier le service Blnk',
            response_ms: blnk.response_ms,
        };
    },
};

module.exports = kpisService;