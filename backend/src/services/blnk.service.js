const blnkClient = require('../config/blnk');

const blnkService = {

  // Créer un ledger pour un client
  async createLedger(clientId, clientName) {
    const response = await blnkClient.post('/ledgers', {
      name: `Ledger_${clientName}`,
      meta_data: {
        client_id: clientId,
      },
    });
    return response.data;
  },

  // Créer un compte dans Blnk
  async createBalance(ledgerId, currency, accountType, clientId) {
    const response = await blnkClient.post('/balances', {
      ledger_id: ledgerId,
      currency: currency,
      meta_data: {
        client_id: clientId,
        account_type: accountType,
      },
    });
    return response.data;
  },

  // Récupérer un compte par ID
  async getBalance(balanceId) {
    const response = await blnkClient.get(`/balances/${balanceId}`);
    return response.data;
  },

  // Créer une transaction dans Blnk
  async createTransaction(data) {
    const response = await blnkClient.post('/transactions', {
      amount: data.amount,
      currency: data.currency || 'MAD',
      precision: 100,
      reference: data.reference,
      description: data.description,
      source: data.source,
      destination: data.destination,
      allow_overdraft: data.allow_overdraft || true,
      skip_queue: data.skip_queue || false,
      meta_data: data.meta_data || {},
    });
    return response.data;
  },

  // Récupérer les transactions d'un compte
  async getTransactions(balanceId) {
    const response = await blnkClient.get(`/balances/${balanceId}/transactions`);
    return response.data;
  },
};

module.exports = blnkService;