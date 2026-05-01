const pool = require('../config/db');
const blnkService = require('../services/blnk.service');
const { v4: uuidv4 } = require('uuid');

// Groupes admin — pas de wallet créé
const IGNORED_GROUPS = (process.env.SCIM_IGNORED_GROUPS || 'authentik Admins,Wallet Admins')
    .split(',')
    .map(g => g.trim());

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

            const groupNames = (groups || []).map(g => g.display);

            // Ignorer les admins IDP
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

            // Vérifier doublon
            const existing = await pool.query(
                'SELECT * FROM clients WHERE scim_id = $1 OR email = $2',
                [scimId, email]
            );
            if (existing.rows.length > 0) {
                console.log(`[SCIM] User déjà existant : ${email}`);
                return res.status(409).json({
                    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
                    status: 409,
                    detail: 'User already exists',
                });
            }

            const clientId = `client_${Date.now()}`;

            // Créer ledger Blnk
            const ledger = await blnkService.createLedger(clientId, displayName);
            const ledgerId = ledger.ledger_id;

            // Créer 3 comptes Blnk
            const [available, blocked, receivable] = await Promise.all([
                blnkService.createBalance(ledgerId, 'MAD', 'available', clientId),
                blnkService.createBalance(ledgerId, 'MAD', 'blocked', clientId),
                blnkService.createBalance(ledgerId, 'MAD', 'receivable', clientId),
            ]);

            // Créer client en DB — client_type NULL
            await pool.query(
                `INSERT INTO clients (client_id, name, email, scim_id, client_type)
         VALUES ($1, $2, $3, $4, NULL)`,
                [clientId, displayName, email, scimId]
            );

            // Créer wallet
            await pool.query(
                `INSERT INTO client_wallets 
         (client_id, ledger_id, available_balance_id, blocked_balance_id, receivable_balance_id)
         VALUES ($1, $2, $3, $4, $5)`,
                [clientId, ledgerId, available.balance_id, blocked.balance_id, receivable.balance_id]
            );

            console.log(`[SCIM] ✅ Client créé : ${displayName}`);

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
        res.status(201).json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
            id: uuidv4(),
            displayName: req.body.displayName,
        });
    },

    async updateGroup(req, res) {
        res.json({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
            id: req.params.id,
            displayName: req.body.displayName,
        });
    },

    async deleteGroup(req, res) {
        res.status(204).send();
    },
};

module.exports = scimController;