jest.mock('../../src/services/blnk.service');
jest.mock('../../src/config/db');
jest.mock('../../src/services/dolibarr.service');

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

// balance = amount * 100 (precision Blnk) * 100 (notre multiplicateur) = amount * 10000
// Pour amount=100 MAD → balance = 1,000,000
// Pour amount=500 MAD → balance = 5,000,000

// ─── checkAvailable ───────────────────────────────────────────────────────────
describe('Wallet Service — checkAvailable', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner sufficient=true si solde suffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD

    const result = await walletService.checkAvailable('client_123', 100);
    expect(result.sufficient).toBe(true);
    expect(result.available).toBe(500);
  });

  test('doit retourner sufficient=false si solde insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 10000 }); // 1 MAD

    const result = await walletService.checkAvailable('client_123', 999999);
    expect(result.sufficient).toBe(false);
  });
});

// ─── block ────────────────────────────────────────────────────────────────────
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
      .mockResolvedValueOnce({ rows: [mockWallet] }) // checkAvailable
      .mockResolvedValueOnce({ rows: [mockWallet] }) // getClientWallet
      .mockResolvedValueOnce({ rows: [] })            // idempotency
      .mockResolvedValueOnce({ rows: [] });           // _log

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_123',
      status: 'APPLIED',
    });

    const result = await walletService.block('client_123', 100, 'REF-001', 'Test block');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: 'bln_available',
      destination: 'bln_blocked',
    }));
    expect(result.transaction_id).toBe('txn_123');
  });

  test('doit retourner la transaction existante si référence déjà utilisée (idempotency)', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] }) // checkAvailable
      .mockResolvedValueOnce({ rows: [mockWallet] }) // getClientWallet
      .mockResolvedValueOnce({ rows: [{ reference: 'REF-001', transaction_id: 'txn_existing' }] }); // idempotency

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD

    const result = await walletService.block('client_123', 100, 'REF-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('REF-001');
  });
});

// ─── unblock ──────────────────────────────────────────────────────────────────
describe('Wallet Service — unblock', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lancer une erreur 422 si montant bloqué insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    await expect(walletService.unblock('client_123', 100))
      .rejects.toMatchObject({ status: 422 });
  });

  test('doit débloquer le montant — Blocked → Available', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] }) // getClientWallet
      .mockResolvedValueOnce({ rows: [] })            // idempotency
      .mockResolvedValueOnce({ rows: [] });           // _log

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_unblock_123',
      status: 'APPLIED',
    });

    const result = await walletService.unblock('client_123', 100, 'CANCEL-001', 'Annulation');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: 'bln_blocked',
      destination: 'bln_available',
    }));
    expect(result.transaction_id).toBe('txn_unblock_123');
  });

  test('doit retourner transaction existante si référence dupliquée (idempotency)', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] }) // getClientWallet
      .mockResolvedValueOnce({ rows: [{ reference: 'CANCEL-001', transaction_id: 'txn_existing' }] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 });

    const result = await walletService.unblock('client_123', 100, 'CANCEL-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('CANCEL-001');
  });
});

// ─── confirm ──────────────────────────────────────────────────────────────────
describe('Wallet Service — confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lancer une erreur 422 si montant bloqué insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    await expect(walletService.confirm('client_123', 100))
      .rejects.toMatchObject({ status: 422 });
  });

  test('doit confirmer — Blocked → Receivable', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] }) // getClientWallet
      .mockResolvedValueOnce({ rows: [] })            // idempotency
      .mockResolvedValueOnce({ rows: [{ name: 'Test Client' }] }) // client query
      .mockResolvedValueOnce({ rows: [] });           // _log

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_confirm_123',
      status: 'APPLIED',
    });

    const result = await walletService.confirm('client_123', 100, 'REF-CONFIRM-001', 'Test confirm');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: 'bln_blocked',
      destination: 'bln_receivable',
    }));
    expect(result.transaction_id).toBe('txn_confirm_123');
  });
});

// ─── directConfirm ────────────────────────────────────────────────────────────
describe('Wallet Service — directConfirm (LOGISTIQUE)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lancer une erreur 422 si solde disponible insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    await expect(walletService.directConfirm('client_123', 100))
      .rejects.toMatchObject({ status: 422 });
  });

  test('doit confirmer directement — Available → Receivable', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] }) // checkAvailable → getClientWallet
      .mockResolvedValueOnce({ rows: [mockWallet] }) // directConfirm → getClientWallet
      .mockResolvedValueOnce({ rows: [] })            // idempotency
      .mockResolvedValueOnce({ rows: [] });           // _log

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_direct_123',
      status: 'APPLIED',
    });

    const result = await walletService.directConfirm('client_123', 100, 'LOG-001', 'Mission logistique');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: 'bln_available',
      destination: 'bln_receivable',
    }));
    expect(result.transaction_id).toBe('txn_direct_123');
  });

  test('doit retourner transaction existante si référence dupliquée (idempotency)', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] }) // checkAvailable
      .mockResolvedValueOnce({ rows: [mockWallet] }) // getClientWallet
      .mockResolvedValueOnce({ rows: [{ reference: 'LOG-001', transaction_id: 'txn_existing' }] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 });

    const result = await walletService.directConfirm('client_123', 100, 'LOG-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('LOG-001');
  });
});

// ─── pay ──────────────────────────────────────────────────────────────────────
describe('Wallet Service — pay', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit enregistrer un paiement — @World → Available', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_pay_123',
      status: 'APPLIED',
    });

    const result = await walletService.pay('client_123', 500, 'REF-PAY-001', 'Recharge');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: '@World',
      destination: 'bln_available',
    }));
    expect(result.transaction_id).toBe('txn_pay_123');
  });

  test('doit retourner transaction existante si référence dupliquée', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [{ reference: 'REF-PAY-001', transaction_id: 'txn_existing' }] });

    const result = await walletService.pay('client_123', 500, 'REF-PAY-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('REF-PAY-001');
  });
});

// ─── externalDebt ─────────────────────────────────────────────────────────────
describe('Wallet Service — externalDebt', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit solder une créance — Receivable → @World', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_debt_123',
      status: 'APPLIED',
    });

    const result = await walletService.externalDebt('client_123', 200, 'DOL-001', 'Solde créance');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: 'bln_receivable',
      destination: '@World',
    }));
    expect(result.transaction_id).toBe('txn_debt_123');
  });
});

// ─── externalPayment ──────────────────────────────────────────────────────────
describe('Wallet Service — externalPayment', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit créer une créance — @World → Receivable', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_extpay_123',
      status: 'APPLIED',
    });

    const result = await walletService.externalPayment('client_123', 200, 'DOL-PAY-001', 'Créance externe');
    expect(blnkService.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: '@World',
      destination: 'bln_receivable',
    }));
    expect(result.transaction_id).toBe('txn_extpay_123');
  });
});

// ─── getBalance ───────────────────────────────────────────────────────────────
describe('Wallet Service — getBalance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les soldes divisés par 10000', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 1000000 }); // 100 MAD

    const result = await walletService.getBalance('client_123');
    expect(result.available).toBe(100);
    expect(result.blocked).toBe(100);
    expect(result.receivable).toBe(100);
    expect(result.currency).toBe('MAD');
  });
});

// ─── getClientWallet ──────────────────────────────────────────────────────────
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