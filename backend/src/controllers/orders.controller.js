const ordersService = require('../services/orders.service');
const pool = require('../config/db');

// ── Validation commune ────────────────────────────────────────────────────────
const validateOrderBody = (body) => {
  const { clientId, amount, reference } = body;
  if (!clientId || !amount || !reference) {
    return 'Champs requis : clientId, amount, reference';
  }
  if (amount <= 0) {
    return 'Le montant doit être positif';
  }
  return null;
};

// ── Handler générique externe ─────────────────────────────────────────────────
const handleExternalOrder = async (req, res, next, order_type) => {
  try {
    const validationError = validateOrderBody(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    const { clientId, amount, reference, description, metadata, external_order_id, created_by } = req.body;

    const result = await ordersService.createExternalOrder({
      clientId,
      order_type,
      amount,
      reference,
      description,
      metadata,
      external_order_id,
      created_by,
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err.status === 422) {
      return res.status(422).json({
        success: false,
        authorized: false,
        message: err.message,
        available_balance: err.available,
        required_amount: err.required,
      });
    }
    if (err.status) return res.status(err.status).json({ success: false, error: err.message });
    next(err);
  }
};

// ── Endpoints dédiés par app ──────────────────────────────────────────────────

// POST /orders/fleet — Fleet App
exports.createFleetOrder = (req, res, next) =>
  handleExternalOrder(req, res, next, 'FLEET');

// POST /orders/logistique — Logistique App
exports.createLogistiqueOrder = (req, res, next) =>
  handleExternalOrder(req, res, next, 'LOGISTIQUE');

// POST /orders/b2c — B2C App
exports.createB2COrder = (req, res, next) =>
  handleExternalOrder(req, res, next, 'B2C');

// ── Endpoints dashboard admin ─────────────────────────────────────────────────

// GET /orders/client/:clientId
exports.getClientOrders = async (req, res, next) => {
  try {
    const { order_type, status, page, limit } = req.query;
    const result = await ordersService.getClientOrders(
      req.params.clientId,
      { order_type, status, page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// GET /orders
exports.getAllOrders = async (req, res, next) => {
  try {
    const { order_type, status, page, limit } = req.query;
    const result = await ordersService.getAllOrders({
      order_type, status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// POST /orders/:id/confirm
exports.confirmOrder = async (req, res, next) => {
  try {
    const result = await ordersService.confirmOrder(parseInt(req.params.id));
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

// POST /orders/:id/cancel
exports.cancelOrder = async (req, res, next) => {
  try {
    const result = await ordersService.cancelOrder(parseInt(req.params.id));
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

exports.updateMetadata = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body;
    const result = await pool.query(
      `UPDATE orders
       SET metadata = metadata || $1::jsonb, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [JSON.stringify(metadata), id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, message: 'Order introuvable' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /orders/:id/validate-invoices — appelé par Kounhany quand le garagiste soumet le certificat
exports.validateInvoices = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: `Order ${id} introuvable` });
    }

    const order = result.rows[0];

    if (!process.env.DOLIBARR_URL || !process.env.DOLIBARR_API_KEY) {
      return res.status(503).json({ success: false, message: 'Dolibarr non configuré' });
    }

    const dolibarrService = require('../services/dolibarr.service');
    const invoiceResults = await dolibarrService.validateOrderInvoices(order.reference);

    console.log(`[ValidateInvoices] Order ${id} (${order.reference}) — résultats:`, JSON.stringify(invoiceResults));

    const hasErrors = invoiceResults.errors.length > 0;
    return res.status(hasErrors ? 207 : 200).json({
      success: true,
      order_id: id,
      reference: order.reference,
      invoices: invoiceResults,
      warnings: hasErrors ? invoiceResults.errors : undefined,
    });
  } catch (err) {
    next(err);
  }
};