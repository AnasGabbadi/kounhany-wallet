const dolibarrService = require('./dolibarr.service');
const walletService = require('./wallet.service');
const pool = require('../config/db');

const dolibarrSync = {

  async start() {
    if (!process.env.DOLIBARR_URL || !process.env.DOLIBARR_API_KEY) {
      console.log('[Dolibarr Sync] Désactivé — variables manquantes');
      return;
    }

    // Test connexion
    try {
      await dolibarrService.ping();
      console.log('[Dolibarr Sync] Connexion OK');
    } catch (err) {
      console.error('[Dolibarr Sync] Connexion échouée:', err.message);
      return;
    }

    const interval = parseInt(process.env.DOLIBARR_POLLING_INTERVAL) || 300000;
    console.log(`[Dolibarr Sync] Démarré — polling toutes les ${interval / 1000}s`);

    // Premier sync immédiat
    await this.syncPayments();

    // Puis toutes les X minutes
    setInterval(async () => {
      await this.syncPayments();
    }, interval);
  },

  async syncPayments() {
    try {
      const res = await dolibarrService.getPaidInvoices();
      if (res.length === 0) return;
      console.log(`[Dolibarr Sync] ${res.length} facture(s) payée(s) trouvée(s)`);

      for (const invoice of res) {
        const ref = `SYNC-PAY-${invoice.id}`;

        // Vérifier si déjà traité
        const existing = await pool.query(
          'SELECT id FROM transaction_logs WHERE reference = $1',
          [ref]
        );
        if (existing.rows.length > 0) continue;

        if (!invoice.ref_client) continue;

        // ─── CAS LOGISTIQUE — facture mensuelle groupée ───────────────
        if (invoice.ref_client.startsWith('LOG-')) {
          // ref_client = LOG-202605-39378756
          // Extraire année et mois depuis la référence
          const parts = invoice.ref_client.split('-');
          const yearMonth = parts[1]; // "202605"
          const year = parseInt(yearMonth.slice(0, 4));
          const month = parseInt(yearMonth.slice(4, 6));

          // Trouver le client via la fin de ref_client
          const clientSuffix = parts[2]; // "39378756"
          const clientResult = await pool.query(
            `SELECT client_id FROM clients 
     WHERE client_id LIKE $1`,
            [`%${clientSuffix}`]
          );

          if (clientResult.rows.length === 0) {
            console.log(`[Dolibarr Sync] Client introuvable pour: ${invoice.ref_client}`);
            continue;
          }

          const clientId = clientResult.rows[0].client_id;

          // Solder le Receivable
          await walletService.externalDebt(
            clientId,
            parseFloat(invoice.total_ttc),
            ref,
            `Paiement Dolibarr — facture mensuelle ${invoice.ref}`
          );

          // Mettre à jour UNIQUEMENT les orders INVOICED du mois concerné → PAID
          await pool.query(
            `UPDATE orders 
     SET status = 'PAID', updated_at = NOW()
     WHERE client_id = $1
       AND status = 'INVOICED'
       AND order_type = 'LOGISTIQUE'
       AND EXTRACT(YEAR FROM created_at) = $2
       AND EXTRACT(MONTH FROM created_at) = $3`,
            [clientId, year, month]
          );

          console.log(`[Dolibarr Sync] ✅ Facture mensuelle ${invoice.ref} — ${invoice.total_ttc} MAD → PAID`);
          continue;
        }

        // ─── CAS FLEET — facture par commande ─────────────────────────
        const orderRef = invoice.ref_client.replace(/^CONFIRM-/, '');

        const order = await pool.query(
          `SELECT o.*, c.client_id FROM orders o
         JOIN clients c ON o.client_id = c.client_id
         WHERE o.reference = $1 AND o.status = 'CONFIRMED'`,
          [orderRef]
        );

        if (order.rows.length === 0) {
          console.log(`[Dolibarr Sync] Order introuvable ou déjà PAID pour: ${invoice.ref_client}`);
          continue;
        }

        const o = order.rows[0];

        await walletService.externalDebt(
          o.client_id,
          parseFloat(invoice.total_ttc),
          ref,
          `Paiement Dolibarr — facture ${invoice.ref}`
        );

        await pool.query(
          `UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = $1`,
          [o.id]
        );

        console.log(`[Dolibarr Sync] ✅ Facture ${invoice.ref} payée — order ${invoice.ref_client} → PAID`);
      }
    } catch (err) {
      console.error('[Dolibarr Sync] Erreur sync:', err.message);
    }
  },
};

module.exports = dolibarrSync;