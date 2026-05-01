const dolibarrService = require('../services/dolibarr.service');
const dolibarrSync = require('../services/dolibarr.sync');
const pool = require('../config/db');

const dolibarrController = {

  async getStatus(req, res, next) {
    try {
      if (!process.env.DOLIBARR_URL || !process.env.DOLIBARR_API_KEY) {
        return res.json({
          success: true,
          data: {
            connected: false,
            reason: 'Variables DOLIBARR_URL et DOLIBARR_API_KEY non configurées',
          },
        });
      }

      const status = await dolibarrService.ping();
      res.json({
        success: true,
        data: {
          connected: true,
          dolibarr_version: status.success?.dolibarr_version,
          environment: status.success?.environment,
          url: process.env.DOLIBARR_URL,
        },
      });
    } catch (err) {
      res.status(503).json({
        success: false,
        data: {
          connected: false,
          reason: 'Dolibarr inaccessible',
        },
      });
    }
  },

  async getInvoices(req, res, next) {
    try {
      const invoices = await dolibarrService.getUnpaidInvoices();
      res.json({ success: true, data: invoices });
    } catch (err) { next(err); }
  },

  async getClientInvoices(req, res, next) {
    try {
      const { clientId } = req.params;

      // Vérifier que le client existe
      const client = await pool.query(
        'SELECT * FROM clients WHERE client_id = $1',
        [clientId]
      );
      if (client.rows.length === 0) {
        const err = new Error('Client introuvable');
        err.status = 404;
        throw err;
      }

      // Récupérer le tiers Dolibarr lié à ce client
      const socid = await dolibarrService._getOrCreateThirdParty(
        clientId,
        client.rows[0].name
      );

      // Récupérer les factures de ce tiers
      const invoices = await dolibarrService.getClientInvoices(socid);

      res.json({
        success: true,
        data: {
          client_id: clientId,
          client_name: client.rows[0].name,
          invoices,
          total: invoices.length,
        },
      });
    } catch (err) { next(err); }
  },

  async forceSync(req, res, next) {
    try {
      if (!process.env.DOLIBARR_URL || !process.env.DOLIBARR_API_KEY) {
        return res.status(503).json({
          success: false,
          message: 'Dolibarr non configuré',
        });
      }

      await dolibarrSync.syncPayments();

      res.json({
        success: true,
        message: 'Synchronisation effectuée',
        timestamp: new Date().toISOString(),
      });
    } catch (err) { next(err); }
  },
};

module.exports = dolibarrController;