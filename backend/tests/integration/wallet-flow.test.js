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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CLIENT_ID = 'company_fleet_test_001';

const mockWallet = {
  client_id: CLIENT_ID,
  ledger_id: 'ldg_flow_001',
  available_balance_id: 'bln_flow_available',
  blocked_balance_id: 'bln_flow_blocked',
  receivable_balance_id: 'bln_flow_receivable',
  currency: 'MAD',
};

const mockClient = {
  id: 10,
  client_id: CLIENT_ID,
  name: 'Fleet Company SA',
  email: 'fleet@company.ma',
  active: true,
  created_at: new Date(),
};

const makeOrder = (overrides = {}) => ({
  id: 100,
  client_id: CLIENT_ID,
  order_type: 'FLEET',
  amount: '1500.00',
  reference: 'FLEET-FLOW-001',
  description: 'Flow test',
  status: 'BLOCKED',
  metadata: {},
  blnk_transaction_id: 'txn_flow_001',
  dolibarr_invoice_id: null,
  confirmed_at: null,
  cancelled_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: 'manager@fleet.ma',
  ...overrides,
});

// Blnk balance helper : amount MAD → balance Blnk (amount * 10000)
const blnkBal = (mad) => mad * 10000;

// ─── Flow complet FLEET : BLOCK → CONFIRM ─────────────────────────────────────
describe('Wallet Flow — FLEET BLOCK → CONFIRM', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dolibarrService.createInvoice = jest.fn().mockResolvedValue(1);
    dolibarrService.createSupplierInvoice = jest.fn().mockResolvedValue(2);
  });

  test('BLOCK : Available diminue, Blocked augmente', async () => {
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: blnkBal(5000) });
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_block_001',
      status: 'APPLIED',
    });

    // 9 appels pool.query : client, ref, getWallet×3, insert, idempotency, _log, update
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })    // 1. client check
      .mockResolvedValueOnce({ rows: [] })              // 2. ref unique
      .mockResolvedValueOnce({ rows: [mockWallet] })    // 3. getClientWallet (getBalance)
      .mockResolvedValueOnce({ rows: [makeOrder()] })   // 4. INSERT order
      .mockResolvedValueOnce({ rows: [mockWallet] })    // 5. getClientWallet (checkAvailable)
      .mockResolvedValueOnce({ rows: [mockWallet] })    // 6. getClientWallet (block)
      .mockResolvedValueOnce({ rows: [] })              // 7. idempotency
      .mockResolvedValueOnce({ rows: [] })              // 8. _log
      .mockResolvedValueOnce({ rows: [] });             // 9. UPDATE BLOCKED

    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({
        clientId: CLIENT_ID,
        amount: 1500,
        reference: 'FLEET-FLOW-001',
        description: 'Test flow BLOCK',
        external_order_id: 'ext_flow_001',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('BLOCKED');
    expect(res.body.amount_blocked).toBe(1500);
    expect(blnkService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'bln_flow_available',
        destination: 'bln_flow_blocked',
        amount: 150000, // 1500 * 100 (wallet.service envoie amount*100 à Blnk)
      })
    );
  });

  test('CONFIRM : Blocked diminue, Receivable augmente', async () => {
    const blockedOrder = makeOrder({ status: 'BLOCKED' });
    const confirmedOrder = makeOrder({ status: 'CONFIRMED', confirmed_at: new Date() });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: blnkBal(1500) });
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_confirm_001',
      status: 'APPLIED',
    });

    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [blockedOrder] })           // get order
      .mockResolvedValueOnce({ rows: [mockWallet] })             // getClientWallet
      .mockResolvedValueOnce({ rows: [] })                       // idempotency
      .mockResolvedValueOnce({ rows: [{ name: 'Fleet SA' }] })  // client for dolibarr
      .mockResolvedValueOnce({ rows: [] })                       // _log
      .mockResolvedValueOnce({ rows: [confirmedOrder] });        // update CONFIRMED

    const res = await request(app)
      .post('/orders/100/confirm')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    // Vérifie que le CONFIRM Blnk : source=blocked, dest=receivable
    expect(blnkService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'bln_flow_blocked',
        destination: 'bln_flow_receivable',
      })
    );
  });

  test('Flux complet BLOCK → balance correcte avant et après', async () => {
    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: blnkBal(5000) });
    blnkService.createTransaction = jest.fn().mockResolvedValue({ transaction_id: 'txn_001' });

    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })    // client check
      .mockResolvedValueOnce({ rows: [] })              // ref unique
      .mockResolvedValueOnce({ rows: [mockWallet] })    // getClientWallet (getBalance)
      .mockResolvedValueOnce({ rows: [makeOrder()] })   // INSERT order
      .mockResolvedValueOnce({ rows: [mockWallet] })    // getClientWallet (checkAvailable)
      .mockResolvedValueOnce({ rows: [mockWallet] })    // getClientWallet (block)
      .mockResolvedValueOnce({ rows: [] })              // idempotency
      .mockResolvedValueOnce({ rows: [] })              // _log
      .mockResolvedValueOnce({ rows: [] });             // UPDATE BLOCKED

    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({ clientId: CLIENT_ID, amount: 1500, reference: 'FLEET-FLOW-BAL' });

    expect(res.status).toBe(201);
    expect(blnkService.createTransaction).toHaveBeenCalledTimes(1);
  });
});

