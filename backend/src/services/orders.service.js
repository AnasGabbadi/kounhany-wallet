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

    const metadata = o.metadata || {};
    const dolibarrService = require('./dolibarr.service');

    // ─── Helpers ───────────────────────────────────────────────────────────────

    // Cherche un prestataire Kounhany (garage_xxx / provider_xxx) par email
    const findPrestaByEmail = (email) => db.query(
      `SELECT * FROM prestataires WHERE email = $1 AND prestataire_id ~ '^(garage|provider)_' LIMIT 1`,
      [email]
    );

    // Résout le vrai prestataire Kounhany à partir d'un UUID Fleet/Authentik.
    // Stratégie : UUID direct → bridge email via clients (scim_id) → email via clients (client_id/kounhany_uuid).
    // Ne crée JAMAIS de faux prestataire — retourne null si introuvable.
    const resolvePrestataire = async (uuid, nameFallback) => {
      // 1. Lookup direct : prestataire_id = 'prestataire_<uuid>' ou garage_uuid = uuid
      const directRes = await db.query(
        `SELECT * FROM prestataires WHERE prestataire_id = $1 OR garage_uuid = $2 LIMIT 1`,
        [`prestataire_${uuid}`, uuid]
      );
      if (directRes.rows.length > 0) {
        const p = directRes.rows[0];
        // C'est un vrai garage Kounhany
        if (/^(garage|provider)_/.test(p.prestataire_id)) {
          console.log(`[Confirm] ℹ️ Prestataire Kounhany trouvé par UUID — ${p.prestataire_id}`);
          return p;
        }
        // C'est une entrée auto-créée (prestataire_<uuid>) — tenter bridge email
        if (p.email) {
          const byEmail = await findPrestaByEmail(p.email);
          if (byEmail.rows.length > 0) {
            console.log(`[Confirm] ✅ Prestataire Kounhany trouvé via email (entrée fake→réelle) — ${byEmail.rows[0].prestataire_id}`);
            return byEmail.rows[0];
          }
        }
      }

      // 2. Bridge via clients (scim_id = UUID Authentik/Fleet → email → prestataires)
      const clientRes = await db.query(
        `SELECT c.email, c.name FROM clients c
         WHERE c.scim_id = $1 OR c.client_id = $1 OR c.kounhany_uuid = $1
         LIMIT 1`,
        [uuid]
      ).catch(() => ({ rows: [] }));

      if (clientRes.rows.length > 0 && clientRes.rows[0].email) {
        const { email, name } = clientRes.rows[0];
        const byEmail = await findPrestaByEmail(email);
        if (byEmail.rows.length > 0) {
          console.log(`[Confirm] ✅ Prestataire Kounhany trouvé via clients.email — ${byEmail.rows[0].prestataire_id}`);
          return byEmail.rows[0];
        }
        console.warn(`[Confirm] ⚠️ Client trouvé (${name} / ${email}) mais aucun prestataire Kounhany avec cet email`);
        return null;
      }

      console.warn(`[Confirm] ⚠️ Prestataire introuvable pour uuid: ${uuid} (${nameFallback || 'N/A'}) — aucune facture créée`);
      return null;
    };

    // ─── Facture garage ─────────────────────────────────────────────────────────
    const garageUuid  = metadata.wallet_garage_uuid || null;
    const garageAmount = parseFloat(metadata.wallet_garage_amount || 0);

    if (garageUuid && garageAmount > 0) {
      try {
        const presta = await resolvePrestataire(garageUuid, metadata.wallet_provider_name || null);
        if (presta) {
          await dolibarrService.createSupplierInvoice({
            prestataireId:   presta.prestataire_id,
            prestataireName: presta.name,
            amount:          garageAmount,
            description:     `Service garage — ${o.reference}`,
            reference:       `PRESTA-GARAGE-${o.reference.replace('FLEET-', '')}`,
          });
          await db.query(
            `INSERT INTO prestataire_orders (prestataire_id, maintenance_ref, amount, reference, status, description)
             VALUES ($1, $2, $3, $4, 'CONFIRMED', $5)
             ON CONFLICT (reference) DO NOTHING`,
            [presta.prestataire_id, o.reference.replace('FLEET-', ''), garageAmount,
             `GARAGE-${o.reference.replace('FLEET-', '')}`, `Service garage — ${o.reference}`]
          );
          console.log(`[Confirm] ✅ Facture garage créée — ${presta.name}`);
        } else {
          console.warn(`[Confirm] ⚠️ Garage introuvable et non créable — uuid: ${garageUuid}`);
        }
      } catch (err) {
        console.error('[Confirm] Erreur facture garage:', err.message);
      }
    }

    // ─── Facture pièces ─────────────────────────────────────────────────────────
    // wallet_provider_uuid souvent null côté Fleet → fallback sur garage (qui commande les pièces)
    const providerUuid  = metadata.wallet_provider_uuid || garageUuid;
    const piecesAmount  = parseFloat(metadata.wallet_pieces_amount || 0);

    if (providerUuid && piecesAmount > 0) {
      try {
        const presta = await resolvePrestataire(providerUuid, metadata.wallet_provider_name || null);
        if (presta) {
          await dolibarrService.createSupplierInvoice({
            prestataireId:   presta.prestataire_id,
            prestataireName: presta.name,
            amount:          piecesAmount,
            description:     `Pièces — ${o.reference}`,
            reference:       `PRESTA-PIECES-${o.reference.replace('FLEET-', '')}`,
          });
          await db.query(
            `INSERT INTO prestataire_orders (prestataire_id, maintenance_ref, amount, reference, status, description)
             VALUES ($1, $2, $3, $4, 'CONFIRMED', $5)
             ON CONFLICT (reference) DO NOTHING`,
            [presta.prestataire_id, o.reference.replace('FLEET-', ''), piecesAmount,
             `PIECES-${o.reference.replace('FLEET-', '')}`, `Pièces — ${o.reference}`]
          );
          console.log(`[Confirm] ✅ Facture pièces créée — ${presta.name}`);
        } else {
          console.warn(`[Confirm] ⚠️ Provider introuvable et non créable — uuid: ${providerUuid}`);
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
          ? 'Mission confirmée directement'
          : 'Paiement B2C enregistré',
    };
  }
}

module.exports = new OrdersService();