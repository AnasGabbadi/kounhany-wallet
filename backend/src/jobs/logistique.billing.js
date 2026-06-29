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

  // Exécute la facturation pour une période donnée (YYYY-MM) ou le mois courant
  async runBilling(periodOverride = null) {
    return this.generateMonthlyInvoices(periodOverride);
  },

  // Génère les factures mensuelles pour tous les clients LOGISTIQUE
  async generateMonthlyInvoices(periodOverride = null) {
    console.log('[Logistique Billing] Démarrage facturation mensuelle...');

    const now = new Date();
    let year, month;
    if (periodOverride && /^\d{4}-\d{2}$/.test(periodOverride)) {
      [year, month] = periodOverride.split('-').map(Number);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    const period = `${year}-${String(month).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Récupérer toutes les commandes LOGISTIQUE CONFIRMED du mois
    const ordersResult = await pool.query(`
      SELECT 
        o.*,
        c.name as client_name
      FROM orders o
      JOIN clients c ON o.client_id = c.client_id
      WHERE o.order_type = 'LOGISTIQUE'
        AND o.status = 'CONFIRMED'
        AND o.dolibarr_invoice_id IS NULL
        AND EXTRACT(MONTH FROM o.confirmed_at) = $1
        AND EXTRACT(YEAR FROM o.confirmed_at) = $2
      ORDER BY o.client_id, o.created_at
    `, [month, year]);

    if (ordersResult.rows.length === 0) {
      console.log('[Logistique Billing] Aucune commande LOGISTIQUE CONFIRMED ce mois.');
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
        const reference = `HANY-CLIENT-${clientData.clientId}-${period}-${timeStr}`;
        const description = `Missions logistique — ${String(month).padStart(2, '0')}/${year} (${clientData.orders.length} mission${clientData.orders.length > 1 ? 's' : ''})`;

        // Idempotence — skip si facture déjà créée dans Dolibarr
        try {
          const existing = await dolibarrService.findInvoiceByClientRef(reference);
          if (existing) {
            console.log(`[Logistique Billing] Facture client déjà existante — skip : ${reference}`);
            continue;
          }
        } catch (err) {
          console.warn(`[Logistique Billing] Erreur vérification idempotence: ${err.message.slice(0, 200)}`);
        }

        const invoiceId = await dolibarrService.createInvoice({
          clientId: clientData.clientId,
          clientName: clientData.clientName,
          amount: clientData.total,
          description,
          reference,
        });

        // Mettre à jour les orders → INVOICED + stocker dolibarr_invoice_id
        const orderIds = clientData.orders.map(o => o.id);
        await pool.query(
          `UPDATE orders
           SET status = 'INVOICED', dolibarr_invoice_id = $2, updated_at = NOW()
           WHERE id = ANY($1)`,
          [orderIds, String(invoiceId)]
        );

        // Ligne de synthèse pour le sync paiement Dolibarr
        await pool.query(
          `INSERT INTO orders
           (client_id, reference, amount, status, order_type, description, dolibarr_invoice_id, confirmed_at, created_at, updated_at)
           VALUES ($1, $2, $3, 'CONFIRMED', 'LOGISTIQUE', $4, $5, NOW(), NOW(), NOW())
           ON CONFLICT (reference) DO NOTHING`,
          [
            clientData.clientId,
            reference,
            parseFloat(clientData.total),
            `Facturation logistique ${period}`,
            String(invoiceId),
          ]
        );
        console.log(`[Logistique Billing] Ligne synthèse insérée : ${reference}`);

        console.log(`[Logistique Billing] ✅ Facture créée pour ${clientData.clientName} — ${clientData.total} MAD (${clientData.orders.length} missions)`);
      } catch (err) {
        console.error(`[Logistique Billing] ❌ Erreur client ${clientData.clientId}:`, err.message);
      }
    }

    // ─── Facturation prestataires LOGISTIQUE ─────────────────────────
    const prestaOrdersResult = await pool.query(`
      SELECT
        prestataire_id,
        SUM(amount)::numeric as total,
        array_agg(id) as order_ids
      FROM prestataire_orders
      WHERE reference LIKE 'HANY-PRESTA-%'
        AND status = 'CONFIRMED'
        AND EXTRACT(MONTH FROM created_at) = $1
        AND EXTRACT(YEAR FROM created_at) = $2
      GROUP BY prestataire_id
    `, [month, year]);

    if (prestaOrdersResult.rows.length > 0) {
      console.log(`[Logistique Billing] ${prestaOrdersResult.rows.length} prestataire(s) à facturer`);

      for (const row of prestaOrdersResult.rows) {
        try {
          const prestaRef = `HANY-PRESTA-${row.prestataire_id}-${period}-${timeStr}`;

          // Idempotence — vérifier si déjà facturé ce mois
          const existingBilling = await pool.query(
            `SELECT id FROM prestataire_orders WHERE reference = $1 AND status = 'INVOICED' LIMIT 1`,
            [prestaRef]
          );
          if (existingBilling.rows.length > 0) {
            console.log(`[Logistique Billing] Facture prestataire déjà existante — skip : ${prestaRef}`);
            continue;
          }

          // Récupérer le nom du prestataire
          const prestaNameResult = await pool.query(
            'SELECT name FROM prestataires WHERE prestataire_id = $1',
            [row.prestataire_id]
          );
          const prestaName = prestaNameResult.rows[0]?.name || row.prestataire_id;

          // Idempotence Dolibarr — éviter 500 si facture fournisseur déjà créée
          try {
            const existingDolibarr = await dolibarrService.findSupplierInvoiceByRef(prestaRef);
            if (existingDolibarr) {
              console.log(`[Logistique Billing] Facture fournisseur Dolibarr déjà existante — mise à jour orders : ${prestaRef}`);
              // Marquer les orders individuelles comme INVOICED
              await pool.query(
                `UPDATE prestataire_orders SET status = 'INVOICED', updated_at = NOW() WHERE id = ANY($1)`,
                [row.order_ids]
              );
              // Insérer la ligne de synthèse si absente
              await pool.query(
                `INSERT INTO prestataire_orders
                 (prestataire_id, maintenance_ref, amount, reference, status, description, dolibarr_invoice_id)
                 VALUES ($1, $2, $3, $4, 'INVOICED', $5, $6)
                 ON CONFLICT (reference) DO NOTHING`,
                [
                  row.prestataire_id,
                  prestaRef,
                  parseFloat(row.total),
                  prestaRef,
                  `Prestation logistique ${period}`,
                  existingDolibarr.id || null,
                ]
              );
              continue;
            }
          } catch (err) {
            console.warn(`[Logistique Billing] Erreur vérification idempotence Dolibarr: ${err.message.slice(0, 200)}`);
          }

          const invoiceId = await dolibarrService.createSupplierInvoice({
            prestataireId: row.prestataire_id,
            prestataireName: prestaName,
            amount: parseFloat(row.total),
            reference: prestaRef,
            description: `Prestation logistique ${period}`,
          });

          // Marquer les orders individuels comme INVOICED
          await pool.query(
            `UPDATE prestataire_orders SET status = 'INVOICED', updated_at = NOW() WHERE id = ANY($1)`,
            [row.order_ids]
          );

          // Ligne de synthèse — utilisée par le sync Dolibarr pour le paiement prestataire
          await pool.query(
            `INSERT INTO prestataire_orders
             (prestataire_id, maintenance_ref, amount, reference, status, description, dolibarr_invoice_id)
             VALUES ($1, $2, $3, $4, 'INVOICED', $5, $6)
             ON CONFLICT (reference) DO NOTHING`,
            [
              row.prestataire_id,
              prestaRef,
              parseFloat(row.total),
              prestaRef,
              `Prestation logistique ${period}`,
              invoiceId,
            ]
          );

          console.log(`[Logistique Billing] ✅ Facture prestataire ${row.prestataire_id} — ${parseFloat(row.total)} MAD`);
        } catch (err) {
          console.error(`[Logistique Billing] ❌ Erreur prestataire ${row.prestataire_id}: ${err.message.slice(0, 200)}`);
        }
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