// ─── Flow CANCEL : BLOCK → CANCEL → Available restauré ───────────────────────
describe('Wallet Flow — FLEET BLOCK → CANCEL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dolibarrService.createInvoice = jest.fn().mockResolvedValue(1);
  });

  test('CANCEL : Blocked diminue, Available restauré', async () => {
    const blockedOrder = makeOrder({ status: 'BLOCKED' });
    const cancelledOrder = makeOrder({ status: 'CANCELLED', cancelled_at: new Date() });

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: blnkBal(1500) });
    blnkService.createTransaction = jest.fn().mockResolvedValue({
      transaction_id: 'txn_unblock_001',
      status: 'APPLIED',
    });

    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [blockedOrder] })
      .mockResolvedValueOnce({ rows: [mockWallet] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [cancelledOrder] });

    const res = await request(app)
      .post('/orders/100/cancel')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    // UNBLOCK Blnk : source=blocked, dest=available
    expect(blnkService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'bln_flow_blocked',
        destination: 'bln_flow_available',
      })
    );
  });

  test('CANCEL sur commande déjà CANCELLED → 422', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [makeOrder({ status: 'CANCELLED' })]
    });

    const res = await request(app)
      .post('/orders/100/cancel')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(422);
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
  });
});

// ─── Flow double-confirmation : BLOCK → CONFIRM → CONFIRM (guard) ─────────────
describe('Wallet Flow — double-confirmation guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dolibarrService.createInvoice = jest.fn().mockResolvedValue(1);
  });

  test('deuxième CONFIRM retourne 422 sans toucher Blnk', async () => {
    // Simule order déjà CONFIRMED
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [makeOrder({ status: 'CONFIRMED', confirmed_at: new Date() })]
    });

    const res = await request(app)
      .post('/orders/100/confirm')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/CONFIRMED/);
    // Blnk ne doit pas être appelé une seconde fois
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
  });

  test('solde Blnk ne change pas sur double-confirm (idempotence)', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [makeOrder({ status: 'CONFIRMED' })]
    });
    blnkService.createTransaction = jest.fn();

    await request(app)
      .post('/orders/100/confirm')
      .set('x-api-key', 'test-api-key');

    expect(blnkService.createTransaction).toHaveBeenCalledTimes(0);
  });

  test('CONFIRM sur CANCELLED retourne 422 (pas de crash)', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [makeOrder({ status: 'CANCELLED' })]
    });

    const res = await request(app)
      .post('/orders/100/confirm')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── Idempotency des références ───────────────────────────────────────────────
describe('Wallet Flow — idempotency des références', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dolibarrService.createInvoice = jest.fn().mockResolvedValue(1);
  });

  test('POST /orders/fleet avec référence dupliquée → 409 sans double Blnk', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // ref existe

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: blnkBal(5000) });

    const res = await request(app)
      .post('/orders/fleet')
      .set('x-api-key', 'test-api-key')
      .send({ clientId: CLIENT_ID, amount: 1500, reference: 'FLEET-DOUBLON' });

    expect(res.status).toBe(409);
    expect(blnkService.createTransaction).not.toHaveBeenCalled();
  });

  test('wallet.block avec même référence → retourne transaction existante', async () => {
    const walletService = require('../../src/services/wallet.service');

    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockWallet] })              // checkAvailable → getClientWallet
      .mockResolvedValueOnce({ rows: [mockWallet] })              // getClientWallet
      .mockResolvedValueOnce({ rows: [{ reference: 'REF-IDEM', transaction_id: 'txn_existing' }] }); // idempotency hit

    blnkService.getBalance = jest.fn().mockResolvedValue({ balance: blnkBal(5000) });

    const result = await walletService.block(CLIENT_ID, 100, 'REF-IDEM', 'Test idempotency');

    expect(blnkService.createTransaction).not.toHaveBeenCalled();
    expect(result.reference).toBe('REF-IDEM');
    expect(result.transaction_id).toBe('txn_existing');
  });
});
