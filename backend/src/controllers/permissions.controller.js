const pool = require('../config/db');
const { PERMISSION_DEFINITIONS } = require('../config/permissions');
const { invalidateCache } = require('../middlewares/permission.middleware');

exports.getDefinitions = (req, res) => {
  const grouped = {};
  for (const perm of PERMISSION_DEFINITIONS) {
    if (!grouped[perm.module]) grouped[perm.module] = [];
    grouped[perm.module].push({ key: perm.key, label: perm.label });
  }
  res.json({ success: true, data: grouped });
};

exports.getManagerPermissions = async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT permission_key, enabled FROM role_permissions WHERE role = 'manager'"
    );
    const dbMap = Object.fromEntries(result.rows.map(r => [r.permission_key, r.enabled]));

    const permissions = {};
    for (const perm of PERMISSION_DEFINITIONS) {
      permissions[perm.key] = dbMap[perm.key] ?? false;
    }
    res.json({ success: true, data: permissions });
  } catch (err) {
    next(err);
  }
};

exports.updateManagerPermissions = async (req, res, next) => {
  try {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, message: 'Body { permissions: {...} } requis' });
    }

    const validKeys = new Set(PERMISSION_DEFINITIONS.map(p => p.key));

    for (const [key, enabled] of Object.entries(permissions)) {
      if (!validKeys.has(key)) continue;
      await pool.query(
        `INSERT INTO role_permissions (role, permission_key, enabled, updated_at)
         VALUES ('manager', $1, $2, NOW())
         ON CONFLICT (role, permission_key) DO UPDATE SET enabled = $2, updated_at = NOW()`,
        [key, Boolean(enabled)]
      );
    }

    invalidateCache();
    res.json({ success: true, message: 'Permissions mises à jour' });
  } catch (err) {
    next(err);
  }
};

exports.getMyPermissions = async (req, res, next) => {
  try {
    const role = req.user?.role;

    if (role === 'admin') {
      const permissions = {};
      for (const perm of PERMISSION_DEFINITIONS) permissions[perm.key] = true;
      return res.json({ success: true, role: 'admin', data: permissions });
    }

    const result = await pool.query(
      'SELECT permission_key, enabled FROM role_permissions WHERE role = $1',
      [role]
    );
    const dbMap = Object.fromEntries(result.rows.map(r => [r.permission_key, r.enabled]));

    const permissions = {};
    for (const perm of PERMISSION_DEFINITIONS) {
      permissions[perm.key] = dbMap[perm.key] ?? false;
    }
    res.json({ success: true, role, data: permissions });
  } catch (err) {
    next(err);
  }
};
