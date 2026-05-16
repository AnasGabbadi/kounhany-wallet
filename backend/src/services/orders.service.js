const db = require('../config/db');
const walletService = require('./wallet.service');
const blnkService = require('./blnk.service');

class OrdersService {

  // ─── CRÉER UNE COMMANDE (Fleet / Logistique / B2C) ───────────────────────
  
  async createOrder({ clientId, order_type, amount, description, reference, metadata = {} }) {
    // 1. Vérifier que le client existe
    const clientCheck = await db.query(
      'SELECT client_id, name FROM clients WHERE client_id = $1 AND active = true',
      [clientId]
    );
    if (clientCheck.rows.length === 0) {
      throw { status: 404, message: `Client ${clientId} introuvable ou inactif` };
    }
    const client = clientCheck.rows[0];

    // 2. Vérifier que la référence est unique
    const refCheck = await db.query(
      'SELECT id FROM orders WHERE reference = $1',
      [reference]
    );
    if (refCheck.rows.length > 0) {
      throw { status: 409, message: `Référence ${reference} déjà utilisée` };
    }

    // 3. Vérifier le solde disponible (sauf B2C — paiement entrant)
    if (order_type !== 'B2C') {
      const balance = await walletService.getBalance(clientId);
      if (balance.available < amount) {
        throw {
          status: 422,
          message: `Solde insuffisant — disponible: ${balance.available} MAD, requis: ${amount} MAD`,
          available: balance.available,
          required: amount,
        };
      }
    }

    // 4. Insérer la commande en DB
    const orderResult = await db.query(`
      INSERT INTO orders (client_id, order_type, amount, description, reference, status, metadata)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
      RETURNING *
    `, [clientId, order_type, amount, description, reference, JSON.stringify(metadata)]);

    const newOrder = orderResult.rows[0];

    // 5. Traitement wallet selon le type
    let walletResult;

    if (order_type === 'FLEET') {
      // BLOCK → Available → Blocked
      walletResult = await walletService.block(
        clientId,
        amount,
        reference,
        description || `Commande Fleet ${reference}`
      );
      await db.query(
        'UPDATE orders SET status=$1, blnk_transaction_id=$2, updated_at=NOW() WHERE id=$3',
        ['BLOCKED', walletResult.transaction_id, newOrder.id]
      );
      newOrder.status = 'BLOCKED';

    } else if (order_type === 'LOGISTIQUE') {
      walletResult = await walletService.directConfirm(
        clientId,
        amount,
        reference,
        description || `Mission Logistique ${reference}`
      );
      await db.query(
        'UPDATE orders SET status=$1, blnk_transaction_id=$2, confirmed_at=NOW(), updated_at=NOW() WHERE id=$3',
        ['CONFIRMED', walletResult.transaction_id, newOrder.id]
      );
      newOrder.status = 'CONFIRMED';

    } else if (order_type === 'B2C') {
      // PAYMENT → @World → Available
      walletResult = await walletService.pay(
        clientId,
        amount,
        reference,
        description || `Paiement B2C ${reference}`
      );
      await db.query(
        'UPDATE orders SET status=$1, blnk_transaction_id=$2, updated_at=NOW() WHERE id=$3',
        ['PAID', walletResult.transaction_id, newOrder.id]
      );
      newOrder.status = 'PAID';
    }

    return {
      order_id: newOrder.id,
      client_id: clientId,
      client_name: client.name,
      order_type,
      amount,
      description,
      reference,
      status: newOrder.status,
      blnk_transaction_id: walletResult?.transaction_id,
      created_at: newOrder.created_at,
    };
  }

  // ─── LISTE DES COMMANDES D'UN CLIENT ──────────────────────────────────────
  async getClientOrders(clientId, { order_type, status, page = 1, limit = 20 } = {}) {

    let query = 'SELECT * FROM orders WHERE client_id = $1';
    const params = [clientId];
    let idx = 2;

    if (order_type) { query += ` AND order_type = $${idx++}`; params.push(order_type); }
    if (status) { query += ` AND status = $${idx++}`; params.push(status); }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM orders WHERE client_id = $1',
      [clientId]
    );

