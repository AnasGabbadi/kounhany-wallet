process.env.NODE_ENV = 'test';
process.env.DOLIBARR_URL = 'http://dolibarr:80';
process.env.DOLIBARR_API_KEY = 'test-key';
process.env.DOLIBARR_ENTITY = '1';

jest.mock('axios');
jest.mock('../../src/config/db');

const axios = require('axios');
const pool = require('../../src/config/db');

// Mock axios.create
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
};
axios.create = jest.fn(() => mockAxiosInstance);

const dolibarrService = require('../../src/services/dolibarr.service');

describe('dolibarrService.ping', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner le statut Dolibarr', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: { success: { code: 200, dolibarr_version: '23.0.2' } },
    });

    const result = await dolibarrService.ping();
    expect(result.success.code).toBe(200);
    expect(result.success.dolibarr_version).toBe('23.0.2');
  });

  test('doit lever une erreur si Dolibarr inaccessible', async () => {
    mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));
    await expect(dolibarrService.ping()).rejects.toThrow('Connection refused');
  });
});

describe('dolibarrService.createInvoice', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit créer une facture et retourner son ID', async () => {
    // Mock _getOrCreateThirdParty
    mockAxiosInstance.get.mockResolvedValue({ data: [{ id: 1 }] });
    mockAxiosInstance.post.mockResolvedValue({ data: 1 });

    const result = await dolibarrService.createInvoice({
      clientId: 'client_001',
      clientName: 'Ahmed Alami',
      amount: 1500,
      description: 'Test facture',
      reference: 'REF-001',
    });

    expect(result).toBe(1);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/invoices',
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ subprice: 1500 }),
        ]),
      })
    );
  });
});

describe('dolibarrService.getUnpaidInvoices', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les factures non payées', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: [
        { id: '1', ref: 'FA-001', total_ttc: 1500, statut: '0' },
        { id: '2', ref: 'FA-002', total_ttc: 800, statut: '0' },
      ],
    });

    const result = await dolibarrService.getUnpaidInvoices();
    expect(result).toHaveLength(2);
  });

  test('doit retourner tableau vide si 404', async () => {
    mockAxiosInstance.get.mockRejectedValue({ response: { status: 404 } });
    const result = await dolibarrService.getUnpaidInvoices();
    expect(result).toHaveLength(0);
  });
});

describe('dolibarrService.getRecentPayments', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner les paiements récents', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockAxiosInstance.get.mockResolvedValue({
      data: [
        { id: '1', amount: '1500', datepaye: String(now), fk_facture: '1' },
        { id: '2', amount: '800', datepaye: String(now), fk_facture: '2' },
      ],
    });

    const result = await dolibarrService.getRecentPayments(Date.now() - 60000);
    expect(result).toHaveLength(2);
  });

  test('doit retourner tableau vide si 501', async () => {
    mockAxiosInstance.get.mockRejectedValue({ response: { status: 501 } });
    const result = await dolibarrService.getRecentPayments(Date.now());
    expect(result).toHaveLength(0);
  });

  test('doit gérer un objet au lieu d un tableau', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockAxiosInstance.get.mockResolvedValue({
      data: { 0: { id: '1', amount: '500', datepaye: String(now), fk_facture: '1' } },
    });

    const result = await dolibarrService.getRecentPayments(Date.now() - 60000);
    expect(result).toHaveLength(1);
  });
});

describe('dolibarrService._getOrCreateThirdParty', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner ID si tiers existe', async () => {
    mockAxiosInstance.get.mockResolvedValue({
      data: [{ id: 5, name: 'Ahmed Alami' }],
    });

    const result = await dolibarrService._getOrCreateThirdParty('client_001', 'Ahmed Alami');
    expect(result).toBe(5);
    expect(mockAxiosInstance.post).not.toHaveBeenCalled();
  });

  test('doit créer le tiers s il n existe pas', async () => {
    mockAxiosInstance.get.mockResolvedValue({ data: [] });
    mockAxiosInstance.post.mockResolvedValue({ data: 3 });

    const result = await dolibarrService._getOrCreateThirdParty('client_002', 'Sara Benali');
    expect(result).toBe(3);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/thirdparties',
      expect.objectContaining({ name: 'Sara Benali', ref_ext: 'client_002' })
    );
  });
});