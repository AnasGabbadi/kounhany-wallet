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

const blnkService = require('../../src/services/blnk.service');
const pool = require('../../src/config/db');
const app = require('../../src/app');

const mockWallet = {
  client_id: 'client_001',
  ledger_id: 'ldg_001',
  available_balance_id: 'bln_available',
  blocked_balance_id: 'bln_blocked',
  receivable_balance_id: 'bln_receivable',
  currency: 'MAD',
  created_at: new Date(),
};

const mockClient = {
  id: 1,
  client_id: 'client_001',
  name: 'Ahmed Alami',
  email: 'ahmed@test.com',
  phone: null,
  scim_id: 'scim_001',
  client_type: null,
  active: true,
  created_at: new Date(),
  updated_at: new Date(),
  has_transactions: false,
};

const mockStats = {
  total_transactions: '0',
  total_recharged: '0',
  total_blocked: '0',
  total_confirmed: '0',
  total_debt: '0',
  total_ext_payment: '0',
  total_errors: '0',
  last_activity: null,
};

// ─── GET /clients ─────────────────────────────────────────────────────────────
describe('GET /clients', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit lister les clients', async () => {
    pool.query = jest.fn().mockResolvedValue({
      rows: [mockClient, { ...mockClient, client_id: 'client_002', name: 'Sara Benali' }],
    });

    const res = await request(app)
      .get('/clients')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  test('doit retourner liste vide si aucun client', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/clients')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/clients');
    expect(res.status).toBe(401);
  });
});

// ─── GET /clients/:clientId ───────────────────────────────────────────────────
describe('GET /clients/:clientId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 1000000, credit_balance: 1000000, debit_balance: 0 });
  });

  test('doit retourner le détail d un client', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [mockWallet] });

    const res = await request(app)
      .get('/clients/client_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.client_id).toBe('client_001');
    expect(res.body.data.balance).toBeDefined();
  });

  test('doit retourner 404 si client introuvable', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/clients/client_inexistant')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/clients/client_001');
    expect(res.status).toBe(401);
  });
});

// ─── GET /clients/:clientId/wallet ────────────────────────────────────────────
describe('GET /clients/:clientId/wallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blnkService.getBalance = jest.fn().mockResolvedValue({
      balance: 1000000,
      credit_balance: 1000000,
      debit_balance: 0,
    });
  });

  test('doit retourner le wallet complet du client', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [mockStats] });

    const res = await request(app)
      .get('/clients/client_001/wallet')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wallet).toBeDefined();
    expect(res.body.data.wallet.accounts).toBeDefined();
    expect(res.body.data.wallet.accounts.available).toBeDefined();
    expect(res.body.data.stats).toBeDefined();
    expect(res.body.data.transactions).toBeDefined();
  });

  test('doit retourner les soldes corrects divisés par 10000', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
        ...mockStats,
        total_recharged: '10000',
        total_blocked: '1500',
        total_confirmed: '1500',
        total_debt: '1500',
      }] });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 85000000 }); // 8500 MAD

    const res = await request(app)
      .get('/clients/client_001/wallet')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.wallet.accounts.available.balance).toBe(8500);
    expect(res.body.data.stats.total_recharged).toBe(10000);
    expect(res.body.data.stats.total_confirmed).toBe(1500);
  });

  test('doit retourner les transactions du client', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [
        { id: 1, type: 'PAYMENT', amount: '500.00', reference: 'REF-001', status: 'SUCCESS' },
        { id: 2, type: 'BLOCK', amount: '100.00', reference: 'REF-002', status: 'SUCCESS' },
      ]})
      .mockResolvedValueOnce({ rows: [{
        total_transactions: '2',   // ← nom correct du champ
        total_recharged: '500',
        total_blocked: '100',
        total_confirmed: '0',
        total_debt: '0',
        total_ext_payment: '0',
        total_errors: '0',
        last_activity: new Date(),
      }] });

    const res = await request(app)
      .get('/clients/client_001/wallet')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.transactions.length).toBe(2);
    expect(res.body.data.stats.total_transactions).toBe(2);
  });

  test('doit retourner 404 si wallet introuvable', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/clients/client_inexistant/wallet')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/clients/client_001/wallet');
    expect(res.status).toBe(401);
  });
});