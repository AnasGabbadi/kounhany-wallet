const blnkService = require('./blnk.service');
const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const dolibarrService = require('./dolibarr.service');

const walletService = {

  // Créer les 3 comptes d'un client dans Blnk
  async createClientWallet(clientId, clientName, currency = 'MAD') {
    const ledger = await blnkService.createLedger(clientId, clientName);
    const available = await blnkService.createBalance(ledger.ledger_id, currency, 'available', clientId);
    const blocked = await blnkService.createBalance(ledger.ledger_id, currency, 'blocked', clientId);
    const receivable = await blnkService.createBalance(ledger.ledger_id, currency, 'receivable', clientId);

    await pool.query(
      `INSERT INTO client_wallets
        (client_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id, currency)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clientId, ledger.ledger_id, available.balance_id, blocked.balance_id, receivable.balance_id, currency]
    );

    return { ledger, available, blocked, receivable };
  },

  // Vérifier le solde disponible
  async checkAvailable(clientId, amount) {
    const wallet = await this.getClientWallet(clientId);
    const balance = await blnkService.getBalance(wallet.available_balance_id);
    const available = balance.balance / 100;
    return {
      sufficient: available >= amount,
      available,
      requested: amount,
    };
  },

  // BLOCK — vérifie disponible puis réserve
  async block(clientId, amount, reference, description) {
    // Validation automatique avant la transaction
    const check = await this.checkAvailable(clientId, amount);
    if (!check.sufficient) {
      const err = new Error(`Solde insuffisant — disponible: ${check.available} MAD, demandé: ${amount} MAD`);
      err.status = 422;
      throw err;
    }

    const wallet = await this.getClientWallet(clientId);
    const ref = reference || uuidv4();

    // Idempotency — vérifier si la référence existe déjà
    const existing = await this._findTransactionByReference(ref);
    if (existing) {
      console.log(`[IDEMPOTENCY] Transaction déjà existante pour reference: ${ref}`);
      return existing;
    }

    const transaction = await blnkService.createTransaction({
      amount: amount * 100,
      reference: ref,
      description: description || 'Block — réservation',
      source: wallet.available_balance_id,
      destination: wallet.blocked_balance_id,
      meta_data: { client_id: clientId, type: 'block' },
    });

    await this._log({ clientId, transactionId: transaction.transaction_id, type: 'BLOCK', amount, reference: ref, description });
    return transaction;
  },

  // CONFIRM — consommer le montant bloqué
  async confirm(clientId, amount, reference, description) {
    const wallet = await this.getClientWallet(clientId);

    // Vérifier que le montant bloqué est suffisant
    const blockedBalance = await blnkService.getBalance(wallet.blocked_balance_id);
    const blocked = blockedBalance.balance / 100;
    if (blocked < amount) {
      const err = new Error(`Montant bloqué insuffisant — bloqué: ${blocked} MAD, demandé: ${amount} MAD`);
      err.status = 422;
      throw err;
    }

    const ref = reference || uuidv4();

    const existing = await this._findTransactionByReference(ref);
    if (existing) {
      console.log(`[IDEMPOTENCY] Transaction déjà existante pour reference: ${ref}`);
      return existing;
    }

    const transaction = await blnkService.createTransaction({
      amount: amount * 100,
      reference: ref,
      description: description || 'Confirm — consommation',
      source: wallet.blocked_balance_id,
      destination: wallet.receivable_balance_id,
      meta_data: { client_id: clientId, type: 'confirm' },
    });

    if (process.env.DOLIBARR_URL && process.env.DOLIBARR_API_KEY) {
      try {
        const client = await pool.query('SELECT * FROM clients WHERE client_id = $1', [clientId]);
        await dolibarrService.createInvoice({
          clientId: clientId,
          clientName: client.rows[0]?.name,
          amount,
          description: description || 'Consommation wallet Kounhany',
          reference: ref,
        });
      } catch (err) {
        // Log mais ne bloque pas la transaction
        console.error('[Dolibarr] Erreur création facture:', err.message);
      }
    }

    await this._log({ clientId, transactionId: transaction.transaction_id, type: 'CONFIRM', amount, reference: ref, description });
    return transaction;
  },

  // PAY — paiement reçu du client
  async pay(clientId, amount, reference, description) {
    const wallet = await this.getClientWallet(clientId);
    const ref = reference || uuidv4();

    const existing = await this._findTransactionByReference(ref);
    if (existing) {
      console.log(`[IDEMPOTENCY] Transaction déjà existante pour reference: ${ref}`);
      return existing;
    }

    const transaction = await blnkService.createTransaction({
      amount: amount * 100,
      reference: ref,
      description: description || 'Payment — paiement reçu',
      source: '@World',
      destination: wallet.available_balance_id,
      meta_data: { client_id: clientId, type: 'payment' },
    });

    await this._log({ clientId, transactionId: transaction.transaction_id, type: 'PAYMENT', amount, reference: ref, description });
    return transaction;
  },

  // EXTERNAL DEBT — dette Dolibarr
  async externalDebt(clientId, amount, reference, description) {
    const wallet = await this.getClientWallet(clientId);
    const ref = reference || uuidv4();

    const existing = await this._findTransactionByReference(ref);
    if (existing) return existing;

    const transaction = await blnkService.createTransaction({
      amount: amount * 100,
      reference: ref,
      description: description || 'Dolibarr — dette externe',
      source: wallet.receivable_balance_id,
      destination: '@World',
      meta_data: { client_id: clientId, type: 'external_debt' },
    });

    await this._log({ clientId, transactionId: transaction.transaction_id, type: 'EXTERNAL_DEBT', amount, reference: ref, description });
    return transaction;
  },

  // EXTERNAL PAYMENT — paiement Dolibarr
  async externalPayment(clientId, amount, reference, description) {
    const wallet = await this.getClientWallet(clientId);
    const ref = reference || uuidv4();

    const existing = await this._findTransactionByReference(ref);
    if (existing) return existing;

    const transaction = await blnkService.createTransaction({
      amount: amount * 100,
      reference: ref,
      description: description || 'Dolibarr — paiement reçu',
      source: '@World',
      destination: wallet.receivable_balance_id,
      meta_data: { client_id: clientId, type: 'external_payment' },
    });

    await this._log({ clientId, transactionId: transaction.transaction_id, type: 'EXTERNAL_PAYMENT', amount, reference: ref, description });
    return transaction;
  },

  // Récupérer le wallet d'un client
  async getClientWallet(clientId) {
    const result = await pool.query(
      'SELECT * FROM client_wallets WHERE client_id = $1',
      [clientId]
    );
    if (result.rows.length === 0) {
      const error = new Error(`Wallet introuvable pour le client ${clientId}`);
      error.status = 404;
      throw error;
    }
    return result.rows[0];
  },

  // Récupérer tous les soldes d'un client
  async getBalance(clientId) {
    const wallet = await this.getClientWallet(clientId);
    const [available, blocked, receivable] = await Promise.all([
      blnkService.getBalance(wallet.available_balance_id),
      blnkService.getBalance(wallet.blocked_balance_id),
      blnkService.getBalance(wallet.receivable_balance_id),
    ]);
    return {
      client_id: clientId,
      currency: wallet.currency,
      available: available.balance / 100,
      blocked: blocked.balance / 100,
      receivable: receivable.balance / 100,
    };
  },

  // Récupérer les transactions
  async getTransactions(clientId) {
    const wallet = await this.getClientWallet(clientId);
    const result = await pool.query(
      'SELECT * FROM transaction_logs WHERE client_id = $1 ORDER BY created_at DESC',
      [clientId]
    );
    return result.rows;
  },

  // Vérifier idempotency par référence
  async _findTransactionByReference(reference) {
    const result = await pool.query(
      'SELECT * FROM transaction_logs WHERE reference = $1',
      [reference]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  // Logger chaque écriture financière
  async _log({ clientId, transactionId, type, amount, currency = 'MAD', reference, description, status = 'SUCCESS', error = null }) {
    try {
      await pool.query(
        `INSERT INTO transaction_logs
          (client_id, transaction_id, type, amount, currency, reference, description, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [clientId, transactionId, type, amount, currency, reference, description, status, error]
      );
      console.log(`[LOG] ${type} | client: ${clientId} | amount: ${amount} ${currency} | ref: ${reference}`);
    } catch (err) {
      console.error('[LOG ERROR]', err.message);
    }
  },
};

module.exports = walletService;