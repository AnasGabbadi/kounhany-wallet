const axios = require('axios');

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheTs = 0;

function buildClient() {
  return axios.create({
    baseURL: `${process.env.AUTHENTIK_URL}/api/v3`,
    headers: { Authorization: `Bearer ${process.env.AUTHENTIK_ADMIN_TOKEN}` },
    timeout: 10000,
  });
}

// Récupère le pk UUID d'un groupe par son nom exact
async function getGroupPk(client, name) {
  const res = await client.get('/core/groups/', { params: { name } });
  return res.data?.results?.[0]?.pk || null;
}

// Récupère les membres d'un groupe via l'endpoint detail — plus fiable que le
// filtre /core/users/?groups_by_pk= (pas de pagination, pas de dépendance
// au nom de paramètre filtre)
async function getGroupMembers(client, pk, role) {
  if (!pk) return [];
  const res = await client.get(`/core/groups/${pk}/`);
  return (res.data?.users_obj || []).map(u => ({
    username: u.username,
    email: u.email || '',
    name: u.name || u.username,
    role,
    is_active: u.is_active,
  }));
}

async function fetchUsers() {
  const client = buildClient();
  const adminGroupName = (process.env.AUTHENTIK_ADMIN_GROUPS || 'Wallet Admins').split(',')[0].trim();
  const managerGroupName = (process.env.AUTHENTIK_MANAGER_GROUPS || 'Wallet Managers').split(',')[0].trim();

  const [adminPk, managerPk] = await Promise.all([
    getGroupPk(client, adminGroupName),
    getGroupPk(client, managerGroupName),
  ]);

  if (!adminPk && !managerPk) {
    throw new Error(`Groupes Authentik introuvables : "${adminGroupName}", "${managerGroupName}"`);
  }

  const [admins, managers] = await Promise.all([
    getGroupMembers(client, adminPk, 'admin'),
    getGroupMembers(client, managerPk, 'manager'),
  ]);

  // Déduplication — admin prend la priorité si l'user est dans les deux groupes
  const seen = new Set();
  const users = [];
  for (const u of admins) { seen.add(u.username); users.push(u); }
  for (const u of managers) {
    if (!seen.has(u.username)) { seen.add(u.username); users.push(u); }
  }
  return users;
}

async function getAdminAndManagerUsers() {
  if (cache && Date.now() - cacheTs < CACHE_TTL_MS) return cache;
  const users = await fetchUsers();
  cache = users;
  cacheTs = Date.now();
  return users;
}

function refreshCache() {
  return fetchUsers()
    .then(users => { cache = users; cacheTs = Date.now(); })
    .catch(err => console.error('[AuthentikService] Refresh cache error:', err.message));
}

module.exports = { getAdminAndManagerUsers, refreshCache };
