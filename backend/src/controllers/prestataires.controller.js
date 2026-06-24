const pool = require('../config/db');
const dolibarrService = require('../services/dolibarr.service');
const prestatairesService = require('../services/prestataires.service');

const prestatairesController = {

  // Trouver ou créer un wallet prestataire
  async findOrCreate(req, res, next) {
    try {
      const { garage_uuid, name, email, phone } = req.body;
      const result = await prestatairesService.findOrCreate({ garage_uuid, name, email, phone });
      res.status(result.created ? 201 : 200).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // Liste tous les prestataires
  async list(req, res, next) {
    try {
      const prestataires = await prestatairesService.list();
      res.json({ success: true, data: prestataires });
    } catch (err) { next(err); }
  },

  // Détail d'un prestataire
  async getOne(req, res, next) {
    try {
      const { id } = req.params;
      // ✅ Fix 1 — utiliser prestatairesService.getOne() + variable correcte
      const prestataire = await prestatairesService.getOne(id);
      if (!prestataire) {
        return res.status(404).json({ success: false, message: 'Prestataire introuvable' });
      }
      res.json({ success: true, data: prestataire });
    } catch (err) { next(err); }
  },

  // Wallet complet d'un prestataire
  async getWallet(req, res, next) {
    try {
      const { id } = req.params;
      const wallet = await prestatairesService.getWallet(id);
      const txResult = await pool.query(
        'SELECT * FROM transaction_logs WHERE client_id = $1 ORDER BY created_at DESC',
        [id]
      );
      res.json({ success: true, data: { wallet, transactions: txResult.rows } });
    } catch (err) { next(err); }
  },

  // Commandes d'un prestataire
  async getOrders(req, res, next) {
    try {
      const { id } = req.params;
      const orders = await prestatairesService.getOrders(id);
      res.json({ success: true, data: orders });
    } catch (err) { next(err); }
  },

  // Trouver ou créer un prestataire pièces détachées (company Fleet)
  async findOrCreatePieces(req, res, next) {
    try {
      const { company_uuid, provider_name, company_name } = req.body;
      if (!company_uuid) {
        return res.status(400).json({ success: false, message: 'company_uuid est requis' });
      }
      const result = await prestatairesService.findOrCreatePieces({ company_uuid, provider_name, company_name });
      res.status(result.created ? 201 : 200).json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  // Créer facture fournisseur Dolibarr
  async createSupplierInvoice(req, res, next) {
    try {
      const { prestataire_id, reference } = req.body;
      const amount = parseFloat(req.body.amount);

      if (!prestataire_id || !reference || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'prestataire_id, reference et amount (> 0) sont requis',
        });
      }

      // ✅ Fix 2 — utiliser prestatairesService.getOne() + variable correcte
      const prestataire = await prestatairesService.getOne(prestataire_id);
      if (!prestataire) {
        return res.status(404).json({ success: false, message: 'Prestataire introuvable' });
      }

      const invoiceId = await dolibarrService.createSupplierInvoice({
        // ✅ Fix 3 — utiliser prestataire_id au lieu de pc.client_id (n'existe plus)
        prestataireId: prestataire.prestataire_id,
        prestataireName: prestataire.name,
        amount,
        description: `Service garage — ${reference}`,
        reference: `PRESTA-${reference}`,
      });

      // ✅ Fix 4 — prestataire_orders n'a pas order_type — colonnes correctes
      await pool.query(
        `INSERT INTO prestataire_orders 
         (prestataire_id, maintenance_ref, amount, reference, status, description, dolibarr_invoice_id)
         VALUES ($1, $2, $3, $4, 'CONFIRMED', $5, $6)
         ON CONFLICT (reference) DO NOTHING`,
        [
          prestataire_id,
          reference,
          amount,
          reference,
          `Service garage — ${reference}`,
          invoiceId,
        ]
      );

      // Invalider cache après création
      await prestatairesService.invalidateCache(prestataire_id);

      res.json({ success: true, data: { invoice_id: invoiceId } });
    } catch (err) { next(err); }
  },
};

module.exports = prestatairesController;