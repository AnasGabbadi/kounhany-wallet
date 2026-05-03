const walletService = require('../services/wallet.service');

const walletController = {

    async checkAvailable(req, res, next) {
        try {
            const { client_id, amount } = req.body;
            const result = await walletService.checkAvailable(client_id, amount);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async block(req, res, next) {
        try {
            const { client_id, amount, reference, description } = req.body;
            const result = await walletService.block(client_id, amount, reference, description);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async confirm(req, res, next) {
        try {
            const { client_id, amount, reference, description } = req.body;
            const result = await walletService.confirm(client_id, amount, reference, description);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async pay(req, res, next) {
        try {
            const { client_id, amount, reference, description } = req.body;
            const result = await walletService.pay(client_id, amount, reference, description);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async getBalance(req, res, next) {
        try {
            const { clientId } = req.params;
            const result = await walletService.getBalance(clientId);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async getTransactions(req, res, next) {
        try {
            const { clientId } = req.params;
            const result = await walletService.getTransactions(clientId);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async externalDebt(req, res, next) {
        try {
            const { client_id, amount, reference, description } = req.body;
            const result = await walletService.externalDebt(client_id, amount, reference, description);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async externalPayment(req, res, next) {
        try {
            const { client_id, amount, reference, description } = req.body;
            const result = await walletService.externalPayment(client_id, amount, reference, description);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async unblock(req, res, next) {
        try {
            const { client_id, amount, reference, description } = req.body;
            const result = await walletService.unblock(client_id, amount, reference, description);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
};

module.exports = walletController;