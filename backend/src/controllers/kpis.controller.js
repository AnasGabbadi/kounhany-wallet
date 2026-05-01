const kpisService = require('../services/kpis.service');

const kpisController = {
    async overview(req, res, next) {
        try {
            const { period = 'all' } = req.query;
            const result = await kpisService.getOverview(period);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async transactionsTrend(req, res, next) {
        try {
            const { days = 7 } = req.query;
            const result = await kpisService.getTransactionsTrend(parseInt(days));
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async topClients(req, res, next) {
        try {
            const result = await kpisService.getTopClients();
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async alerts(req, res, next) {
        try {
            const result = await kpisService.getAlerts();
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    async systemInfo(req, res, next) {
        try {
            const result = await kpisService.getSystemInfo();
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
};

module.exports = kpisController;