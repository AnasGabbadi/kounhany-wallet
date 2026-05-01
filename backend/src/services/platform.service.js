const blnkService = require('./blnk.service');
const pool = require('../config/db');

const PLATFORM_ACCOUNTS = [
  { key: 'revenue',    name: 'Kounhany_Revenue' },
  { key: 'fees',       name: 'Kounhany_Fees' },
  { key: 'settlement', name: 'Kounhany_Settlement' },
];

const platformService = {

  async init() {
    try {
      const existing = await pool.query('SELECT * FROM platform_accounts');
      if (existing.rows.length === 3) {
        console.log('Platform accounts already initialized');
        return;
      }

      // Créer un ledger plateforme
      const ledger = await blnkService.createLedger('platform', 'Kounhany_Platform');

      for (const account of PLATFORM_ACCOUNTS) {
        const balance = await blnkService.createBalance(
          ledger.ledger_id,
          'MAD',
          account.key,
          'platform'
        );
        await pool.query(
          'INSERT INTO platform_accounts (account_key, balance_id, ledger_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [account.key, balance.balance_id, ledger.ledger_id]
        );
        console.log(`Platform account created: ${account.name} → ${balance.balance_id}`);
      }

      console.log('Platform accounts initialized successfully');
    } catch (err) {
      console.error('Platform init error:', err.message);
    }
  },

  async getAccount(key) {
    const result = await pool.query(
      'SELECT * FROM platform_accounts WHERE account_key = $1',
      [key]
    );
    if (result.rows.length === 0) throw new Error(`Platform account ${key} not found`);
    return result.rows[0];
  },
};

module.exports = platformService;