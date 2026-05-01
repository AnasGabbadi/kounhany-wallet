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
      const sinceMs = Date.now() - (parseInt(process.env.DOLIBARR_POLLING_INTERVAL) || 300000) - 60000;
      const payments = await dolibarrService.getRecentPayments(sinceMs);

      if (payments.length === 0) return;
      console.log(`[Dolibarr Sync] ${payments.length} paiement(s) trouvé(s)`);

      for (const payment of payments) {
        const ref = `DOL-PAY-${payment.id}`;

        // Vérifier si déjà traité
        const existing = await pool.query(
          'SELECT id FROM transaction_logs WHERE reference = $1',
          [ref]
        );
        if (existing.rows.length > 0) continue;

        // Récupérer la facture liée
        const invoice = await dolibarrService.getInvoice(payment.fk_facture);
        if (!invoice?.ref_client) continue;

        // Trouver le client dans notre base
        const client = await pool.query(
          'SELECT * FROM clients WHERE client_id = $1',
          [invoice.ref_client]
        );
        if (client.rows.length === 0) {
          console.log(`[Dolibarr Sync] Client introuvable pour ref_client: ${invoice.ref_client}`);
          continue;
        }

        // Enregistrer le paiement dans notre wallet
        await walletService.externalPayment(
          client.rows[0].client_id,
          parseFloat(payment.amount),
          ref,
          `Paiement Dolibarr — facture ${invoice.ref}`
        );

        console.log(`[Dolibarr Sync] ✅ Paiement synchronisé: ${payment.id} — client: ${client.rows[0].name}`);
      }
    } catch (err) {
      console.error('[Dolibarr Sync] Erreur sync:', err.message);
    }
  },
};

module.exports = dolibarrSync;