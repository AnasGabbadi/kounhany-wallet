const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.API_KEY = 'test-api-key';
process.env.BLNK_URL = 'http://localhost:5001';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'kounhany';
process.env.DB_PASSWORD = 'kounhany2024';
process.env.DB_NAME = 'kounhany_db';
process.env.DOLIBARR_URL = 'http://dolibarr:80';
process.env.DOLIBARR_API_KEY = 'test-dolibarr-key';
process.env.DOLIBARR_ENTITY = '1';

jest.mock('../../src/services/dolibarr.service');
jest.mock('../../src/services/dolibarr.sync');
jest.mock('../../src/config/db');

const dolibarrService = require('../../src/services/dolibarr.service');
const dolibarrSync = require('../../src/services/dolibarr.sync');
const pool = require('../../src/config/db');
const app = require('../../src/app');

describe('GET /dolibarr/status', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner connected: true si Dolibarr répond', async () => {
    dolibarrService.ping = jest.fn().mockResolvedValue({
      success: { code: 200, dolibarr_version: '23.0.2', environment: 'non-production' },
    });

    const res = await request(app)
      .get('/dolibarr/status')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(true);
    expect(res.body.data.dolibarr_version).toBe('23.0.2');
  });

  test('doit retourner connected: false si Dolibarr inaccessible', async () => {
    dolibarrService.ping = jest.fn().mockRejectedValue(new Error('Connection refused'));

    const res = await request(app)
      .get('/dolibarr/status')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(503);
    expect(res.body.data.connected).toBe(false);
  });

  test('doit retourner connected: false si variables manquantes', async () => {
    const savedUrl = process.env.DOLIBARR_URL;
    delete process.env.DOLIBARR_URL;

    const res = await request(app)
      .get('/dolibarr/status')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);

    process.env.DOLIBARR_URL = savedUrl;
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/dolibarr/status');
    expect(res.status).toBe(401);
  });
});

describe('GET /dolibarr/invoices', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner la liste des factures', async () => {
    dolibarrService.getUnpaidInvoices = jest.fn().mockResolvedValue([
      { id: '1', ref: 'FA2024-001', total_ttc: 1500, status: 'unpaid' },
      { id: '2', ref: 'FA2024-002', total_ttc: 800, status: 'unpaid' },
    ]);

    const res = await request(app)
      .get('/dolibarr/invoices')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  test('doit retourner un tableau vide si aucune facture', async () => {
    dolibarrService.getUnpaidInvoices = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/dolibarr/invoices')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/dolibarr/invoices');
    expect(res.status).toBe(401);
  });
});

describe('GET /dolibarr/invoices/:clientId', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les factures d un client', async () => {
    pool.query = jest.fn().mockResolvedValue({
      rows: [{ client_id: 'client_001', name: 'Ahmed Alami' }],
    });

    dolibarrService._getOrCreateThirdParty = jest.fn().mockResolvedValue(1);

    dolibarrService.getClientInvoices = jest.fn().mockResolvedValue([
      { id: '1', ref: 'FA2024-001', total_ttc: 500, status: 'unpaid' },
    ]);

    const res = await request(app)
      .get('/dolibarr/invoices/client_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.client_id).toBe('client_001');
    expect(res.body.data.invoices).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  test('doit retourner 404 si client introuvable', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    const res = await request(app)
      .get('/dolibarr/invoices/client_inexistant')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(404);
  });

  test('doit retourner tableau vide si aucune facture pour ce client', async () => {
    pool.query = jest.fn().mockResolvedValue({
      rows: [{ client_id: 'client_001', name: 'Ahmed Alami' }],
    });

    dolibarrService._getOrCreateThirdParty = jest.fn().mockResolvedValue(1);
    dolibarrService.getClientInvoices = jest.fn().mockResolvedValue([]);

    const res = await request(app)
      .get('/dolibarr/invoices/client_001')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).get('/dolibarr/invoices/client_001');
    expect(res.status).toBe(401);
  });
});

describe('POST /dolibarr/sync', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit effectuer la synchronisation', async () => {
    dolibarrSync.syncPayments = jest.fn().mockResolvedValue();

    const res = await request(app)
      .post('/dolibarr/sync')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Synchronisation effectuée');
    expect(dolibarrSync.syncPayments).toHaveBeenCalledTimes(1);
  });

  test('doit retourner 503 si Dolibarr non configuré', async () => {
    const savedUrl = process.env.DOLIBARR_URL;
    const savedKey = process.env.DOLIBARR_API_KEY;
    delete process.env.DOLIBARR_URL;
    delete process.env.DOLIBARR_API_KEY;

    const res = await request(app)
      .post('/dolibarr/sync')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(503);

    process.env.DOLIBARR_URL = savedUrl;
    process.env.DOLIBARR_API_KEY = savedKey;
  });

  test('doit retourner 401 sans API key', async () => {
    const res = await request(app).post('/dolibarr/sync');
    expect(res.status).toBe(401);
  });
});