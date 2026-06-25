const pool = require('../config/db');
const blnkService = require('./blnk.service');
const walletService = require('./wallet.service');
const redis = require('../config/redis');

const CACHE_TTL = 300;        // 5 minutes — wallet balances
const CACHE_TTL_LIST = 60;    // 1 minute — liste prestataires

const prestatairesService = {

  // ─── FIND OR CREATE ───────────────────────────────────────────
  async findOrCreate({ garage_uuid, name, email, phone }) {
    const prestataireId = `prestataire_${garage_uuid}`;
    const cacheKey = `presta:${garage_uuid}`;

    // 1. Check cache Redis — évite un appel DB à chaque maintenance
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[Prestataire] Cache hit : ${name} (${prestataireId})`);
        return { prestataire_id: prestataireId, created: false };
      }
    } catch (err) {
      console.warn('[Prestataire] Redis get failed:', err.message);
    }

    // 2. Check DB — multi-champs pour éviter les doublons
    // Cherche par: prestataire_id exact, prefix garage_, colonne garage_uuid, colonne legacy_uuid
    const existing = await pool.query(
      `SELECT prestataire_id, name FROM prestataires
       WHERE prestataire_id = $1
          OR prestataire_id = $2
          OR (garage_uuid::text = $3 AND type = 'GARAGE')
          OR (legacy_uuid::text = $3 AND type = 'GARAGE')
       LIMIT 1`,
      [prestataireId, `garage_${garage_uuid}`, garage_uuid]
    );

    if (existing.rows.length > 0) {
      const foundId = existing.rows[0].prestataire_id;
      const existingName = existing.rows[0].name;
      const isGeneric = !existingName || existingName.startsWith('Prestataire-') || existingName === 'Garage Fleet';
      const isRealName = name && !name.startsWith('Prestataire-') && name !== 'Garage Fleet';

      if (isGeneric && isRealName) {
        try {
          await pool.query(
            'UPDATE prestataires SET name = $1, updated_at = NOW() WHERE prestataire_id = $2',
            [name, foundId]
          );
          await redis.del(cacheKey).catch(() => {});
          console.log(`[Prestataire] Nom mis à jour: "${existingName}" → "${name}" (${foundId})`);
        } catch (err) {
          console.warn('[Prestataire] Erreur mise à jour nom:', err.message);
        }
      }

      if (foundId !== prestataireId) {
        console.log(`[Prestataire] Doublon évité : ${prestataireId} → réutilise ${foundId}`);
      }

      try {
        await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ prestataire_id: foundId }));
      } catch (err) {
        console.warn('[Prestataire] Redis set failed:', err.message);
      }
      return { prestataire_id: foundId, created: false };
    }

    // 3. Créer wallets Blnk
    const ledger = await blnkService.createLedger(prestataireId, name);
    const [available, blocked, receivable] = await Promise.all([
      blnkService.createBalance(ledger.ledger_id, 'MAD', 'available', prestataireId),
      blnkService.createBalance(ledger.ledger_id, 'MAD', 'blocked', prestataireId),
      blnkService.createBalance(ledger.ledger_id, 'MAD', 'receivable', prestataireId),
    ]);

    // 4. Insérer en DB
    await pool.query(
      `INSERT INTO prestataires (prestataire_id, garage_uuid, name, email, phone)
       VALUES ($1, $2, $3, $4, $5)`,
      [prestataireId, garage_uuid, name, email || null, phone || null]
    );

    await pool.query(
      `INSERT INTO prestataire_wallets
       (prestataire_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [prestataireId, ledger.ledger_id, available.balance_id, blocked.balance_id, receivable.balance_id]
    );

    // 5. Mettre en cache
    try {
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ prestataire_id: prestataireId }));
      // Invalider cache liste
      await redis.del('presta:list');
    } catch (err) {
      console.warn('[Prestataire] Redis set failed:', err.message);
    }

    console.log(`[Prestataire] ✅ Wallet créé : ${name} (${prestataireId})`);
    return { prestataire_id: prestataireId, created: true };
  },

  // ─── FIND OR CREATE PIÈCES ────────────────────────────────────
  async findOrCreatePieces({ company_uuid, provider_name, company_name }) {
    const prestataireId = `pieces_${company_uuid}`;
    const cacheKey = `presta:pieces:${company_uuid}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[Prestataire] Cache hit pièces : ${prestataireId}`);
        return { pieces_prestataire_id: prestataireId, created: false };
      }
    } catch (err) {
      console.warn('[Prestataire] Redis get failed:', err.message);
    }

    const existing = await pool.query(
      'SELECT prestataire_id, name FROM prestataires WHERE prestataire_id = $1',
      [prestataireId]
    );

    const name = provider_name || company_name || `Pièces détachées — ${company_uuid}`;

    if (existing.rows.length > 0) {
      const existingName = existing.rows[0].name;
      const isGeneric = !existingName || existingName.startsWith('Pièces détachées — ');
      const isRealName = name && !name.startsWith('Pièces détachées — ');

      if (isGeneric && isRealName) {
        try {
          await pool.query(
            'UPDATE prestataires SET name = $1, updated_at = NOW() WHERE prestataire_id = $2',
            [name, prestataireId]
          );
          await redis.del(cacheKey).catch(() => {});
          console.log(`[Prestataire] Nom pièces mis à jour: "${existingName}" → "${name}" (${prestataireId})`);
        } catch (err) {
          console.warn('[Prestataire] Erreur mise à jour nom pièces:', err.message);
        }
      }

      try {
        await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ pieces_prestataire_id: prestataireId }));
      } catch (err) {
        console.warn('[Prestataire] Redis set failed:', err.message);
      }
      return { pieces_prestataire_id: prestataireId, created: false };
    }
    const ledger = await blnkService.createLedger(prestataireId, name);
    const [available, blocked, receivable] = await Promise.all([
      blnkService.createBalance(ledger.ledger_id, 'MAD', 'available', prestataireId),
      blnkService.createBalance(ledger.ledger_id, 'MAD', 'blocked', prestataireId),
      blnkService.createBalance(ledger.ledger_id, 'MAD', 'receivable', prestataireId),
    ]);

    await pool.query(
      `INSERT INTO prestataires (prestataire_id, garage_uuid, name)
       VALUES ($1, $2, $3)`,
      [prestataireId, company_uuid, name]
    );

    await pool.query(
      `INSERT INTO prestataire_wallets
       (prestataire_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [prestataireId, ledger.ledger_id, available.balance_id, blocked.balance_id, receivable.balance_id]
    );

    try {
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify({ pieces_prestataire_id: prestataireId }));
      await redis.del('presta:list');
    } catch (err) {
      console.warn('[Prestataire] Redis set failed:', err.message);
    }

    console.log(`[Prestataire] ✅ Wallet pièces créé (${prestataireId})`);
    return { pieces_prestataire_id: prestataireId, created: true };
  },

  // ─── LIST ─────────────────────────────────────────────────────
  async list() {
    const cacheKey = 'presta:list';

    // Check cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('[Prestataire] Redis get failed:', err.message);
    }

    const result = await pool.query(
      `SELECT p.*, pw.currency
       FROM prestataires p
       LEFT JOIN prestataire_wallets pw ON p.prestataire_id = pw.prestataire_id
       ORDER BY p.name ASC`
    );

    // Mettre en cache
    try {
      await redis.setEx(cacheKey, CACHE_TTL_LIST, JSON.stringify(result.rows));
    } catch (err) {
      console.warn('[Prestataire] Redis set failed:', err.message);
    }

    return result.rows;
  },

  // ─── GET ONE ──────────────────────────────────────────────────
  async getOne(prestataireId) {
    const cacheKey = `presta:one:${prestataireId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (err) {
      console.warn('[Prestataire] Redis get failed:', err.message);
    }

    const result = await pool.query(
      'SELECT * FROM prestataires WHERE prestataire_id = $1',
      [prestataireId]
    );

    if (result.rows.length === 0) return null;

    try {
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(result.rows[0]));
    } catch (err) {
      console.warn('[Prestataire] Redis set failed:', err.message);
    }

    return result.rows[0];
  },

  // ─── GET WALLET ───────────────────────────────────────────────
  async getWallet(prestataireId) {
    const walletResult = await pool.query(
      'SELECT * FROM prestataire_wallets WHERE prestataire_id = $1',
      [prestataireId]
    );
    if (walletResult.rows.length === 0) throw new Error('Wallet introuvable');

    const wallet = walletResult.rows[0];

    // Balances Blnk — cache 30s (données temps réel)
    const cacheKey = `presta:balances:${prestataireId}`;
    let accounts;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        accounts = JSON.parse(cached);
      }
    } catch (err) {
      console.warn('[Prestataire] Redis get failed:', err.message);
    }

    if (!accounts) {
      const [available, blocked, receivable] = await Promise.all([
        blnkService.getBalance(wallet.available_balance_id),
        blnkService.getBalance(wallet.blocked_balance_id),
        blnkService.getBalance(wallet.receivable_balance_id),
      ]);

      accounts = {
        available: {
          balance: available.balance / 10000,
          credit_balance: available.credit_balance / 10000,
          debit_balance: available.debit_balance / 10000,
        },
        blocked: {
          balance: blocked.balance / 10000,
          credit_balance: blocked.credit_balance / 10000,
          debit_balance: blocked.debit_balance / 10000,
        },
        receivable: {
          balance: receivable.balance / 10000,
          credit_balance: receivable.credit_balance / 10000,
          debit_balance: receivable.debit_balance / 10000,
        },
      };

      try {
        await redis.setEx(cacheKey, 30, JSON.stringify(accounts));
      } catch (err) {
        console.warn('[Prestataire] Redis set failed:', err.message);
      }
    }

    return {
      currency: wallet.currency,
      created_at: wallet.created_at,
      accounts,
    };
  },

  // ─── GET ORDERS ───────────────────────────────────────────────
  async getOrders(prestataireId) {
    const result = await pool.query(
      `SELECT * FROM prestataire_orders
       WHERE prestataire_id = $1
       ORDER BY created_at DESC`,
      [prestataireId]
    );
    return result.rows;
  },

  // ─── PAY ──────────────────────────────────────────────────────
  async pay(prestataireId, amount, reference, description) {
    const result = await walletService.pay(prestataireId, amount, reference, description);

    // Invalider cache balances après transaction
    try {
      await redis.del(`presta:balances:${prestataireId}`);
    } catch (err) {
      console.warn('[Prestataire] Redis del failed:', err.message);
    }

    return result;
  },

  // ─── INVALIDER CACHE (utile après actions wallet) ─────────────
  async invalidateCache(prestataireId) {
    try {
      await Promise.all([
        redis.del(`presta:balances:${prestataireId}`),
        redis.del(`presta:one:${prestataireId}`),
        redis.del('presta:list'),
      ]);
    } catch (err) {
      console.warn('[Prestataire] Redis invalidate failed:', err.message);
    }
  },
};

module.exports = prestatairesService;