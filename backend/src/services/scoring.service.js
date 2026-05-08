const pool = require('../config/db');
const blnkService = require('./blnk.service');

/**
 * Scoring client Kounhany
 * 
 * Score 0-100 basé sur 4 composantes :
 *   40% — Historique paiements  (transactions SUCCESS vs ERROR)
 *   30% — Volume activité       (nombre transactions + montants)
 *   20% — Santé financière      (ratio disponible/encours)
 *   10% — Ancienneté            (durée relation client)
 * 
 * Niveaux :
 *   80-100 → EXCELLENT  (vert)
 *   60-79  → BON        (bleu)
 *   40-59  → MOYEN      (orange)
 *   0-39   → RISQUÉ     (rouge)
 */

const scoringService = {

  /**
   * Calculer le score d'un client
   */
  async getClientScore(clientId) {
    const [txStats, orderStats, wallet, clientInfo] = await Promise.all([
      this._getTransactionStats(clientId),
      this._getOrderStats(clientId),
      this._getWalletHealth(clientId),
      this._getClientInfo(clientId),
    ]);

    // ── Composante 1 : Historique paiements (40%) ──────────────
    const scoreHistorique = this._scoreHistorique(txStats);

    // ── Composante 2 : Volume activité (30%) ───────────────────
    const scoreVolume = this._scoreVolume(txStats, orderStats);

    // ── Composante 3 : Santé financière (20%) ──────────────────
    const scoreSante = this._scoreSante(wallet);

    // ── Composante 4 : Ancienneté (10%) ────────────────────────
    const scoreAnciennete = this._scoreAnciennete(clientInfo);

    // ── Score final ─────────────────────────────────────────────
    const scoreTotal = Math.round(
      scoreHistorique * 0.40 +
      scoreVolume     * 0.30 +
      scoreSante      * 0.20 +
      scoreAnciennete * 0.10
    );

    const niveau = this._getNiveau(scoreTotal);
    const plafond = this._getPlafondCredit(scoreTotal, txStats);
    const delai = this._getDelaiPaiement(scoreTotal);

    return {
      client_id: clientId,
      score: scoreTotal,
      niveau,
      plafond_credit: plafond,
      delai_paiement: delai,
      details: {
        historique_paiements: {
          score: Math.round(scoreHistorique),
          poids: '40%',
          total_transactions: txStats.total,
          transactions_success: txStats.success,
          transactions_error: txStats.errors,
          taux_succes: txStats.total > 0
            ? Math.round((txStats.success / txStats.total) * 100)
            : 100,
        },
        volume_activite: {
          score: Math.round(scoreVolume),
          poids: '30%',
          total_transactions: txStats.total,
          volume_total: txStats.volume_total,
          commandes_confirmees: orderStats.confirmed,
          commandes_annulees: orderStats.cancelled,
        },
        sante_financiere: {
          score: Math.round(scoreSante),
          poids: '20%',
          disponible: wallet.available,
          bloque: wallet.blocked,
          creances: wallet.receivable,
          encours_total: wallet.blocked + wallet.receivable,
        },
        anciennete: {
          score: Math.round(scoreAnciennete),
          poids: '10%',
          client_depuis: clientInfo.created_at,
          jours_relation: clientInfo.jours,
        },
      },
      recommandations: this._getRecommandations(scoreTotal, txStats, wallet, orderStats),
      calculated_at: new Date(),
    };
  },

  /**
   * Calculer le score de tous les clients (pour dashboard)
   */
  async getAllScores() {
    const clients = await pool.query(`
      SELECT c.client_id, c.name, c.email, c.active
      FROM clients c
      JOIN client_wallets cw ON c.client_id = cw.client_id
      WHERE c.active = true
    `);

    const scores = await Promise.all(
      clients.rows.map(async (client) => {
        try {
          const score = await this.getClientScore(client.client_id);
          return {
            client_id: client.client_id,
            name: client.name,
            email: client.email,
            score: score.score,
            niveau: score.niveau,
            plafond_credit: score.plafond_credit,
            delai_paiement: score.delai_paiement,
          };
        } catch {
          return {
            client_id: client.client_id,
            name: client.name,
            email: client.email,
            score: 0,
            niveau: 'NOUVEAU',
            plafond_credit: 0,
            delai_paiement: 0,
          };
        }
      })
    );

    // Trier par score décroissant
    return scores.sort((a, b) => b.score - a.score);
  },

  // ── Helpers privés ───────────────────────────────────────────

  async _getTransactionStats(clientId) {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as success,
        COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as errors,
        COUNT(CASE WHEN type = 'PAYMENT' THEN 1 END) as payments,
        COUNT(CASE WHEN type = 'EXTERNAL_DEBT' THEN 1 END) as debts,
        COUNT(CASE WHEN type = 'EXTERNAL_PAYMENT' THEN 1 END) as ext_payments,
        COALESCE(SUM(CASE WHEN type = 'PAYMENT' THEN amount::numeric ELSE 0 END), 0) as volume_payments,
        COALESCE(SUM(amount::numeric), 0) as volume_total,
        MIN(created_at) as first_tx,
        MAX(created_at) as last_tx,
        -- Transactions récentes (30 derniers jours)
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_tx
      FROM transaction_logs
      WHERE client_id = $1
    `, [clientId]);

    const r = result.rows[0];
    return {
      total: parseInt(r.total),
      success: parseInt(r.success),
      errors: parseInt(r.errors),
      payments: parseInt(r.payments),
      debts: parseInt(r.debts),
      ext_payments: parseInt(r.ext_payments),
      volume_payments: parseFloat(r.volume_payments),
      volume_total: parseFloat(r.volume_total),
      first_tx: r.first_tx,
      last_tx: r.last_tx,
      recent_tx: parseInt(r.recent_tx),
    };
  },

  async _getOrderStats(clientId) {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('CONFIRMED', 'PAID') THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
        COUNT(CASE WHEN status = 'BLOCKED' THEN 1 END) as pending,
        COALESCE(SUM(CASE WHEN status IN ('CONFIRMED', 'PAID') THEN amount::numeric ELSE 0 END), 0) as volume_confirmed
      FROM orders
      WHERE client_id = $1
    `, [clientId]);

    const r = result.rows[0];
    return {
      total: parseInt(r.total),
      confirmed: parseInt(r.confirmed),
      cancelled: parseInt(r.cancelled),
      pending: parseInt(r.pending),
      volume_confirmed: parseFloat(r.volume_confirmed),
    };
  },

  async _getWalletHealth(clientId) {
    const wallet = await pool.query(
      'SELECT available_balance_id, blocked_balance_id, receivable_balance_id FROM client_wallets WHERE client_id = $1',
      [clientId]
    );

    if (wallet.rows.length === 0) return { available: 0, blocked: 0, receivable: 0 };

    const w = wallet.rows[0];
    try {
      const [avail, blocked, recv] = await Promise.all([
        blnkService.getBalance(w.available_balance_id),
        blnkService.getBalance(w.blocked_balance_id),
        blnkService.getBalance(w.receivable_balance_id),
      ]);
      return {
        available: avail.balance / 10000,
        blocked: blocked.balance / 10000,
        receivable: recv.balance / 10000,
      };
    } catch {
      return { available: 0, blocked: 0, receivable: 0 };
    }
  },

  async _getClientInfo(clientId) {
    const result = await pool.query(
      'SELECT created_at FROM clients WHERE client_id = $1',
      [clientId]
    );
    const createdAt = result.rows[0]?.created_at || new Date();
    const jours = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
    return { created_at: createdAt, jours };
  },

  // ── Algorithmes de scoring ───────────────────────────────────

  _scoreHistorique(txStats) {
    if (txStats.total === 0) return 50; // nouveau client — score neutre

    const tauxSucces = txStats.success / txStats.total;
    let score = tauxSucces * 100;

    // Bonus activité récente
    if (txStats.recent_tx > 0) score = Math.min(100, score + 5);

    // Malus si beaucoup d'erreurs
    if (txStats.errors > 3) score = Math.max(0, score - 10);

    return Math.min(100, Math.max(0, score));
  },

  _scoreVolume(txStats, orderStats) {
    let score = 0;

    // Score basé sur nombre de transactions (max 40 points)
    if (txStats.total >= 20) score += 40;
    else if (txStats.total >= 10) score += 30;
    else if (txStats.total >= 5) score += 20;
    else if (txStats.total >= 1) score += 10;

    // Score basé sur volume (max 40 points)
    if (txStats.volume_payments >= 10000) score += 40;
    else if (txStats.volume_payments >= 5000) score += 30;
    else if (txStats.volume_payments >= 1000) score += 20;
    else if (txStats.volume_payments >= 100) score += 10;

    // Bonus commandes confirmées (max 20 points)
    if (orderStats.confirmed >= 10) score += 20;
    else if (orderStats.confirmed >= 5) score += 15;
    else if (orderStats.confirmed >= 1) score += 10;

    // Malus annulations
    if (orderStats.total > 0) {
      const tauxAnnulation = orderStats.cancelled / orderStats.total;
      if (tauxAnnulation > 0.3) score = Math.max(0, score - 15);
    }

    return Math.min(100, Math.max(0, score));
  },

  _scoreSante(wallet) {
    const total = wallet.available + wallet.blocked + wallet.receivable;

    if (total === 0) return 50; // nouveau — score neutre

    // Ratio encours / total actifs
    const encours = wallet.blocked + wallet.receivable;
    const ratioEncours = total > 0 ? encours / total : 0;

    let score = 100;

    // Pénalité si encours > 50% des actifs
    if (ratioEncours > 0.8) score -= 40;
    else if (ratioEncours > 0.5) score -= 20;
    else if (ratioEncours > 0.3) score -= 10;

    // Bonus si solde disponible élevé
    if (wallet.available >= 5000) score = Math.min(100, score + 10);
    else if (wallet.available >= 1000) score = Math.min(100, score + 5);

    return Math.min(100, Math.max(0, score));
  },

  _scoreAnciennete(clientInfo) {
    const jours = clientInfo.jours;

    if (jours >= 365) return 100;
    if (jours >= 180) return 80;
    if (jours >= 90)  return 60;
    if (jours >= 30)  return 40;
    if (jours >= 7)   return 20;
    return 10;
  },

  // ── Output helpers ───────────────────────────────────────────

  _getNiveau(score) {
    if (score >= 80) return 'EXCELLENT';
    if (score >= 60) return 'BON';
    if (score >= 40) return 'MOYEN';
    return 'RISQUÉ';
  },

  _getPlafondCredit(score, txStats) {
    // Plafond basé sur score + historique volume
    const baseVolume = txStats.volume_payments || 0;
    const multiplicateur = score >= 80 ? 2.0
      : score >= 60 ? 1.5
      : score >= 40 ? 1.0
      : 0.5;

    const plafond = Math.max(1000, baseVolume * multiplicateur);
    return Math.round(plafond / 500) * 500; // arrondi à 500 MAD
  },

  _getDelaiPaiement(score) {
    if (score >= 80) return 45; // jours
    if (score >= 60) return 30;
    if (score >= 40) return 15;
    return 7;
  },

  _getRecommandations(score, txStats, wallet, orderStats) {
    const recs = [];

    if (txStats.total === 0) {
      recs.push({ type: 'info', message: 'Nouveau client — aucune donnée historique disponible' });
    }

    if (txStats.errors > 0) {
      recs.push({ type: 'warning', message: `${txStats.errors} erreur(s) de transaction détectée(s)` });
    }

    if (wallet.receivable > 1000) {
      recs.push({ type: 'warning', message: `Créances en attente élevées : ${wallet.receivable.toLocaleString('fr-FR')} MAD` });
    }

    if (score >= 80) {
      recs.push({ type: 'success', message: 'Client fiable — plafond de crédit élevé recommandé' });
    }

    if (orderStats.cancelled > 2) {
      recs.push({ type: 'warning', message: `${orderStats.cancelled} commande(s) annulée(s) — surveiller` });
    }

    if (txStats.recent_tx === 0 && txStats.total > 0) {
      recs.push({ type: 'info', message: 'Aucune activité dans les 30 derniers jours' });
    }

    return recs;
  },
};

module.exports = scoringService;