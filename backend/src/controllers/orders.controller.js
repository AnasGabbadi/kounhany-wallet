// backend/src/controllers/orders.controller.js
const ordersService = require('../services/orders.service');

// POST /orders
exports.createOrder = async (req, res, next) => {
  try {
    const { clientId, order_type, amount, description, reference, metadata } = req.body;

    if (!clientId || !order_type || !amount || !reference) {
      return res.status(400).json({
        error: 'Champs requis : clientId, order_type, amount, reference'
      });
    }
    if (!['FLEET', 'LOGISTIQUE', 'B2C'].includes(order_type)) {
      return res.status(400).json({
        error: 'order_type invalide — valeurs : FLEET, LOGISTIQUE, B2C'
      });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: 'Le montant doit être positif' });
    }

    const result = await ordersService.createOrder({
      clientId, order_type, amount, description, reference, metadata
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message, ...err });
    next(err);
  }
};

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
      limit: parseInt(limit) || 20
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

exports.confirmOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await ordersService.confirmOrder(parseInt(id));
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await ordersService.cancelOrder(parseInt(id));
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
};