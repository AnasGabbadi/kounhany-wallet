const pool = require('../config/db');
const blnkService = require('../services/blnk.service');
const { v4: uuidv4 } = require('uuid');

// Groupes admin — pas de wallet créé
const IGNORED_GROUPS = (process.env.SCIM_IGNORED_GROUPS || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

const PRESTATAIRE_GROUPS = (process.env.SCIM_PRESTATAIRE_GROUPS || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

const PARENT_GROUPS = (process.env.SCIM_PARENT_GROUPS || '')
    .split(',')
    .map(g => g.trim())
    .filter(Boolean);

function formatUser(client) {
    return {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: client.scim_id || client.client_id,
        userName: client.email,
        name: { formatted: client.name },
        emails: [{ value: client.email || '', primary: true }],
        active: client.active !== false,
        meta: {
            resourceType: 'User',
            created: client.created_at,
            lastModified: client.updated_at || client.created_at,
        },
    };
}

const scimController = {

    async serviceProviderConfig(req, res) {
        res.json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
            patch: { supported: true },
            bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
            filter: { supported: true, maxResults: 100 },
            changePassword: { supported: false },
            sort: { supported: false },
            etag: { supported: false },
        });
    },

    async schemas(req, res) {
        res.json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 1,
            Resources: [],
        });
    },

    async resourceTypes(req, res) {
        res.json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 1,
            Resources: [{
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
                id: 'User',
                name: 'User',
                endpoint: '/Users',
                schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
            }],
        });
    },

    async listUsers(req, res) {
        try {
            const result = await pool.query('SELECT * FROM clients ORDER BY created_at DESC');
            res.json({
                schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
                totalResults: result.rows.length,
                startIndex: 1,
                itemsPerPage: result.rows.length,
                Resources: result.rows.map(formatUser),
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async getUser(req, res) {
        try {
            const result = await pool.query(
                'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1',
                [req.params.id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    status: 404,
                    detail: 'User not found',
                });
            }
            res.json(formatUser(result.rows[0]));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    async createUser(req, res) {
        try {
            const { id, userName, name, emails, groups } = req.body;
            const groupNames = (groups || []).map(g => g.display).filter(Boolean);
            const groupIds = (groups || []).map(g => g.value).filter(Boolean);

            const GARAGE_GROUP_ID = process.env.SCIM_GARAGE_GROUP_ID;
            const PROVIDER_GROUP_ID = process.env.SCIM_PROVIDER_GROUP_ID;

            // Ignorer les admins
            const isAdmin = groupNames.some(g => IGNORED_GROUPS.includes(g));
            if (isAdmin) {
                console.log(`[SCIM] Admin ignoré : ${userName}`);
                return res.status(201).json({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    id: id || uuidv4(),
                    userName,
                    active: false,
                });
            }

            const email = emails?.[0]?.value || userName;
            const displayName = name?.formatted || name?.givenName || userName;
            const scimId = id || uuidv4();

            // Détecter type depuis les groupes
            const isGarage = groupNames.includes('Garages') || groupIds.includes(GARAGE_GROUP_ID);
            const isProvider = groupNames.includes('Providers') || groupIds.includes(PROVIDER_GROUP_ID);
            const isPrestataire = isGarage || isProvider;
            const prestataireType = isGarage ? 'GARAGE' : isProvider ? 'PROVIDER' : null;

            // Source de vérité : userName contient l'UUID Kounhany
            const usernameBase = (userName || '').split('@')[0];
            let clientId;
            if (usernameBase.startsWith('garage_')) {
                clientId = usernameBase;
            } else if (usernameBase.startsWith('provider_')) {
                clientId = usernameBase;
            } else if (usernameBase.startsWith('b2c_')) {
                clientId = usernameBase;
            } else {
                clientId = `client_${Date.now()}`;
            }

            // Détecter B2C depuis le groupe ou le préfixe userName
            const isB2C = groupNames.includes('B2C') || usernameBase.startsWith('b2c_');

            // Vérifier doublon par clientId OU email
            const existing = await pool.query(
                'SELECT * FROM clients WHERE client_id = $1 OR email = $2',
                [clientId, email]
            );

            if (existing.rows.length > 0) {
                console.log(`[SCIM] User déjà existant : ${email} (${clientId})`);
                // Corriger client_type si B2C mais type manquant
                if (isB2C && existing.rows[0].client_type !== 'B2C') {
                    await pool.query(
                        'UPDATE clients SET client_type = $1, scim_id = $2, updated_at = NOW() WHERE client_id = $3',
                        ['B2C', scimId, existing.rows[0].client_id]
                    );
                    console.log(`[SCIM] Client_type corrigé → B2C : ${existing.rows[0].client_id}`);
                }
            } else {
                // Extraire le kounhany_uuid depuis le userName (garage_, provider_ ou b2c_)
                const kounhanyUuid = (() => {
                    const match = (userName || '').match(/^(?:garage|provider|b2c)_([0-9a-f-]{36})$/i);
                    return match ? match[1] : null;
                })();

                const clientType = isPrestataire ? 'PRESTATAIRE' : (isB2C ? 'B2C' : null);
                await pool.query(
                    `INSERT INTO clients (client_id, name, email, scim_id, client_type, kounhany_uuid)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [clientId, displayName, email, scimId, clientType, kounhanyUuid]
                );
                console.log(`[SCIM] ✅ Client créé : ${displayName} (${clientId}) type: ${clientType}`);
            }

            // Créer wallet B2C si b2c user
            if (isB2C && !isPrestataire) {
                const walletCheck = await pool.query(
                    'SELECT * FROM client_wallets WHERE client_id = $1',
                    [existing.rows.length > 0 ? existing.rows[0].client_id : clientId]
                );
                const walletClientId = existing.rows.length > 0 ? existing.rows[0].client_id : clientId;
                if (walletCheck.rows.length === 0) {
                    const ledger = await blnkService.createLedger(walletClientId, displayName);
                    const ledgerId = ledger.ledger_id;
                    const [available, blocked, receivable] = await Promise.all([
                        blnkService.createBalance(ledgerId, 'MAD', 'available', walletClientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'blocked',   walletClientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'receivable', walletClientId),
                    ]);
                    await pool.query(
                        `INSERT INTO client_wallets
                         (client_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [walletClientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                    );
                    console.log(`[SCIM] ✅ Wallet B2C créé : ${displayName} (${walletClientId})`);
                }
                const client = await pool.query('SELECT * FROM clients WHERE client_id = $1', [walletClientId]);
                return res.status(201).json(formatUser(client.rows[0]));
            }

            // Créer wallet prestataire si garage ou provider
            if (isPrestataire) {
                const existingPresta = await pool.query(
                    'SELECT * FROM prestataires WHERE prestataire_id = $1', [clientId]
                );
                if (existingPresta.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO prestataires (prestataire_id, name, email, type)
                     VALUES ($1, $2, $3, $4)`,
                        [clientId, displayName, email, prestataireType]
                    );
                }

                const walletCheck = await pool.query(
                    'SELECT * FROM prestataire_wallets WHERE prestataire_id = $1', [clientId]
                );
                if (walletCheck.rows.length === 0) {
                    const ledger = await blnkService.createLedger(clientId, displayName);
                    const ledgerId = ledger.ledger_id;
                    const [available, blocked, receivable] = await Promise.all([
                        blnkService.createBalance(ledgerId, 'MAD', 'available', clientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'blocked', clientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'receivable', clientId),
                    ]);
                    await pool.query(
                        `INSERT INTO prestataire_wallets
                     (prestataire_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                        [clientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                    );
                    console.log(`[SCIM] ✅ Wallet ${prestataireType} créé : ${displayName} (${clientId})`);
                }
            }

            const client = await pool.query(
                'SELECT * FROM clients WHERE client_id = $1', [clientId]
            );
            res.status(201).json(formatUser(client.rows[0]));

        } catch (err) {
            console.error('[SCIM] Erreur createUser:', err.message);
            res.status(500).json({ error: err.message });
        }
    },

    async updateUser(req, res) {
        try {
            const { name, emails, active } = req.body;
            const email = emails?.[0]?.value;
            const displayName = name?.formatted;

            const result = await pool.query(
                'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1',
                [req.params.id]
            );

            // Si pas trouvé → retourner 200 sans erreur
            if (result.rows.length === 0) {
                return res.json({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    id: req.params.id,
                    userName: email || req.params.id,
                    active: false,
                });
            }

            const client = result.rows[0];

            // ← Si active = false → vérifier transactions
            if (active === false) {
                const txCheck = await pool.query(
                    'SELECT COUNT(*) FROM transaction_logs WHERE client_id = $1',
                    [client.client_id]
                );
                const hasTransactions = parseInt(txCheck.rows[0].count) > 0;

                if (hasTransactions) {
                    // Garder pour traçabilité
                    await pool.query(
                        'UPDATE clients SET active = false, updated_at = NOW() WHERE client_id = $1',
                        [client.client_id]
                    );
                    console.log(`[SCIM] Client désactivé (a des transactions) : ${client.name}`);
                } else {
                    // Supprimer définitivement
                    await pool.query('DELETE FROM client_wallets WHERE client_id = $1', [client.client_id]);
                    await pool.query('DELETE FROM clients WHERE client_id = $1', [client.client_id]);
                    console.log(`[SCIM] Client supprimé définitivement : ${client.name}`);
                    return res.json({
                        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                        id: req.params.id,
                        active: false,
                    });
                }

                const updated = await pool.query(
                    'SELECT * FROM clients WHERE client_id = $1', [client.client_id]
                );
                return res.json(formatUser(updated.rows[0]));
            }

            // Mise à jour normale
            await pool.query(
                `UPDATE clients SET 
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        updated_at = NOW()
       WHERE client_id = $3`,
                [displayName, email, client.client_id]
            );

            const updated = await pool.query(
                'SELECT * FROM clients WHERE client_id = $1', [client.client_id]
            );

            res.json(formatUser(updated.rows[0]));
        } catch (err) {
            console.error('[SCIM] Erreur updateUser:', err.message);
            res.status(500).json({ error: err.message });
        }
    },

    async patchUser(req, res) {
        try {
            const { Operations } = req.body;

            const result = await pool.query(
                'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1',
                [req.params.id]
            );

            if (result.rows.length === 0) {
                return res.json({
                    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                    id: req.params.id,
                    active: false,
                });
            }

            for (const op of Operations || []) {
                if (op.op === 'replace' && op.value?.active === false) {
                    await pool.query(
                        'UPDATE clients SET active = false WHERE scim_id = $1 OR client_id = $1',
                        [req.params.id]
                    );
                }
            }

            const updated = await pool.query(
                'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1',
                [req.params.id]
            );

            res.json(formatUser(updated.rows[0]));
        } catch (err) {
            console.error('[SCIM] Erreur patchUser:', err.message);
            res.status(500).json({ error: err.message });
        }
    },

    async deleteUser(req, res) {
        try {
            const clientResult = await pool.query(
                'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1',
                [req.params.id]
            );

            if (clientResult.rows.length === 0) {
                return res.status(204).send();
            }

            const client = clientResult.rows[0];

            // Vérifier s'il a des transactions
            const txCheck = await pool.query(
                'SELECT COUNT(*) FROM transaction_logs WHERE client_id = $1',
                [client.client_id]
            );
            const hasTransactions = parseInt(txCheck.rows[0].count) > 0;

            if (hasTransactions) {
                // Garder pour traçabilité — juste désactiver
                await pool.query(
                    'UPDATE clients SET active = false, updated_at = NOW() WHERE client_id = $1',
                    [client.client_id]
                );
                console.log(`[SCIM] Client désactivé (a des transactions) : ${client.name}`);
            } else {
                // Supprimer définitivement
                await pool.query('DELETE FROM client_wallets WHERE client_id = $1', [client.client_id]);
                await pool.query('DELETE FROM clients WHERE client_id = $1', [client.client_id]);
                console.log(`[SCIM] Client supprimé définitivement : ${client.name}`);
            }

            res.status(204).send();
        } catch (err) {
            console.error('[SCIM] Erreur deleteUser:', err.message);
            res.status(500).json({ error: err.message });
        }
    },

    async listGroups(req, res) {
        res.json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
            totalResults: 0, startIndex: 1, itemsPerPage: 0, Resources: [],
        });
    },

    async getGroup(req, res) {
        res.status(404).json({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
            status: 404,
        });
    },

    async createGroup(req, res) {
        const id = uuidv4();
        const externalId = req.body.externalId || req.body.id;
        res.status(201).json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
            id,
            externalId,
            displayName: req.body.displayName,
            meta: {
                resourceType: 'Group',
                location: `/scim/v2/Groups/${id}`,
            },
        });
    },

    async updateGroup(req, res) {
        try {
            const { displayName, members } = req.body;
            const groupId = req.params.id;

            console.log('[SCIM RAW updateGroup]', JSON.stringify({ displayName, members }));
            console.log(`[SCIM] updateGroup: ${displayName} (${groupId}) — ${(members || []).length} members`);

            const B2B_PARENT_GROUPS = ['Fleet', 'Logistique'];
            const isParentGroup = B2B_PARENT_GROUPS.includes(displayName);
            const isCompanyGroup = !isParentGroup &&
                !['authentik Admins', 'Wallet Admins', 'Monitoring Admins', 'B2C',
                    'Garages', 'Providers', 'Prestataires'].includes(displayName);

            // ── CAS B2B company → wallet company partagé ──
            if (isCompanyGroup && members && members.length > 0) {
                const companyClientId = `company_${groupId}`;
                const companyName = displayName;

                let existingCompany = await pool.query(
                    'SELECT * FROM clients WHERE client_id = $1',
                    [companyClientId]
                );

                // Fallback par nom : Authentik peut envoyer un UUID différent à chaque push
                if (existingCompany.rows.length === 0) {
                    existingCompany = await pool.query(
                        "SELECT * FROM clients WHERE name = $1 AND client_type = 'FLEET'",
                        [companyName]
                    );
                    if (existingCompany.rows.length > 0) {
                        console.log(`[SCIM] ℹ️ Company trouvée par nom (UUID rotatif) : ${companyName} → ${existingCompany.rows[0].client_id}`);
                    }
                }

                if (existingCompany.rows.length === 0) {
                    console.log(`[SCIM] Création wallet company: ${companyName}`);
                    const ledger = await blnkService.createLedger(companyClientId, companyName);
                    const ledgerId = ledger.ledger_id;

                    const [available, blocked, receivable] = await Promise.all([
                        blnkService.createBalance(ledgerId, 'MAD', 'available', companyClientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'blocked', companyClientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'receivable', companyClientId),
                    ]);

                    await pool.query(
                        `INSERT INTO clients (client_id, name, email, scim_id, client_type)
                     VALUES ($1, $2, $3, NULL, 'FLEET')`,
                        [companyClientId, companyName, null]
                    );

                    await pool.query(
                        `INSERT INTO client_wallets 
                     (client_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                        [companyClientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                    );

                    console.log(`[SCIM] ✅ Wallet company créé : ${companyName} (${companyClientId})`);
                } else {
                    console.log(`[SCIM] ℹ️ Client company existant : ${companyName}`);
                    const walletCheck = await pool.query(
                        'SELECT client_id FROM client_wallets WHERE client_id = $1',
                        [companyClientId]
                    );
                    if (walletCheck.rows.length === 0) {
                        console.log(`[SCIM] ⚠️ Wallet manquant pour company existante — recréation : ${companyName}`);
                        const ledger = await blnkService.createLedger(companyClientId, companyName);
                        const ledgerId = ledger.ledger_id;
                        const [available, blocked, receivable] = await Promise.all([
                            blnkService.createBalance(ledgerId, 'MAD', 'available', companyClientId),
                            blnkService.createBalance(ledgerId, 'MAD', 'blocked', companyClientId),
                            blnkService.createBalance(ledgerId, 'MAD', 'receivable', companyClientId),
                        ]);
                        await pool.query(
                            `INSERT INTO client_wallets
                             (client_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [companyClientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                        );
                        console.log(`[SCIM] ✅ Wallet company recréé : ${companyName} (${companyClientId})`);
                    } else {
                        console.log(`[SCIM] ✅ Wallet company OK : ${companyName}`);
                    }
                }

                // ── Lier tous les members au wallet company ──
                for (const member of members) {
                    // Chercher par scim_id (UUID Authentik) OU par email (member.display = username SCIM)
                    const memberEmail = (member.display || '').includes('@') ? member.display : null;
                    const upd = await pool.query(
                        `UPDATE clients
                         SET company_client_id = $1, client_type = 'FLEET', updated_at = NOW()
                         WHERE (scim_id = $2 OR ($3::text IS NOT NULL AND email = $3))
                           AND company_client_id IS DISTINCT FROM $1`,
                        [companyClientId, member.value, memberEmail]
                    );
                    if (upd.rowCount > 0) {
                        console.log(`[SCIM] ✅ User lié : ${member.display || member.value} → ${companyClientId}`);
                    } else {
                        console.warn(`[SCIM] ⚠️ User non trouvé pour liaison company : scim_id=${member.value} display=${member.display}`);
                    }
                }
            }

            // ── CAS B2C → wallet individuel ──
            if (displayName === 'B2C' && members && members.length > 0) {
                for (const member of members) {
                    const clientResult = await pool.query(
                        'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1',
                        [member.value]
                    );
                    if (clientResult.rows.length === 0) {
                        console.warn(`[SCIM] ⚠️ B2C member non trouvé en DB — scim_id: ${member.value} display: ${member.display || 'N/A'}`);
                        continue;
                    }
                    const client = clientResult.rows[0];

                    const walletCheck = await pool.query(
                        'SELECT * FROM client_wallets WHERE client_id = $1',
                        [client.client_id]
                    );
                    if (walletCheck.rows.length > 0) continue;

                    const ledger = await blnkService.createLedger(client.client_id, client.name);
                    const ledgerId = ledger.ledger_id;
                    const [available, blocked, receivable] = await Promise.all([
                        blnkService.createBalance(ledgerId, 'MAD', 'available', client.client_id),
                        blnkService.createBalance(ledgerId, 'MAD', 'blocked', client.client_id),
                        blnkService.createBalance(ledgerId, 'MAD', 'receivable', client.client_id),
                    ]);
                    await pool.query(
                        `INSERT INTO client_wallets 
                     (client_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                     VALUES ($1, $2, $3, $4, $5)`,
                        [client.client_id, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                    );
                    await pool.query(
                        'UPDATE clients SET client_type = $1 WHERE client_id = $2',
                        ['B2C', client.client_id]
                    );
                    console.log(`[SCIM] ✅ Wallet B2C créé : ${client.name}`);
                }
            }

            // ── Helper : créer wallet prestataire ──
            const createPrestataireWallet = async (client, type, entityUuid) => {
                // Insérer dans prestataires si pas déjà là
                const existingPresta = await pool.query(
                    'SELECT * FROM prestataires WHERE prestataire_id = $1',
                    [client.client_id]
                );

                if (existingPresta.rows.length === 0) {
                    await pool.query(
                        `INSERT INTO prestataires (prestataire_id, garage_uuid, name, email, type)
             VALUES ($1, $2, $3, $4, $5)`,
                        [client.client_id, entityUuid, client.name, client.email, type]
                    );
                }

                // Vérifier wallet
                const walletCheck = await pool.query(
                    'SELECT * FROM prestataire_wallets WHERE prestataire_id = $1',
                    [client.client_id]
                );
                if (walletCheck.rows.length > 0) {
                    console.log(`[SCIM] ℹ️ Wallet ${type} existant : ${client.name}`);
                    return;
                }

                // Créer wallet Blnk
                const ledger = await blnkService.createLedger(client.client_id, client.name);
                const ledgerId = ledger.ledger_id;
                const [available, blocked, receivable] = await Promise.all([
                    blnkService.createBalance(ledgerId, 'MAD', 'available', client.client_id),
                    blnkService.createBalance(ledgerId, 'MAD', 'blocked', client.client_id),
                    blnkService.createBalance(ledgerId, 'MAD', 'receivable', client.client_id),
                ]);

                await pool.query(
                    `INSERT INTO prestataire_wallets 
                        (prestataire_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id, currency)
                        VALUES ($1, $2, $3, $4, $5, 'MAD')`,
                    [client.client_id, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                );

                await pool.query(
                    'UPDATE clients SET client_type = $1 WHERE client_id = $2',
                    ['PRESTATAIRE', client.client_id]
                );

                console.log(`[SCIM] ✅ Wallet ${type} créé : ${client.name} (${client.client_id})`);
            };

            // ── CAS GARAGES ──
            if (displayName === 'Garages' && members && members.length > 0) {
                for (const member of members) {
                    // Chercher par scim_id OU client_id (legacy: ancien code retournait client_id comme SCIM ID)
                    let clientResult = await pool.query(
                        'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1 OR client_id = $2',
                        [member.value, `garage_${member.value}`]
                    );

                    // Si toujours pas trouvé → créer entrée minimale à partir des infos du groupe
                    if (clientResult.rows.length === 0) {
                        console.warn(`[SCIM] ⚠️ Garages member non trouvé en DB — scim_id: ${member.value} display: ${member.display || 'N/A'} — création entrée minimale`);
                        const garageClientId = `garage_${member.value}`;
                        const garageName = member.display || `Garage ${member.value}`;
                        await pool.query(
                            `INSERT INTO clients (client_id, name, email, scim_id, client_type)
                             VALUES ($1, $2, NULL, $3, 'PRESTATAIRE')
                             ON CONFLICT DO NOTHING`,
                            [garageClientId, garageName, member.value]
                        );
                        clientResult = await pool.query(
                            'SELECT * FROM clients WHERE client_id = $1', [garageClientId]
                        );
                        if (clientResult.rows.length === 0) continue;
                    }

                    const client = clientResult.rows[0];

                    // Renommer client_id si encore au format client_xxx
                    let clientId = client.client_id;
                    if (!clientId.startsWith('garage_')) {
                        const newClientId = `garage_${member.value}`;
                        // Vérifier pas de doublon
                        const dupCheck = await pool.query(
                            'SELECT client_id FROM clients WHERE client_id = $1', [newClientId]
                        );
                        if (dupCheck.rows.length === 0) {
                            await pool.query(
                                'UPDATE clients SET client_id = $1, client_type = $2, updated_at = NOW() WHERE scim_id = $3',
                                [newClientId, 'PRESTATAIRE', member.value]
                            );
                            clientId = newClientId;
                            console.log(`[SCIM] Client renommé : ${client.client_id} → ${newClientId}`);
                        } else {
                            clientId = newClientId;
                        }
                    }

                    // Insérer dans prestataires si pas déjà là
                    const existingPresta = await pool.query(
                        'SELECT * FROM prestataires WHERE prestataire_id = $1', [clientId]
                    );
                    if (existingPresta.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO prestataires (prestataire_id, name, email, phone, type)
                            VALUES ($1, $2, $3, $4, 'GARAGE')`,
                            [clientId, client.name, client.email, client.phone]
                        );
                    }

                    // Créer wallet si pas déjà là
                    const walletCheck = await pool.query(
                        'SELECT * FROM prestataire_wallets WHERE prestataire_id = $1', [clientId]
                    );
                    if (walletCheck.rows.length > 0) {
                        console.log(`[SCIM] ℹ️ Wallet GARAGE existant : ${client.name}`);
                        continue;
                    }

                    const ledger = await blnkService.createLedger(clientId, client.name);
                    const ledgerId = ledger.ledger_id;
                    const [available, blocked, receivable] = await Promise.all([
                        blnkService.createBalance(ledgerId, 'MAD', 'available', clientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'blocked', clientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'receivable', clientId),
                    ]);
                    await pool.query(
                        `INSERT INTO prestataire_wallets
                        (prestataire_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                        VALUES ($1, $2, $3, $4, $5)`,
                        [clientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                    );
                    console.log(`[SCIM] ✅ Wallet GARAGE créé : ${client.name} (${clientId})`);
                }
            }

            // ── CAS PROVIDERS ──
            if (displayName === 'Providers' && members && members.length > 0) {
                for (const member of members) {
                    let clientResult = await pool.query(
                        'SELECT * FROM clients WHERE scim_id = $1 OR client_id = $1 OR client_id = $2',
                        [member.value, `provider_${member.value}`]
                    );

                    if (clientResult.rows.length === 0) {
                        console.warn(`[SCIM] ⚠️ Providers member non trouvé en DB — scim_id: ${member.value} display: ${member.display || 'N/A'} — création entrée minimale`);
                        const providerClientId = `provider_${member.value}`;
                        const providerName = member.display || `Provider ${member.value}`;
                        await pool.query(
                            `INSERT INTO clients (client_id, name, email, scim_id, client_type)
                             VALUES ($1, $2, NULL, $3, 'PRESTATAIRE')
                             ON CONFLICT DO NOTHING`,
                            [providerClientId, providerName, member.value]
                        );
                        clientResult = await pool.query(
                            'SELECT * FROM clients WHERE client_id = $1', [providerClientId]
                        );
                        if (clientResult.rows.length === 0) continue;
                    }

                    const client = clientResult.rows[0];

                    let clientId = client.client_id;
                    if (!clientId.startsWith('provider_')) {
                        const newClientId = `provider_${member.value}`;
                        const dupCheck = await pool.query(
                            'SELECT client_id FROM clients WHERE client_id = $1', [newClientId]
                        );
                        if (dupCheck.rows.length === 0) {
                            await pool.query(
                                'UPDATE clients SET client_id = $1, client_type = $2, updated_at = NOW() WHERE scim_id = $3',
                                [newClientId, 'PRESTATAIRE', member.value]
                            );
                            clientId = newClientId;
                            console.log(`[SCIM] Client renommé : ${client.client_id} → ${newClientId}`);
                        } else {
                            clientId = newClientId;
                        }
                    }

                    const existingPresta = await pool.query(
                        'SELECT * FROM prestataires WHERE prestataire_id = $1', [clientId]
                    );
                    if (existingPresta.rows.length === 0) {
                        await pool.query(
                            `INSERT INTO prestataires (prestataire_id, name, email, phone, type)
                            VALUES ($1, $2, $3, $4, 'PROVIDER')`,
                            [clientId, client.name, client.email, client.phone]
                        );
                    }

                    const walletCheck = await pool.query(
                        'SELECT * FROM prestataire_wallets WHERE prestataire_id = $1', [clientId]
                    );
                    if (walletCheck.rows.length > 0) {
                        console.log(`[SCIM] ℹ️ Wallet PROVIDER existant : ${client.name}`);
                        continue;
                    }

                    const ledger = await blnkService.createLedger(clientId, client.name);
                    const ledgerId = ledger.ledger_id;
                    const [available, blocked, receivable] = await Promise.all([
                        blnkService.createBalance(ledgerId, 'MAD', 'available', clientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'blocked', clientId),
                        blnkService.createBalance(ledgerId, 'MAD', 'receivable', clientId),
                    ]);
                    await pool.query(
                        `INSERT INTO prestataire_wallets
                        (prestataire_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
                        VALUES ($1, $2, $3, $4, $5)`,
                        [clientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
                    );
                    console.log(`[SCIM] ✅ Wallet PROVIDER créé : ${client.name} (${clientId})`);
                }
            }

            res.json({
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                id: groupId,
                displayName,
            });
        } catch (err) {
            console.error('[SCIM] Erreur updateGroup:', err.message);
            res.status(500).json({ error: err.message });
        }
    },

    async deleteGroup(req, res) {
        res.status(204).send();
    },
};

module.exports = scimController;