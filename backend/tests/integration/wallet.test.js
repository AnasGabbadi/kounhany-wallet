const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.BLNK_URL = 'http://localhost:5001';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'kounhany';
process.env.DB_PASSWORD = 'kounhany2024';
process.env.DB_NAME = 'kounhany_db';

jest.mock('../../src/services/blnk.service');
jest.mock('../../src/config/db');
jest.mock('../../src/services/dolibarr.service');

const dolibarrService = require('../../src/services/dolibarr.service');
const blnkService = require('../../src/services/blnk.service');
const pool = require('../../src/config/db');
const app = require('../../src/app');

const mockWallet = {
  client_id: 'client_test_001',
  available_balance_id: 'bln_available',
  blocked_balance_id: 'bln_blocked',
  receivable_balance_id: 'bln_receivable',
  currency: 'MAD',
};

// ─── POST /wallet/check-available ─────────────────────────────────────────────
describe('POST /wallet/check-available', () => {
  beforeEach(() => {
    dolibarrService.createInvoice = jest.fn().mockResolvedValue(1);
    jest.clearAllMocks()
  });

  test('doit retourner sufficient=true si solde suffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD

    const res = await request(app)
      .post('/wallet/check-available')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data.sufficient).toBe(true);
    expect(res.body.data.available).toBe(500);
  });

  test('doit retourner sufficient=false si solde insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 10000 }); // 1 MAD

    const res = await request(app)
      .post('/wallet/check-available')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 99999 });

    expect(res.status).toBe(200);
    expect(res.body.data.sufficient).toBe(false);
  });

  test('doit retourner 400 si amount manquant', async () => {
    const res = await request(app)
      .post('/wallet/check-available')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001' });

    expect(res.status).toBe(400);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app)
      .post('/wallet/check-available')
      .send({ client_id: 'client_test_001', amount: 100 });

    expect(res.status).toBe(401);
  });
});

// ─── POST /wallet/block ───────────────────────────────────────────────────────
describe('POST /wallet/block', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner 422 si solde insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    const res = await request(app)
      .post('/wallet/block')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 500 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('doit créer un block si solde suffisant', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_test_001',
      status: 'APPLIED',
    });

    const res = await request(app)
      .post('/wallet/block')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 100, description: 'Test block' });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe('txn_test_001');
  });

  test('doit retourner 400 si amount manquant', async () => {
    const res = await request(app)
      .post('/wallet/block')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /wallet/unblock ─────────────────────────────────────────────────────
describe('POST /wallet/unblock', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner 422 si montant bloqué insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    const res = await request(app)
      .post('/wallet/unblock')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 100 });

    expect(res.status).toBe(422);
  });

  test('doit débloquer le montant — Blocked → Available', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 }); // 500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_unblock_001',
      status: 'APPLIED',
    });

    const res = await request(app)
      .post('/wallet/unblock')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 100, description: 'Annulation' });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe('txn_unblock_001');
  });

  test('doit retourner 400 si amount manquant', async () => {
    const res = await request(app)
      .post('/wallet/unblock')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001' });

    expect(res.status).toBe(400);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).post('/wallet/unblock').send({ client_id: 'client_test_001', amount: 100 });
    expect(res.status).toBe(401);
  });
});

// ─── POST /wallet/confirm ─────────────────────────────────────────────────────
describe('POST /wallet/confirm', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner 422 si montant bloqué insuffisant', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 0 });

    const res = await request(app)
      .post('/wallet/confirm')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 100 });

    expect(res.status).toBe(422);
  });

  test('doit confirmer si montant bloqué suffisant', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 5000000 });
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_confirm_001',
      status: 'APPLIED',
    });

    const res = await request(app)
      .post('/wallet/confirm')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 100, description: 'Test confirm' });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe('txn_confirm_001');
  });
});

// ─── POST /wallet/pay ─────────────────────────────────────────────────────────
describe('POST /wallet/pay', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit enregistrer un paiement', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_pay_001',
      status: 'APPLIED',
    });

    const res = await request(app)
      .post('/wallet/pay')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 500, description: 'Recharge' });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe('txn_pay_001');
  });

  test('doit retourner transaction existante si référence dupliquée (idempotency)', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [{ reference: 'REF-001', transaction_id: 'txn_existing' }] });

    blnkService.createTransaction = jest.fn();

    const res = await request(app)
      .post('/wallet/pay')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 500, reference: 'REF-001' });

    expect(res.status).toBe(200);
    expect(res.body.data.reference).toBe('REF-001');
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
  });
});

// ─── GET /wallet/balance/:clientId ────────────────────────────────────────────
describe('GET /wallet/balance/:clientId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les soldes du client', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [mockWallet] });
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 1000000 }); // 100 MAD

    const res = await request(app)
      .get('/wallet/balance/client_test_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.available).toBe(100);
    expect(res.body.data.currency).toBe('MAD');
  });

  test('doit retourner 404 si wallet introuvable', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/wallet/balance/client_inexistant')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });
});

// ─── GET /wallet/transactions/:clientId ───────────────────────────────────────
describe('GET /wallet/transactions/:clientId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les transactions du client', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({
        rows: [
          { id: 1, type: 'PAYMENT', amount: '500.00', reference: 'REF-001' },
          { id: 2, type: 'BLOCK', amount: '100.00', reference: 'REF-002' },
        ]
      });

    const res = await request(app)
      .get('/wallet/transactions/client_test_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  test('doit retourner tableau vide si aucune transaction', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/wallet/transactions/client_test_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});

// ─── POST /wallet/external-debt ───────────────────────────────────────────────
describe('POST /wallet/external-debt', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit solder une créance — Receivable → @World', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_debt_001',
      status: 'APPLIED',
    });

    const res = await request(app)
      .post('/wallet/external-debt')
      .set('x-api-key', 'test-api-key')
      .send({
        client_id: 'client_test_001',
        amount: 200,
        reference: 'DOLIBARR-INV-001',
        description: 'Solde créance',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe('txn_debt_001');
  });

  test('doit retourner 400 si reference manquante', async () => {
    const res = await request(app)
      .post('/wallet/external-debt')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 200 });

    expect(res.status).toBe(400);
  });
});

// ─── POST /wallet/external-payment ────────────────────────────────────────────
describe('POST /wallet/external-payment', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit créer une créance — @World → Receivable', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_extpay_001',
      status: 'APPLIED',
    });

    const res = await request(app)
      .post('/wallet/external-payment')
      .set('x-api-key', 'test-api-key')
      .send({
        client_id: 'client_test_001',
        amount: 200,
        reference: 'DOLIBARR-PAY-001',
        description: 'Créance externe',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.transaction_id).toBe('txn_extpay_001');
  });

  test('doit retourner 400 si reference manquante', async () => {
    const res = await request(app)
      .post('/wallet/external-payment')
      .set('x-api-key', 'test-api-key')
      .send({ client_id: 'client_test_001', amount: 200 });

    expect(res.status).toBe(400);
  });
});