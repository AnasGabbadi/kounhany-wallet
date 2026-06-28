const db = require('../config/db');
const walletService = require('./wallet.service');
const blnkService = require('./blnk.service');

class OrdersService {

  // ─── CRÉER UNE COMMANDE (Fleet / Logistique / B2C) ───────────────────────

  async createOrder({ clientId, order_type, amount, description, reference, metadata = {}, created_by = null }) {
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
      INSERT INTO orders (client_id, order_type, amount, description, reference, status, metadata, created_by)
      VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
      RETURNING *
    `, [clientId, order_type, amount, description, reference, JSON.stringify(metadata), created_by || null]);

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
        'UPDATE orders SET status=$1, blnk_transaction_id=$2, updated_at=NOW() WHERE id=$3',
        ['EN_ATTENTE', walletResult.transaction_id, newOrder.id]
      );
      newOrder.status = 'EN_ATTENTE';

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

    let query = "SELECT * FROM orders WHERE client_id = $1 AND reference NOT LIKE 'HANY-CLIENT-%'";
    const params = [clientId];
    let idx = 2;

    if (order_type) { query += ` AND order_type = $${idx++}`; params.push(order_type); }
    if (status) { query += ` AND status = $${idx++}`; params.push(status); }

    query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);
    const countResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE client_id = $1 AND reference NOT LIKE 'HANY-CLIENT-%'",
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
      WHERE o.reference NOT LIKE 'HANY-CLIENT-%'
    `;
    const params = [];
    let idx = 1;

    if (order_type) { query += ` AND o.order_type = $${idx++}`; params.push(order_type); }
    if (status) { query += ` AND o.status = $${idx++}`; params.push(status); }

    query += ` ORDER BY o.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, (page - 1) * limit);

    const result = await db.query(query, params);

    // Count avec les mêmes filtres
    let countQuery = "SELECT COUNT(*) FROM orders WHERE reference NOT LIKE 'HANY-CLIENT-%'";
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
    const order = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
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

    // CONFIRM Blnk : Blocked → Receivable + facture client Dolibarr
    const confirmRef = `CONFIRM-${o.reference}`;
    await walletService.confirm(
      o.client_id,
      parseFloat(o.amount),
      confirmRef,
      o.description || `Confirmation commande ${o.reference}`
    );

    // ✅ Lire prestataires depuis metadata
    const metadata = o.metadata || {};
    const dolibarrService = require('./dolibarr.service');

    // Facture fournisseur garage — nouveau format prioritaire, ancien en fallback
    const prestataireId = metadata.wallet_prestataire_id
      || (metadata.wallet_garage_uuid ? `prestataire_${metadata.wallet_garage_uuid}` : null);
    const garageAmount = parseFloat(metadata.wallet_garage_amount || 0);

    if (prestataireId && garageAmount > 0) {
      try {
        const garageUuid = metadata.wallet_garage_uuid || null;

        // Recherche : prestataire_id exact OU par garage_uuid (colonne Fleet UUID) OU legacy_uuid
        let presta = await db.query(
          `SELECT * FROM prestataires
           WHERE prestataire_id = $1
              OR (garage_uuid::text = $2 AND type = 'GARAGE')
              OR (legacy_uuid::text = $2 AND type = 'GARAGE')
           LIMIT 1`,
          [prestataireId, garageUuid]
        );
        if (presta.rows.length > 0) {
          console.log(`[Confirm] ℹ️ Garage trouvé — ${presta.rows[0].prestataire_id}`);
        }

        // Fallback : chercher par kounhany_uuid dans clients (SCIM — UUID Authentik)
        if (presta.rows.length === 0 && garageUuid) {
          const fallback = await db.query(
            `SELECT p.* FROM prestataires p
             JOIN clients c ON c.client_id = p.prestataire_id
             WHERE c.kounhany_uuid = $1 AND p.type = 'GARAGE'
             LIMIT 1`,
            [garageUuid]
          );
          if (fallback.rows.length > 0) {
            presta = fallback;
            console.log(`[Confirm] ℹ️ Garage trouvé via kounhany_uuid — ${fallback.rows[0].prestataire_id}`);
          } else {
            console.warn(`[Confirm] ⚠️ Garage introuvable — uuid: ${garageUuid} — prestataireId: ${prestataireId}`);
          }
        }

        if (presta.rows.length > 0) {
          const resolvedPrestataireId = presta.rows[0]?.prestataire_id;
          const resolvedPrestataireName = presta.rows[0]?.name || `Garage-${garageUuid || prestataireId}`;

          if (!resolvedPrestataireId || typeof resolvedPrestataireId !== 'string') {
            console.warn(`[Confirm] ⚠️ Garage prestataire_id invalide (${resolvedPrestataireId}) — skip Dolibarr`);
          } else {
            // 1. Créer facture Dolibarr d'abord
            await dolibarrService.createSupplierInvoice({
              prestataireId: resolvedPrestataireId,
              prestataireName: resolvedPrestataireName,
              amount: garageAmount,
              description: `Service garage — ${o.reference}`,
              reference: `PRESTA-GARAGE-${o.reference.replace('FLEET-', '')}`,
            });

            // 2. Insérer order prestataire après
            await db.query(
              `INSERT INTO prestataire_orders (prestataire_id, maintenance_ref, amount, reference, status, description)
           VALUES ($1, $2, $3, $4, 'CONFIRMED', $5)
           ON CONFLICT (reference) DO NOTHING`,
              [
                resolvedPrestataireId,
                o.reference.replace('FLEET-', ''),
                garageAmount,
                `GARAGE-${o.reference.replace('FLEET-', '')}`,
                `Service garage — ${o.reference}`,
              ]
            );
            console.log(`[Confirm] ✅ Facture garage créée — ${resolvedPrestataireName}`);
          }
        }
      } catch (err) {
        console.error('[Confirm] Erreur facture garage:', err.message);
      }
    }

    // Facture fournisseur pièces — nouveau format prioritaire, ancien en fallback
    const piecesId = metadata.wallet_pieces_prestataire_id
      || (metadata.wallet_provider_uuid ? `pieces_${metadata.wallet_provider_uuid}` : null);
    const piecesAmount = parseFloat(metadata.wallet_pieces_amount || 0);

    if (piecesId && piecesAmount > 0) {
      try {
        const providerUuid = metadata.wallet_provider_uuid || null;

        // Recherche : prestataire_id exact OU par garage_uuid (colonne Fleet UUID) OU legacy_uuid
        let presta = await db.query(
          `SELECT * FROM prestataires
           WHERE prestataire_id = $1
              OR (garage_uuid::text = $2 AND type = 'PROVIDER')
              OR (legacy_uuid::text = $2 AND type = 'PROVIDER')
           LIMIT 1`,
          [piecesId, providerUuid]
        );
        if (presta.rows.length > 0) {
          console.log(`[Confirm] ℹ️ Provider trouvé — ${presta.rows[0].prestataire_id}`);
        }

        // Fallback : chercher par kounhany_uuid dans clients (SCIM — UUID Authentik)
        if (presta.rows.length === 0 && providerUuid) {
          const fallback = await db.query(
            `SELECT p.* FROM prestataires p
             JOIN clients c ON c.client_id = p.prestataire_id
             WHERE c.kounhany_uuid = $1 AND p.type = 'PROVIDER'
             LIMIT 1`,
            [providerUuid]
          );
          if (fallback.rows.length > 0) {
            presta = fallback;
            console.log(`[Confirm] ℹ️ Provider trouvé via kounhany_uuid — ${fallback.rows[0].prestataire_id}`);
          } else {
            console.warn(`[Confirm] ⚠️ Provider introuvable — uuid: ${providerUuid} — piecesId: ${piecesId}`);
          }
        }

        if (presta.rows.length > 0) {
          const resolvedPrestataireId = presta.rows[0]?.prestataire_id;
          const resolvedPrestataireName = presta.rows[0]?.name || `Provider-${providerUuid || piecesId}`;

          if (!resolvedPrestataireId || typeof resolvedPrestataireId !== 'string') {
            console.warn(`[Confirm] ⚠️ Pièces prestataire_id invalide (${resolvedPrestataireId}) — skip Dolibarr`);
          } else {
            await dolibarrService.createSupplierInvoice({
              prestataireId: resolvedPrestataireId,
              prestataireName: resolvedPrestataireName,
              amount: piecesAmount,
              description: `Pièces — ${o.reference}`,
              reference: `PRESTA-PIECES-${o.reference.replace('FLEET-', '')}`,
            });
            await db.query(
              `INSERT INTO prestataire_orders (prestataire_id, maintenance_ref, amount, reference, status, description)
              VALUES ($1, $2, $3, $4, 'CONFIRMED', $5)
              ON CONFLICT (reference) DO NOTHING`,
              [
                resolvedPrestataireId,
                o.reference.replace('FLEET-', ''),
                piecesAmount,
                `PIECES-${o.reference.replace('FLEET-', '')}`,
                `Pièces — ${o.reference}`,
              ]
            );
            console.log(`[Confirm] ✅ Facture pièces créée — ${resolvedPrestataireName}`);
          }
        }
      } catch (err) {
        console.error('[Confirm] Erreur facture pièces:', err.message);
      }
    }

    // Mettre à jour l'order
    const updated = await db.query(
      `UPDATE orders SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
      [orderId]
    );

