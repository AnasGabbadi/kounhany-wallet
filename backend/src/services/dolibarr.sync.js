const dolibarrService = require('./dolibarr.service');
const walletService = require('./wallet.service');
const pool = require('../config/db');
const prestatairesService = require('./prestataires.service');

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
      // ─── Factures clients (Fleet/Logistique) ──────────────────────
      const clientInvoices = await dolibarrService.getPaidInvoices();
      if (clientInvoices.length > 0) {
        console.log(`[Dolibarr Sync] ${clientInvoices.length} facture(s) client payée(s)`);

        for (const invoice of clientInvoices) {
          const ref = `SYNC-PAY-${invoice.id}`;

          const existing = await pool.query(
            'SELECT id FROM transaction_logs WHERE reference = $1', [ref]
          );
          if (existing.rows.length > 0) continue;
          if (!invoice.ref_client) continue;

          // ─── CAS LOGISTIQUE ───────────────────────────────────────
          if (invoice.ref_client.startsWith('LOG-')) {
            const parts = invoice.ref_client.split('-');
            const yearMonth = parts[1];
            const year = parseInt(yearMonth.slice(0, 4));
            const month = parseInt(yearMonth.slice(4, 6));
            const clientSuffix = parts[2];

            const clientResult = await pool.query(
              `SELECT client_id FROM clients WHERE client_id LIKE $1`,
              [`%${clientSuffix}`]
            );

            if (clientResult.rows.length === 0) {
              console.log(`[Dolibarr Sync] Client introuvable pour: ${invoice.ref_client}`);
              continue;
            }

            const clientId = clientResult.rows[0].client_id;

            await walletService.externalDebt(
              clientId,
              parseFloat(invoice.total_ttc),
              ref,
              `Paiement Dolibarr — facture mensuelle ${invoice.ref}`
            );

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

          // ─── CAS LOGISTIQUE HANYJAY (HANY-CLIENT-{client_id}-{YYYY-MM}) ──
          if (invoice.ref_client.startsWith('HANY-CLIENT-')) {
            try {
              const orderResult = await pool.query(
                `SELECT * FROM orders
                 WHERE reference = $1
                   AND status != 'PAID'
                   AND order_type = 'LOGISTIQUE'
                 LIMIT 1`,
                [invoice.ref_client]
              );

              if (orderResult.rows.length === 0) {
                console.log(`[Dolibarr Sync Logistique] Order introuvable : ${invoice.ref_client}`);
                continue;
              }

              const o = orderResult.rows[0];
              const amount = parseFloat(invoice.total_ttc);

              await walletService.externalDebt(
                o.client_id,
                amount,
                `DEBT-${ref}`,
                `Solde créance Logistique — ${invoice.ref_client}`
              );

              await walletService.pay(
                o.client_id,
                amount,
                ref,
                `Paiement Dolibarr Logistique — ${invoice.ref_client}`
              );

              await pool.query(
                `UPDATE orders SET status = 'PAID', updated_at = NOW() WHERE id = $1`,
                [o.id]
              );

              console.log(`[Dolibarr Sync Logistique] Paiement reçu client:${o.client_id} montant:${amount}`);
            } catch (err) {
              console.error(`[Dolibarr Sync Logistique] ❌ Erreur ${invoice.ref_client}: ${err.message.slice(0, 200)}`);
            }
            continue;
          }

          // ─── CAS FLEET ────────────────────────────────────────────
          const orderRef = invoice.ref_client
            .replace(/^CONFIRM-FLEET-/, 'FLEET-')
            .replace(/^CONFIRM-/, 'FLEET-');

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
            `DEBT-${ref}`,
            `Solde créance — facture ${invoice.ref}`
          );

          await walletService.pay(
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
      }

      // ─── Factures fournisseurs (Prestataires) ─────────────────────
      const supplierInvoices = await dolibarrService.getPaidSupplierInvoices();
      console.log(`[Dolibarr Sync] ${supplierInvoices.length} facture(s) fournisseur payée(s)`);

      if (supplierInvoices.length > 0) {
        // Log toutes les ref_supplier pour debug
        const refsList = supplierInvoices.map(i => i.ref_supplier || '(vide)').join(', ');
        console.log(`[Dolibarr Sync] ref_supplier trouvées: ${refsList}`);

        let skippedIdempotency = 0;
        let skippedNoPrefix = 0;
        let skippedNotFound = 0;
        let paid = 0;

        for (const invoice of supplierInvoices) {
          try {
            const ref = `SYNC-PRESTA-${invoice.id}`;

            // Idempotency — déjà traité ?
            const existing = await pool.query(
              'SELECT id FROM transaction_logs WHERE reference = $1', [ref]
            );
            if (existing.rows.length > 0) {
              skippedIdempotency++;
              continue;
            }

            // ─── CAS PRESTATAIRE LOGISTIQUE HANYJAY (HANY-PRESTA-) ──────────
            if (invoice.ref_supplier?.startsWith('HANY-PRESTA-')) {
              const orderResult = await pool.query(
                `SELECT * FROM prestataire_orders WHERE reference = $1 AND status = 'CONFIRMED'`,
                [invoice.ref_supplier]
              );

              if (orderResult.rows.length === 0) {
                const anyOrder = await pool.query(
                  `SELECT reference, status FROM prestataire_orders WHERE reference = $1`,
                  [invoice.ref_supplier]
                );
                if (anyOrder.rows.length > 0) {
                  console.log(`[Dolibarr Sync Logistique] Order prestataire statut=${anyOrder.rows[0].status} (skip) : ${invoice.ref_supplier}`);
                } else {
                  console.log(`[Dolibarr Sync Logistique] Order prestataire introuvable : ${invoice.ref_supplier}`);
                }
                skippedNotFound++;
                continue;
              }

              const o = orderResult.rows[0];

              await prestatairesService.pay(
                o.prestataire_id,
                parseFloat(invoice.total_ttc),
                ref,
                `Paiement Dolibarr prestataire Logistique`
              );

              await pool.query(
                `UPDATE prestataire_orders SET status = 'PAID', updated_at = NOW() WHERE id = $1`,
                [o.id]
              );

              console.log(`[Dolibarr Sync Logistique] Paiement prestataire:${o.prestataire_id} montant:${invoice.total_ttc}`);
              paid++;
              continue;
            }

            // Filtre sur le préfixe PRESTA-
            if (!invoice.ref_supplier?.startsWith('PRESTA-')) {
              console.log(`[Dolibarr Sync] Skip (pas de préfixe PRESTA-): ref_supplier="${invoice.ref_supplier}" id=${invoice.id}`);
              skippedNoPrefix++;
              continue;
            }

            // Mapping : "PRESTA-PIECES-mnt_xxx" → "PIECES-mnt_xxx"
            //           "PRESTA-GARAGE-mnt_xxx" → "GARAGE-mnt_xxx"
            const orderRef = invoice.ref_supplier.replace(/^PRESTA-/, '');
            console.log(`[Dolibarr Sync] Traitement: ref_supplier="${invoice.ref_supplier}" → orderRef="${orderRef}" blnkRef="${ref}"`);

            const order = await pool.query(
              `SELECT * FROM prestataire_orders WHERE reference = $1 AND status = 'CONFIRMED'`,
              [orderRef]
            );

            if (order.rows.length === 0) {
              const anyOrder = await pool.query(
                `SELECT reference, status FROM prestataire_orders WHERE reference = $1`,
                [orderRef]
              );
              if (anyOrder.rows.length > 0) {
                console.log(`[Dolibarr Sync] Order trouvé mais statut=${anyOrder.rows[0].status} (skip): ${orderRef}`);
              } else {
                console.log(`[Dolibarr Sync] Order prestataire introuvable en DB: "${orderRef}"`);
              }
              skippedNotFound++;
              continue;
            }

            const o = order.rows[0];
            console.log(`[Dolibarr Sync] Paiement: ${o.prestataire_id} — ${invoice.total_ttc} MAD — blnkRef="${ref}"`);

            await prestatairesService.pay(
              o.prestataire_id,
              parseFloat(invoice.total_ttc),
              ref,
              `Paiement prestataire — ${invoice.ref}`
            );

            await pool.query(
              `UPDATE prestataire_orders SET status = 'PAID', updated_at = NOW() WHERE id = $1`,
              [o.id]
            );

            console.log(`[Dolibarr Sync] ✅ Prestataire payé : ${invoice.ref} — ${invoice.total_ttc} MAD`);
            paid++;
          } catch (invoiceErr) {
            console.error(`[Dolibarr Sync] ❌ Erreur facture id=${invoice.id} ref_supplier="${invoice.ref_supplier}": ${invoiceErr.message}`);
          }
        }

        console.log(`[Dolibarr Sync] Résumé fournisseurs — payés: ${paid}, skip idempotency: ${skippedIdempotency}, skip no-prefix: ${skippedNoPrefix}, introuvable: ${skippedNotFound}`);
      }
    } catch (err) {
      console.error('[Dolibarr Sync] Erreur sync:', err.message);
    }
  },
};

module.exports = dolibarrSync;