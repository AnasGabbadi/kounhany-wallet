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

const blnkService = require('../../src/services/blnk.service');
const dolibarrService = require('../../src/services/dolibarr.service');
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

// ═════════════════════════════════════════════════════════════════════════════
// ORDERS ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

const mockOrderFleet = {
  id: 42,
  client_id: 'client_001',
  order_type: 'FLEET',
  amount: '1500.00',
  reference: 'FLEET-TEST-001',
  description: 'Test maintenance',
  status: 'BLOCKED',
  metadata: { external_order_id: 'ext_001' },
  blnk_transaction_id: 'txn_blnk_001',
  dolibarr_invoice_id: null,
  confirmed_at: null,
  cancelled_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'manager@fleet.ma',
};

// ─── POST /orders/fleet ───────────────────────────────────────────────────────
describe('POST /orders/fleet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000000 }); // 5000 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({ transaction_id: 'txn_blnk_001' });
  });

  test('doit créer une commande FLEET → 201 + wallet_order_id + status BLOCKED', async () => {
    // createOrder FLEET appelle pool.query dans cet ordre exact :
    // 1. client check, 2. ref unique, 3. getClientWallet (getBalance),
    // 4. INSERT order, 5+6. getClientWallet×2 (checkAvailable + block),
    // 7. idempotency transaction_logs, 8. _log INSERT, 9. UPDATE status BLOCKED
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })     // 1. client check
      .mockResolvedValueOnce({ rows: [] })               // 2. ref unique
      .mockResolvedValueOnce({ rows: [mockWallet] })     // 3. getClientWallet (getBalance)
      .mockResolvedValueOnce({ rows: [mockOrderFleet] }) // 4. INSERT order
      .mockResolvedValueOnce({ rows: [mockWallet] })     // 5. getClientWallet (checkAvailable)
      .mockResolvedValueOnce({ rows: [mockWallet] })     // 6. getClientWallet (block)
      .mockResolvedValueOnce({ rows: [] })               // 7. idempotency transaction_logs
      .mockResolvedValueOnce({ rows: [] })               // 8. _log INSERT
      .mockResolvedValueOnce({ rows: [] });              // 9. UPDATE status BLOCKED

    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({
        clientId: 'client_001',
        amount: 1500,
        reference: 'FLEET-TEST-001',
        description: 'Test maintenance',
        external_order_id: 'ext_001',
        created_by: 'manager@fleet.ma',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.authorized).toBe(true);
    expect(res.body.wallet_order_id).toBeDefined();
    expect(res.body.status).toBe('BLOCKED');
    expect(res.body.amount_blocked).toBe(1500);
  });

  test('doit retourner 422 si solde insuffisant', async () => {
    // 422 : client check → ref unique → getClientWallet (getBalance) → balance insuffisante → rejet
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })  // 1. client check
      .mockResolvedValueOnce({ rows: [] })            // 2. ref unique
      .mockResolvedValueOnce({ rows: [mockWallet] }); // 3. getClientWallet (getBalance)

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 10000 }); // 1 MAD

    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({ clientId: 'client_001', amount: 99999, reference: 'FLEET-TEST-002' });

    expect(res.status).toBe(422);
    expect(res.body.authorized).toBe(false);
    expect(res.body.available_balance).toBeDefined();
  });

  test('doit retourner 409 si référence déjà utilisée', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // ref existe

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 50000000 });

    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({ clientId: 'client_001', amount: 1500, reference: 'FLEET-TEST-DOUBLON' });

    expect(res.status).toBe(409);
  });

  test('doit retourner 400 si champs requis manquants', async () => {
    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({ clientId: 'client_001' }); // amount et reference manquants

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app)
      .post('/orders/fleet')
      .send({ clientId: 'client_001', amount: 1500, reference: 'FLEET-TEST-003' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /orders/:id ──────────────────────────────────────────────────────────
describe('GET /orders/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner un order complet → 200', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [mockOrderFleet] });

    const res = await request(app)
      .get('/orders/42')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(42);
    expect(res.body.data.order_type).toBe('FLEET');
    expect(res.body.data.status).toBe('BLOCKED');
    expect(res.body.data.reference).toBe('FLEET-TEST-001');
  });

  test('doit retourner 404 si order inexistant', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/orders/9999')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/orders/42');
    expect(res.status).toBe(401);
  });
});

