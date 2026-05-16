const ordersService = require('../services/orders.service');

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

    const { clientId, amount, reference, description, metadata, external_order_id } = req.body;

    const result = await ordersService.createExternalOrder({
      clientId,
      order_type,
      amount,
      reference,
      description,
      metadata,
      external_order_id,
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