    return {
      orders: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(countResult.rows[0].count / limit),
      },
    };
  }

  // ─── LISTE GLOBALE (admin) ─────────────────────────────────────────────────
  async getAllOrders({ order_type, status, page = 1, limit = 20 } = {}) {

    let query = `
      SELECT o.*, c.name as client_name, c.email as client_email
      FROM orders o
      JOIN clients c ON o.client_id = c.client_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (order_type) { query += ` AND o.order_type = $${idx++}`; params.push(order_type); }
    if (status) { query += ` AND o.status = $${idx++}`; params.push(status); }

    query += ` ORDER BY o.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    // Count avec les mêmes filtres
    let countQuery = 'SELECT COUNT(*) FROM orders WHERE 1=1';
    const countParams = [];
    let countIdx = 1;
    if (order_type) { countQuery += ` AND order_type = $${countIdx++}`; countParams.push(order_type); }
    if (status) { countQuery += ` AND status = $${countIdx++}`; countParams.push(status); }

    const countResult = await db.query(countQuery, countParams);

    return {
      orders: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(countResult.rows[0].count / limit),
      },
    };
  }

  async confirmOrder(orderId) {
    // Récupérer la commande
    const order = await db.query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );
    if (order.rows.length === 0) {
      const err = new Error('Commande introuvable');
      err.status = 404;
      throw err;
    }

    const o = order.rows[0];

    if (o.status !== 'BLOCKED') {
      const err = new Error(`Impossible de confirmer — statut actuel: ${o.status}`);
      err.status = 422;
      throw err;
    }

    // CONFIRM Blnk : Blocked → Receivable + facture Dolibarr
    const confirmRef = `CONFIRM-${o.reference}`;
    await walletService.confirm(
      o.client_id,
      parseFloat(o.amount),
      confirmRef,
      o.description || `Confirmation commande ${o.reference}`
    );

    // Mettre à jour l'order
    const updated = await db.query(
      `UPDATE orders 
     SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
      [orderId]
    );

    return updated.rows[0];
  }

  async cancelOrder(orderId) {
    const order = await db.query(
      'SELECT * FROM orders WHERE id = $1', [orderId]
    );
    if (order.rows.length === 0) {
      const err = new Error('Commande introuvable');
      err.status = 404; throw err;
    }

    const o = order.rows[0];

    if (o.status !== 'BLOCKED') {
      const err = new Error(`Impossible d'annuler — statut actuel: ${o.status}`);
      err.status = 422; throw err;
    }

    // Blnk : Blocked → Available (remboursement)
    const cancelRef = `CANCEL-${o.reference}`;
    await walletService.unblock(
      o.client_id,
      parseFloat(o.amount),
      cancelRef,
      `Annulation commande ${o.reference}`
    );

    const updated = await db.query(
      `UPDATE orders 
     SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
      [orderId]
    );
    return updated.rows[0];
  }

  async createExternalOrder({ clientId, order_type, amount, reference, description, metadata = {}, external_order_id }) {
    const result = await this.createOrder({
      clientId,
      order_type,
      amount,
      reference,
      description,
      metadata: { ...metadata, external_order_id },
    });

    return {
      authorized: true,
      wallet_order_id: result.order_id,
      external_order_id,
      order_type,
      status: result.status,
      amount_blocked: order_type === 'FLEET' ? amount : 0,
      blnk_transaction_id: result.blnk_transaction_id,
      message: order_type === 'FLEET'
        ? 'Montant bloqué — en attente de confirmation service'
        : order_type === 'LOGISTIQUE'
          ? 'Mission confirmée directement'
          : 'Paiement B2C enregistré',
    };
  }
}

module.exports = new OrdersService();