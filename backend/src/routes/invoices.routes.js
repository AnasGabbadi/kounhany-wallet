const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const dolibarrService = require('../services/dolibarr.service');
const prestatairesService = require('../services/prestataires.service');

// POST /invoices/logistique/monthly
// Reçoit : { client_id, amount, reference, period, transport_ids }
// Crée une facture Dolibarr client pour la période.
// Idempotent : 409 si la référence existe déjà dans Dolibarr.
router.post('/logistique/monthly', async (req, res, next) => {
  try {
    const { client_id, amount, reference, period } = req.body;

    if (!client_id || !amount || !reference || !period) {
      return res.status(400).json({
        success: false,
        message: 'client_id, amount, reference, period sont requis',
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount doit être positif' });
    }

    // Idempotence — vérifie via ref_client Dolibarr
    try {
      const existing = await dolibarrService.findInvoiceByClientRef(reference);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Facture ${reference} déjà générée`,
          dolibarr_invoice_id: existing.id,
        });
      }
    } catch (err) {
      console.error('[Invoices] Erreur vérification idempotence Dolibarr:', err.message.slice(0, 200));
    }

    // Nom du client pour Dolibarr
    const clientResult = await pool.query(
      'SELECT name FROM clients WHERE client_id = $1',
      [client_id]
    );
    const clientName = clientResult.rows[0]?.name || client_id;

    const invoiceId = await dolibarrService.createInvoice({
      clientId: client_id,
      clientName,
      amount: parsedAmount,
      reference,
      description: `Facturation logistique ${period}`,
    });

    // Enregistrement dans orders — nécessaire pour la réconciliation Dolibarr sync
    await pool.query(
      `INSERT INTO orders (client_id, reference, amount, order_type, status, description)
       VALUES ($1, $2, $3, 'LOGISTIQUE', 'CONFIRMED', $4)
       ON CONFLICT (reference) DO NOTHING`,
      [client_id, reference, parsedAmount, `Facturation logistique ${period}`]
    );

    console.log(`[Invoices] Facture mensuelle logistique: ${reference} — client ${client_id}`);
    return res.status(201).json({
      success: true,
      data: { dolibarr_invoice_id: invoiceId, reference, period },
    });
  } catch (err) { next(err); }
});

// POST /invoices/logistique/supplier-monthly
// Reçoit : { prestataire_id, amount, reference, period }
// Crée une facture fournisseur Dolibarr pour le prestataire sur la période.
// Idempotent : 409 si la référence existe déjà dans prestataire_orders.
router.post('/logistique/supplier-monthly', async (req, res, next) => {
  try {
    const { prestataire_id, amount, reference, period } = req.body;

    if (!prestataire_id || !amount || !reference || !period) {
      return res.status(400).json({
        success: false,
        message: 'prestataire_id, amount, reference, period sont requis',
      });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, message: 'amount doit être positif' });
    }

    // Idempotence — vérifie prestataire_orders
    const existingOrder = await pool.query(
      'SELECT id FROM prestataire_orders WHERE reference = $1',
      [reference]
    );
    if (existingOrder.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Facture fournisseur ${reference} déjà générée`,
      });
    }

    // Récupérer le prestataire
    const presta = await prestatairesService.getOne(prestataire_id);
    if (!presta) {
      return res.status(404).json({
        success: false,
        message: `Prestataire ${prestataire_id} introuvable`,
      });
    }

    const invoiceId = await dolibarrService.createSupplierInvoice({
      prestataireId: prestataire_id,
      prestataireName: presta.name,
      amount: parsedAmount,
      description: `Prestation logistique ${period}`,
      reference,
    });

    // Enregistrement dans prestataire_orders
    await pool.query(
      `INSERT INTO prestataire_orders
       (prestataire_id, maintenance_ref, amount, reference, status, description, dolibarr_invoice_id)
       VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6)
       ON CONFLICT (reference) DO NOTHING`,
      [
        prestataire_id,
        reference,
        parsedAmount,
        reference,
        `Prestation logistique ${period}`,
        invoiceId,
      ]
    );

    console.log(`[Invoices] Facture fournisseur logistique: ${reference} — prestataire ${prestataire_id}`);
    return res.status(201).json({
      success: true,
      data: { dolibarr_invoice_id: invoiceId, reference, period },
    });
  } catch (err) { next(err); }
});

module.exports = router;
