const pool = require('../config/db');
const dolibarrService = require('../services/dolibarr.service');

const logistiqueBilling = {

  // Vérifie si aujourd'hui est le dernier jour du mois
  isLastDayOfMonth() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.getMonth() !== today.getMonth();
  },

  // Génère les factures mensuelles pour tous les clients LOGISTIQUE
  async generateMonthlyInvoices() {
    console.log('[Logistique Billing] Démarrage facturation mensuelle...');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Récupérer toutes les commandes LOGISTIQUE CONFIRMED du mois
    const ordersResult = await pool.query(`
      SELECT 
        o.*,
        c.name as client_name
      FROM orders o
      JOIN clients c ON o.client_id = c.client_id
      WHERE o.order_type = 'LOGISTIQUE'
        AND o.status = 'CONFIRMED'
        AND EXTRACT(MONTH FROM o.created_at) = $1
        AND EXTRACT(YEAR FROM o.created_at) = $2
      ORDER BY o.client_id, o.created_at
    `, [month, year]);

    if (ordersResult.rows.length === 0) {
      console.log('[Logistique Billing] Aucune commande LOGISTIQUE CONFIRMED ce mois.');
      return;
    }

    // Grouper par client
    const byClient = {};
    for (const order of ordersResult.rows) {
      if (!byClient[order.client_id]) {
        byClient[order.client_id] = {
          clientId: order.client_id,
          clientName: order.client_name,
          orders: [],
          total: 0,
        };
      }
      byClient[order.client_id].orders.push(order);
      byClient[order.client_id].total += parseFloat(order.amount);
    }

    // Créer une facture par client
    for (const clientData of Object.values(byClient)) {
      try {
        const reference = `LOG-${year}${String(month).padStart(2, '0')}-${clientData.clientId.slice(-8)}`;
        const description = `Missions logistique — ${String(month).padStart(2, '0')}/${year} (${clientData.orders.length} mission${clientData.orders.length > 1 ? 's' : ''})`;

        await dolibarrService.createInvoice({
          clientId: clientData.clientId,
          clientName: clientData.clientName,
          amount: clientData.total,
          description,
          reference,
        });

        // Mettre à jour les orders → INVOICED
        const orderIds = clientData.orders.map(o => o.id);
        await pool.query(
          `UPDATE orders 
           SET status = 'INVOICED', updated_at = NOW()
           WHERE id = ANY($1)`,
          [orderIds]
        );

        console.log(`[Logistique Billing] ✅ Facture créée pour ${clientData.clientName} — ${clientData.total} MAD (${clientData.orders.length} missions)`);
      } catch (err) {
        console.error(`[Logistique Billing] ❌ Erreur client ${clientData.clientId}:`, err.message);
      }
    }

    console.log('[Logistique Billing] Facturation mensuelle terminée.');
  },

  // Lancer le cron — vérifie toutes les heures
  start() {
    const interval = 60 * 60 * 1000; // 1 heure

    const check = async () => {
      if (this.isLastDayOfMonth()) {
        // Vérifier si déjà lancé aujourd'hui
        const today = new Date().toISOString().slice(0, 10);
        const key = `LOG_BILLING_${today}`;

        const already = await pool.query(
          `SELECT 1 FROM transaction_logs 
           WHERE reference = $1 LIMIT 1`,
          [key]
        );

        if (already.rows.length === 0) {
          await this.generateMonthlyInvoices();
          // Marquer comme fait aujourd'hui
          await pool.query(
            `INSERT INTO transaction_logs 
             (client_id, type, amount, reference, description, status)
             VALUES ('system', 'BILLING_CRON', 0, $1, 'Facturation mensuelle logistique', 'SUCCESS')`,
            [key]
          );
        }
      }
    };

    check(); // Run at startup
    setInterval(check, interval);
    console.log('[Logistique Billing] Cron démarré — vérification toutes les heures');
  },
};

module.exports = logistiqueBilling;