    return updated.rows[0];
  }

  // ─── MISE À JOUR STATUS PAR TRANSACTION ID ────────────────────────────────
  async updateOrderStatus(transactionId, status) {
    const VALID_STATUSES = ['EN_ATTENTE', 'CONFIRMED', 'PAID', 'CANCELLED'];
    if (!VALID_STATUSES.includes(status)) {
      throw { status: 400, message: `Status invalide — valeurs acceptées: ${VALID_STATUSES.join(', ')}` };
    }

    const existing = await db.query(
      'SELECT id FROM orders WHERE blnk_transaction_id = $1',
      [transactionId]
    );
    if (existing.rows.length === 0) {
      throw { status: 404, message: `Order introuvable pour transaction ${transactionId}` };
    }

    const confirmedAt = status === 'CONFIRMED' ? ', confirmed_at = NOW()' : '';
    const updated = await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW()${confirmedAt} WHERE blnk_transaction_id = $2 RETURNING *`,
      [status, transactionId]
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

  async createExternalOrder({ clientId, order_type, amount, reference, description, metadata = {}, external_order_id, created_by }) {
    const result = await this.createOrder({
      clientId,
      order_type,
      amount,
      reference,
      description,
      created_by,
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
          ? 'Mission enregistrée — en attente de livraison'
          : 'Paiement B2C enregistré',
    };
  }
}

module.exports = new OrdersService();