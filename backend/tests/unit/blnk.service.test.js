jest.mock('../../src/config/blnk');

const blnkClient = require('../../src/config/blnk');
const blnkService = require('../../src/services/blnk.service');

describe('Blnk Service', () => {
    beforeEach(() => jest.clearAllMocks());

    test('createLedger doit appeler POST /ledgers', async () => {
        blnkClient.post = jest.fn().mockResolvedValue({
            data: { ledger_id: 'ldg_123', name: 'Ledger_Test' },
        });

        const result = await blnkService.createLedger('client_123', 'Test');
        expect(blnkClient.post).toHaveBeenCalledWith('/ledgers', expect.objectContaining({
            name: 'Ledger_Test',
        }));
        expect(result.ledger_id).toBe('ldg_123');
    });

    test('createBalance doit appeler POST /balances', async () => {
        blnkClient.post = jest.fn().mockResolvedValue({
            data: { balance_id: 'bln_123', balance: 0 },
        });

        const result = await blnkService.createBalance('ldg_123', 'MAD', 'available', 'client_123');
        expect(blnkClient.post).toHaveBeenCalledWith('/balances', expect.objectContaining({
            ledger_id: 'ldg_123',
            currency: 'MAD',
        }));
        expect(result.balance_id).toBe('bln_123');
    });

    test('getBalance doit appeler GET /balances/:id', async () => {
        blnkClient.get = jest.fn().mockResolvedValue({
            data: { balance_id: 'bln_123', balance: 10000 },
        });

        const result = await blnkService.getBalance('bln_123');
        expect(blnkClient.get).toHaveBeenCalledWith('/balances/bln_123');
        expect(result.balance).toBe(10000);
    });

    test('createTransaction doit appeler POST /transactions', async () => {
        blnkClient.post = jest.fn().mockResolvedValue({
            data: { transaction_id: 'txn_123', status: 'QUEUED' },
        });

        const result = await blnkService.createTransaction({
            amount: 10000,
            currency: 'MAD',
            reference: 'REF-001',
            description: 'Test',
            source: 'bln_available',
            destination: 'bln_blocked',
        });

        expect(blnkClient.post).toHaveBeenCalledWith('/transactions', expect.objectContaining({
            amount: 10000,
            reference: 'REF-001',
        }));
        expect(result.transaction_id).toBe('txn_123');
    });

    test('createTransaction doit gérer les erreurs Blnk', async () => {
        const blnkError = new Error('INTERNAL_SERVER_ERROR');
        blnkError.status = 500;
        blnkClient.post = jest.fn().mockRejectedValue(blnkError);

        await expect(blnkService.createTransaction({
            amount: 100,
            currency: 'MAD',
            reference: 'REF-ERR',
            source: 'bln_a',
            destination: 'bln_b',
        })).rejects.toThrow();
    });

    test('getTransactions doit appeler GET /balances/:id/transactions', async () => {
        blnkClient.get = jest.fn().mockResolvedValue({
            data: [{ transaction_id: 'txn_1' }, { transaction_id: 'txn_2' }],
        });

        const result = await blnkService.getTransactions('bln_123');
        expect(blnkClient.get).toHaveBeenCalledWith('/balances/bln_123/transactions');
        expect(result.length).toBe(2);
    });
});