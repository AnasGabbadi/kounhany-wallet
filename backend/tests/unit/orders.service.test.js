jest.mock('../../src/services/wallet.service');
jest.mock('../../src/services/blnk.service');
jest.mock('../../src/config/db');
jest.mock('../../src/services/dolibarr.service');

const ordersService = require('../../src/services/orders.service');
const walletService = require('../../src/services/wallet.service');
const pool = require('../../src/config/db');

const mockClient = { client_id: 'client_123', name: 'Test Client' };

const mockOrder = {
  id: 1,
  client_id: 'client_123',
  order_type: 'FLEET',
  amount: '1500.00',
  reference: 'CMD-FLEET-001',
  status: 'BLOCKED',
  description: 'Test',
  metadata: {},
  blnk_transaction_id: 'txn_123',
  confirmed_at: null,
  cancelled_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

// ─── createOrder FLEET ────────────────────────────────────────────────────────
describe('OrdersService — createOrder FLEET', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit créer une commande FLEET → BLOCKED', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })   // client check
      .mockResolvedValueOnce({ rows: [] })              // ref unique check
      .mockResolvedValueOnce({ rows: [{ ...mockOrder, status: 'PENDING' }] }) // insert
      .mockResolvedValueOnce({ rows: [] });             // update status

    walletService.getBalance = jest.fn().mockResolvedValue({ available: 10000, blocked: 0, receivable: 0 });
    walletService.block = jest.fn().mockResolvedValue({ transaction_id: 'txn_123' });

    const result = await ordersService.createOrder({
      clientId: 'client_123',
      order_type: 'FLEET',
      amount: 1500,
      reference: 'CMD-FLEET-001',
      description: 'Test FLEET',
    });

    expect(walletService.block).toHaveBeenCalledWith('client_123', 1500, 'CMD-FLEET-001', 'Test FLEET');
    expect(result.status).toBe('BLOCKED');
  });

  test('doit retourner 422 si solde insuffisant', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [] });

    walletService.getBalance = jest.fn().mockResolvedValue({ available: 100, blocked: 0, receivable: 0 });

    await expect(ordersService.createOrder({
      clientId: 'client_123',
      order_type: 'FLEET',
      amount: 99999,
      reference: 'CMD-FLEET-002',
    })).rejects.toMatchObject({ status: 422 });
  });

  test('doit retourner 409 si référence déjà utilisée', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // ref existe

    await expect(ordersService.createOrder({
      clientId: 'client_123',
      order_type: 'FLEET',
      amount: 1500,
      reference: 'CMD-FLEET-001',
    })).rejects.toMatchObject({ status: 409 });
  });

  test('doit retourner 404 si client introuvable', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.createOrder({
      clientId: 'client_inexistant',
      order_type: 'FLEET',
      amount: 1500,
      reference: 'CMD-FLEET-003',
    })).rejects.toMatchObject({ status: 404 });
  });
});

// ─── createOrder LOGISTIQUE ───────────────────────────────────────────────────
describe('OrdersService — createOrder LOGISTIQUE', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit créer une commande LOGISTIQUE → CONFIRMED direct', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...mockOrder, order_type: 'LOGISTIQUE', status: 'PENDING' }] })
      .mockResolvedValueOnce({ rows: [] });

    walletService.getBalance = jest.fn().mockResolvedValue({ available: 10000, blocked: 0, receivable: 0 });
    walletService.directConfirm = jest.fn().mockResolvedValue({ transaction_id: 'txn_log_123' });

    const result = await ordersService.createOrder({
      clientId: 'client_123',
      order_type: 'LOGISTIQUE',
      amount: 2000,
      reference: 'CMD-LOG-001',
      description: 'Mission logistique',
    });

    expect(walletService.directConfirm).toHaveBeenCalledWith('client_123', 2000, 'CMD-LOG-001', 'Mission logistique');
    expect(result.status).toBe('CONFIRMED');
  });
});

// ─── createOrder B2C ──────────────────────────────────────────────────────────
describe('OrdersService — createOrder B2C', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit créer une commande B2C → PAID direct', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockClient] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...mockOrder, order_type: 'B2C', status: 'PENDING' }] })
      .mockResolvedValueOnce({ rows: [] });

    walletService.pay = jest.fn().mockResolvedValue({ transaction_id: 'txn_b2c_123' });

    const result = await ordersService.createOrder({
      clientId: 'client_123',
      order_type: 'B2C',
      amount: 500,
      reference: 'CMD-B2C-001',
      description: 'Paiement CMI',
    });

    expect(walletService.pay).toHaveBeenCalledWith('client_123', 500, 'CMD-B2C-001', 'Paiement CMI');
    expect(result.status).toBe('PAID');
  });
});

// ─── confirmOrder ─────────────────────────────────────────────────────────────
describe('OrdersService — confirmOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit confirmer une commande BLOCKED → CONFIRMED', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockOrder] })      // get order
      .mockResolvedValueOnce({ rows: [mockOrder] });     // update

    walletService.confirm = jest.fn().mockResolvedValue({ transaction_id: 'txn_confirm_123' });

    const result = await ordersService.confirmOrder(1);
    expect(walletService.confirm).toHaveBeenCalledWith(
      'client_123',
      1500,
      'CONFIRM-CMD-FLEET-001',
      'Test'
    );
    expect(result.status).toBe('BLOCKED'); // retourne la row mockée
  });

  test('doit retourner 404 si commande introuvable', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.confirmOrder(999))
      .rejects.toMatchObject({ status: 404 });
  });

  test('doit retourner 422 si commande non BLOCKED', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [{ ...mockOrder, status: 'CONFIRMED' }]
    });

    await expect(ordersService.confirmOrder(1))
      .rejects.toMatchObject({ status: 422 });
  });
});

// ─── cancelOrder ──────────────────────────────────────────────────────────────
describe('OrdersService — cancelOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit annuler une commande BLOCKED → CANCELLED', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [mockOrder] })
      .mockResolvedValueOnce({ rows: [{ ...mockOrder, status: 'CANCELLED' }] });

    walletService.unblock = jest.fn().mockResolvedValue({ transaction_id: 'txn_cancel_123' });

    const result = await ordersService.cancelOrder(1);
    expect(walletService.unblock).toHaveBeenCalledWith(
      'client_123',
      1500,
      'CANCEL-CMD-FLEET-001',
      'Annulation commande CMD-FLEET-001'
    );
    expect(result.status).toBe('CANCELLED');
  });

  test('doit retourner 404 si commande introuvable', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({ rows: [] });

    await expect(ordersService.cancelOrder(999))
      .rejects.toMatchObject({ status: 404 });
  });

  test('doit retourner 422 si commande non BLOCKED', async () => {
    pool.query = jest.fn().mockResolvedValueOnce({
      rows: [{ ...mockOrder, status: 'CONFIRMED' }]
    });

    await expect(ordersService.cancelOrder(1))
      .rejects.toMatchObject({ status: 422 });
  });
});