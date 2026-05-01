jest.mock('../../src/services/blnk.service');
jest.mock('../../src/config/db');

const platformService = require('../../src/services/platform.service');
const blnkService = require('../../src/services/blnk.service');
const pool = require('../../src/config/db');

describe('Platform Service — init', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ne doit pas recréer les comptes si déjà initialisés', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [1, 2, 3] });

    await platformService.init();
    expect(blnkService.createLedger).not.toHaveBeenCalled();
  });

  test('doit créer les 3 comptes plateforme si non initialisés', async () => {
    pool.query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValue({ rows: [] });

    blnkService.createLedger = jest.fn().mockResolvedValue({
      ledger_id: 'ldg_platform',
      name: 'Kounhany_Platform',
    });

    blnkService.createBalance = jest.fn().mockResolvedValue({
      balance_id: 'bln_platform_test',
      balance: 0,
    });

    await platformService.init();
    expect(blnkService.createLedger).toHaveBeenCalledWith('platform', 'Kounhany_Platform');
    expect(blnkService.createBalance).toHaveBeenCalledTimes(3);
  });

  test('doit gérer les erreurs sans crasher', async () => {
    pool.query = jest.fn().mockRejectedValue(new Error('DB error'));
    await expect(platformService.init()).resolves.not.toThrow();
  });
});

describe('Platform Service — getAccount', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit retourner le compte plateforme', async () => {
    pool.query = jest.fn().mockResolvedValue({
      rows: [{ account_key: 'revenue', balance_id: 'bln_revenue' }],
    });

    const result = await platformService.getAccount('revenue');
    expect(result.account_key).toBe('revenue');
    expect(result.balance_id).toBe('bln_revenue');
  });

  test('doit lancer une erreur si compte introuvable', async () => {
    pool.query = jest.fn().mockResolvedValue({ rows: [] });

    await expect(platformService.getAccount('inexistant'))
      .rejects.toThrow('Platform account inexistant not found');
  });
});