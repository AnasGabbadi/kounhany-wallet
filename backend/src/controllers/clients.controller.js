const walletService = require('../services/wallet.service');
const pool = require('../config/db');
const blnkService = require('../services/blnk.service');

const clientsController = {

  async list(req, res, next) {
    try {
      const result = await pool.query(
        `SELECT c.*,
          EXISTS(
            SELECT 1 FROM transaction_logs t 
            WHERE t.client_id = c.client_id
          ) as has_transactions
        FROM clients c
        ORDER BY c.active DESC, c.created_at DESC`
      );
      res.json({ success: true, data: result.rows });
    } catch (err) { next(err); }
  },

  async getOne(req, res, next) {
    try {
      const { clientId } = req.params;
      const client = await pool.query(
        'SELECT * FROM clients WHERE client_id = $1', [clientId]
      );
      if (client.rows.length === 0) {
        const err = new Error('Client introuvable');
        err.status = 404;
        throw err;
      }
      const balance = await walletService.getBalance(clientId);
      res.json({ success: true, data: { ...client.rows[0], balance } });
    } catch (err) { next(err); }
  },

  async getWallet(req, res, next) {
    try {
      const { clientId } = req.params;

      const walletResult = await pool.query(
        'SELECT * FROM client_wallets WHERE client_id = $1', [clientId]
      );

      if (walletResult.rows.length === 0) {
        const err = new Error('Wallet introuvable pour ce client');
        err.status = 404;
        throw err;
      }

      const wallet = walletResult.rows[0];

      const [available, blocked, receivable] = await Promise.all([
        blnkService.getBalance(wallet.available_balance_id),
        blnkService.getBalance(wallet.blocked_balance_id),
        blnkService.getBalance(wallet.receivable_balance_id),
      ]);

      const txResult = await pool.query(
        `SELECT * FROM transaction_logs
         WHERE client_id = $1
         ORDER BY created_at DESC`,
        [clientId]
      );

      const statsResult = await pool.query(
        `SELECT
          COUNT(*) as total_transactions,
          COALESCE(SUM(CASE WHEN type = 'PAYMENT'          THEN amount::numeric ELSE 0 END), 0) as total_recharged,
          COALESCE(SUM(CASE WHEN type = 'BLOCK'            THEN amount::numeric ELSE 0 END), 0) as total_blocked,
          COALESCE(SUM(CASE WHEN type = 'CONFIRM'          THEN amount::numeric ELSE 0 END), 0) as total_confirmed,
          COALESCE(SUM(CASE WHEN type = 'EXTERNAL_DEBT'    THEN amount::numeric ELSE 0 END), 0) as total_debt,
          COALESCE(SUM(CASE WHEN type = 'EXTERNAL_PAYMENT' THEN amount::numeric ELSE 0 END), 0) as total_ext_payment,
          COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as total_errors,
          MAX(created_at) as last_activity
        FROM transaction_logs
        WHERE client_id = $1`,
        [clientId]
      );

      const stats = statsResult.rows[0];

      res.json({
        success: true,
        data: {
          wallet: {
            ledger_id: wallet.ledger_id,
            currency: wallet.currency,
            created_at: wallet.created_at,
            accounts: {
              available: {
                balance: available.balance / 10000,
                credit_balance: available.credit_balance / 10000,
                debit_balance: available.debit_balance / 10000,
              },
              blocked: {
                balance: blocked.balance / 10000,
                credit_balance: blocked.credit_balance / 10000,
                debit_balance: blocked.debit_balance / 10000,
              },
              receivable: {
                balance: receivable.balance / 10000,
                credit_balance: receivable.credit_balance / 10000,
                debit_balance: receivable.debit_balance / 10000,
              },
            },
            summary: {
              total_assets: (available.balance + blocked.balance + receivable.balance) / 10000,
              total_encours: (blocked.balance + receivable.balance) / 10000,
            },
          },
          stats: {
            total_transactions: parseInt(stats.total_transactions),
            total_recharged: parseFloat(stats.total_recharged),
            total_blocked: parseFloat(stats.total_blocked),
            total_confirmed: parseFloat(stats.total_confirmed),
            total_collected: parseFloat(stats.total_debt),      // créances encaissées
            total_ext_payment: parseFloat(stats.total_ext_payment),
            total_errors: parseInt(stats.total_errors),
            last_activity: stats.last_activity,
            net_receivable: parseFloat(stats.total_confirmed) - parseFloat(stats.total_debt), // créances en attente
          },
          transactions: txResult.rows,
        },
      });
    } catch (err) { next(err); }
  },
};



module.exports = clientsController;