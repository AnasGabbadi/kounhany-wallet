jest.mock('../../src/services/blnk.service');
jest.mock('../../src/config/db');

const walletService = require('../../src/services/wallet.service');
const blnkService = require('../../src/services/blnk.service');
const pool = require('../../src/config/db');

const mockWallet = {
  client_id: 'client_123',
  available_balance_id: 'bln_available',
  blocked_balance_id: 'bln_blocked',
  receivable_balance_id: 'bln_receivable',
  currency: 'MAD',
};

describe('Wallet Service — checkAvailable', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner sufficient=true si solde suffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000 });

    const result = await walletService.checkAvailable('client_123', 100);
    expect(result.sufficient).toBe(true);
    expect(result.available).toBe(500);
  });

  test('doit retourner sufficient=false si solde insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 1000 });

    const result = await walletService.checkAvailable('client_123', 999999);
    expect(result.sufficient).toBe(false);
  });
});

describe('Wallet Service — block', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lancer une erreur 422 si solde insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    await expect(walletService.block('client_123', 100))
      .rejects.toMatchObject({ status: 422 });
  });

  test('doit créer une transaction si solde suffisant', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000 });
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_123',
      status: 'QUEUED',
    });

    const result = await walletService.block('client_123', 100, 'REF-001', 'Test block');
    expect(blnkService.createTransaction).toHaveBeenCalled();
    expect(result.transaction_id).toBe('txn_123');
  });

  test('doit retourner la transaction existante si référence déjà utilisée (idempotency)', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [{ reference: 'REF-001', transaction_id: 'txn_existing' }] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000 });

    const result = await walletService.block('client_123', 100, 'REF-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('REF-001');
  });
});

describe('Wallet Service — confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lancer une erreur 422 si montant bloqué insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    await expect(walletService.confirm('client_123', 100))
      .rejects.toMatchObject({ status: 422 });
  });

  test('doit confirmer la transaction si montant bloqué suffisant', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000 });
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_confirm_123',
      status: 'QUEUED',
    });

    const result = await walletService.confirm('client_123', 100, 'REF-CONFIRM-001', 'Test confirm');
    expect(blnkService.createTransaction).toHaveBeenCalled();
    expect(result.transaction_id).toBe('txn_confirm_123');
  });
});

describe('Wallet Service — pay', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit enregistrer un paiement', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_pay_123',
      status: 'QUEUED',
    });

    const result = await walletService.pay('client_123', 500, 'REF-PAY-001', 'Recharge');
    expect(blnkService.createTransaction).toHaveBeenCalled();
    expect(result.transaction_id).toBe('txn_pay_123');
  });

  test('doit retourner transaction existante si référence dupliquée', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [{ reference: 'REF-PAY-001', transaction_id: 'txn_existing' }] });

    blnkService.createTransaction = jest.fn();

    const result = await walletService.pay('client_123', 500, 'REF-PAY-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('REF-PAY-001');
  });
});

describe('Wallet Service — getBalance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les soldes du client', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000 });

    const result = await walletService.getBalance('client_123');
    expect(result.available).toBe(500);
    expect(result.blocked).toBe(500);
    expect(result.receivable).toBe(500);
    expect(result.currency).toBe('MAD');
  });
});

describe('Wallet Service — getClientWallet', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lancer erreur 404 si client introuvable', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    await expect(walletService.getClientWallet('client_inexistant'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('doit retourner le wallet si client trouvé', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });

    const result = await walletService.getClientWallet('client_123');
    expect(result.client_id).toBe('client_123');
    expect(result.available_balance_id).toBe('bln_available');
  });
});

describe('Wallet Service — externalDebt', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit enregistrer une dette externe', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_debt_123',
      status: 'QUEUED',
    });

    const result = await walletService.externalDebt('client_123', 200, 'DOL-001', 'Facture');
    expect(blnkService.createTransaction).toHaveBeenCalled();
    expect(result.transaction_id).toBe('txn_debt_123');
  });
});

describe('Wallet Service — externalPayment', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit enregistrer un paiement externe', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_extpay_123',
      status: 'QUEUED',
    });

    const result = await walletService.externalPayment('client_123', 200, 'DOL-PAY-001', 'Paiement Dolibarr');
    expect(blnkService.createTransaction).toHaveBeenCalled();
    expect(result.transaction_id).toBe('txn_extpay_123');
  });
});