// ─── POST /orders/:id/confirm ─────────────────────────────────────────────────
describe('POST /orders/:id/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 15000000 }); // 1500 MAD
    blnkService.createTransaction = jest.fn().mockResolvedValue({ transaction_id: 'txn_confirm_001' });
    dolibarrService.createInvoice = jest.fn().mockResolvedValue(1);
    dolibarrService.createSupplierInvoice = jest.fn().mockResolvedValue(2);
  });

  test('doit confirmer une commande BLOCKED → 200 + status CONFIRMED', async () => {
    const confirmedOrder = { ...mockOrderFleet, status: 'CONFIRMED', confirmed_at: new Date() };
    // confirmOrder appelle dans l'ordre :
    // 1. SELECT order, 2. getClientWallet (confirm), 3. idempotency,
    // 4. SELECT client (dolibarr), 5. _log, 6. UPDATE CONFIRMED
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockOrderFleet] })     // 1. SELECT order (BLOCKED)
      .mockResolvedValueOnce({ rows: [mockWallet] })         // 2. getClientWallet
      .mockResolvedValueOnce({ rows: [] })                   // 3. idempotency
      .mockResolvedValueOnce({ rows: [{ name: 'Ahmed' }] })  // 4. SELECT client for dolibarr
      .mockResolvedValueOnce({ rows: [] })                   // 5. _log
      .mockResolvedValueOnce({ rows: [confirmedOrder] });    // 6. UPDATE CONFIRMED

    const res = await request(app)
      .post('/orders/42/confirm')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('doit retourner 422 si commande déjà CONFIRMED (double-confirmation → erreur propre)', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [{ ...mockOrderFleet, status: 'CONFIRMED' }]
    });

    const res = await request(app)
      .post('/orders/42/confirm')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/CONFIRMED/);
  });

  test('doit retourner 404 si commande inexistante', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/orders/9999/confirm')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });
});

// ─── POST /orders/:id/cancel ──────────────────────────────────────────────────
describe('POST /orders/:id/cancel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: 15000000 });
    blnkService.createTransaction = jest.fn().mockResolvedValue({ transaction_id: 'txn_cancel_001' });
  });

  test('doit annuler une commande BLOCKED → 200 + status CANCELLED', async () => {
    const cancelledOrder = { ...mockOrderFleet, status: 'CANCELLED', cancelled_at: new Date() };
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockOrderFleet] })   // get order (BLOCKED)
      .mockResolvedValueOnce({ rows: [mockWallet] })       // getClientWallet
      .mockResolvedValueOnce({ rows: [] })                 // idempotency
      .mockResolvedValueOnce({ rows: [] })                 // _log
      .mockResolvedValueOnce({ rows: [cancelledOrder] });  // update CANCELLED

    const res = await request(app)
      .post('/orders/42/cancel')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('doit retourner 422 si commande déjà CANCELLED', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [{ ...mockOrderFleet, status: 'CANCELLED' }]
    });

    const res = await request(app)
      .post('/orders/42/cancel')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(422);
  });

  test('doit retourner 404 si commande inexistante', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/orders/9999/cancel')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });
});

// ─── GET /orders/client/:clientId ─────────────────────────────────────────────
describe('GET /orders/client/:clientId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner la liste des orders du client avec pagination', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockOrderFleet, { ...mockOrderFleet, id: 43, reference: 'FLEET-TEST-002' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const res = await request(app)
      .get('/orders/client/client_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(2);
    expect(res.body.pagination.total).toBe(2);
  });

  test('doit retourner liste vide si aucun order', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const res = await request(app)
      .get('/orders/client/client_inexistant')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.orders.length).toBe(0);
    expect(res.body.pagination.total).toBe(0);
  });

  test('doit filtrer par order_type', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockOrderFleet] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const res = await request(app)
      .get('/orders/client/client_001?order_type=FLEET')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.orders[0].order_type).toBe('FLEET');
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/orders/client/client_001');
    expect(res.status).toBe(401);
  });
});