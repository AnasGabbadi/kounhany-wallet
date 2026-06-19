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

  async webhook(req, res, next) {
    try {
      const { action, object, object_id } = req.body;
      console.log(`[Dolibarr Webhook] Action: ${action} — Object: ${object} — ID: ${object_id}`);

      // Déclencher sync uniquement si paiement ajouté sur une facture
      if (action === 'PAYMENT_ADD' || action === 'BILL_PAYED') {
        await dolibarrSync.syncPayments();
        console.log(`[Dolibarr Webhook] ✅ Sync déclenché après paiement`);
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async getPrestaInvoices(req, res, next) {
    try {
      const { prestataireId } = req.params;
      const invoices = await dolibarrService.getSupplierInvoicesByPrestataire(prestataireId);
      res.json({
        success: true,
        data: { client_id: prestataireId, invoices, total: invoices.length },
      });
    } catch (err) { next(err); }
  },

  async createB2CInvoice(req, res, next) {
    try {
      const { clientId, clientName, amount, reference, description } = req.body;

      if (!clientId || !clientName || !amount) {
        return res.status(400).json({ success: false, message: 'clientId, clientName et amount sont requis' });
      }

      // Idempotence : éviter la double facturation sur la même référence
      if (reference) {
        const existing = await pool.query(
          'SELECT dolibarr_invoice_id FROM orders WHERE reference = $1 AND dolibarr_invoice_id IS NOT NULL',
          [reference]
        );
        if (existing.rows.length > 0) {
          return res.json({
            success: true,
            data: { invoice_id: existing.rows[0].dolibarr_invoice_id, created: false },
          });
        }
      }

      const invoiceId = await dolibarrService.createInvoice({
        clientId,
        clientName,
        amount: parseFloat(amount),
        reference: reference || `B2C-${Date.now()}`,
        description: description || 'Paiement B2C Kounhany',
      });

      // Stocker l'invoice_id sur l'order wallet si la référence existe
      if (reference && invoiceId) {
        await pool.query(
          'UPDATE orders SET dolibarr_invoice_id = $1, updated_at = NOW() WHERE reference = $2',
          [invoiceId, reference]
        );
      }

      res.status(201).json({ success: true, data: { invoice_id: invoiceId, created: true } });
    } catch (err) { next(err); }
  },
};

module.exports = dolibarrController;