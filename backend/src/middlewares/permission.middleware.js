const pool = require('../config/db');

const CACHE_TTL_MS = 30 * 1000;
const permissionCache = new Map();

const invalidateCache = () => permissionCache.clear();

const checkPermission = async (role, key) => {
  if (role === 'admin') return true;

  const cacheKey = `${role}:${key}`;
  const cached = permissionCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  const result = await pool.query(
    'SELECT enabled FROM role_permissions WHERE role = $1 AND permission_key = $2',
    [role, key]
  );

  const enabled = result.rows.length > 0 ? result.rows[0].enabled : false;
  permissionCache.set(cacheKey, { value: enabled, ts: Date.now() });
  return enabled;
};

const requirePermission = (key) => async (req, res, next) => {
  try {
    // API Key mode — requête depuis une app externe, pas de check permission
    if (!req.user) return next();

    const allowed = await checkPermission(req.user.role, key);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Permission insuffisante — '${key}' requise`,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requirePermission, checkPermission, invalidateCache };
