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
  client_id: 'client_test_001',
  available_balance_id: 'bln_available',
  blocked_balance_id: 'bln_blocked',
  receivable_balance_id: 'bln_receivable',
  currency: 'MAD',
};

describe('GET /clients/scim/users', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner la liste des users SCIM', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/clients/scim/users')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('doit marquer les users qui ont déjà un wallet', async () => {
    pool.query = jest.fn().mockResolvedValue({
      rows: [{ scim_id: 'scim_001' }],
    });

    const res = await request(app)
      .get('/clients/scim/users')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    const user = res.body.data.find((u) => u.scim_id === 'scim_001');
    expect(user.has_wallet).toBe(true);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/clients/scim/users');
    expect(res.status).toBe(401);
  });
});

describe('POST /clients/from-scim', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    blnkService.createLedger = jest.fn().mockResolvedValue({
      ledger_id: 'ldg_test_001',
      name: 'Ledger_Test',
    });

    blnkService.createBalance = jest.fn()
      .mockResolvedValueOnce({ balance_id: 'bln_available', balance: 0 })
      .mockResolvedValueOnce({ balance_id: 'bln_blocked', balance: 0 })
      .mockResolvedValueOnce({ balance_id: 'bln_receivable', balance: 0 });
  });

  test('doit créer un client depuis SCIM avec son wallet', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })  // vérif scim_id
      .mockResolvedValueOnce({ rows: [] })  // vérif email
      .mockResolvedValueOnce({ rows: [] })  // insert client
      .mockResolvedValueOnce({ rows: [] }); // insert wallet

    const res = await request(app)
      .post('/clients/from-scim')
      .set('x-api-key', 'test-api-key')
      .send({
        scim_id: 'scim_test_001',
        name: 'Test User',
        email: 'test@kounhany.ma',
        phone: '0600000000',
        currency: 'MAD',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scim_id).toBe('scim_test_001');
  });

  test('doit retourner 400 si scim_id manquant', async () => {
    const res = await request(app)
      .post('/clients/from-scim')
      .set('x-api-key', 'test-api-key')
      .send({ name: 'Test', email: 'test@test.com' });

    expect(res.status).toBe(400);
  });

  test('doit retourner 400 si email manquant', async () => {
    const res = await request(app)
      .post('/clients/from-scim')
      .set('x-api-key', 'test-api-key')
      .send({ scim_id: 'scim_001', name: 'Test' });

    expect(res.status).toBe(400);
  });

  test('doit retourner 409 si scim_id déjà utilisé', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ scim_id: 'scim_001' }] });

    const res = await request(app)
      .post('/clients/from-scim')
      .set('x-api-key', 'test-api-key')
      .send({
        scim_id: 'scim_001',
        name: 'Test',
        email: 'test@test.com',
      });

    expect(res.status).toBe(409);
  });

  test('doit retourner 409 si email déjà utilisé', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ email: 'test@test.com' }] });

    const res = await request(app)
      .post('/clients/from-scim')
      .set('x-api-key', 'test-api-key')
      .send({
        scim_id: 'scim_002',
        name: 'Test',
        email: 'test@test.com',
      });

    expect(res.status).toBe(409);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app)
      .post('/clients/from-scim')
      .send({ scim_id: 'scim_001', name: 'Test', email: 'test@test.com' });

    expect(res.status).toBe(401);
  });
});

describe('GET /clients', () => {
  test('doit lister les clients', async () => {
    pool.query = jest.fn().mockResolvedValue({
      rows: [
        { client_id: 'client_001', name: 'Ahmed', email: 'ahmed@test.com' },
        { client_id: 'client_002', name: 'Sara', email: 'sara@test.com' },
      ],
    });

    const res = await request(app)
      .get('/clients')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/clients');
    expect(res.status).toBe(401);
  });
});

describe('GET /clients/:clientId/wallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000, credit_balance: 50000, debit_balance: 0 });
  });

  test('doit retourner le wallet complet du client', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({
        rows: [{
          client_id: 'client_001',
          ledger_id: 'ldg_001',
          available_balance_id: 'bln_available',
          blocked_balance_id: 'bln_blocked',
          receivable_balance_id: 'bln_receivable',
          currency: 'MAD',
          created_at: new Date(),
        }],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0', total_recharged: '0', total_blocked: '0', total_confirmed: '0', total_debt: '0', total_ext_payment: '0', total_errors: '0', last_activity: null }] });

    const res = await request(app)
      .get('/clients/client_001/wallet')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.wallet).toBeDefined();
    expect(res.body.data.stats).toBeDefined();
  });

  test('doit retourner 404 si wallet introuvable', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/clients/client_inexistant/wallet')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });
});