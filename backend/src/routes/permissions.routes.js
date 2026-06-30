const router = require('express').Router();
const ctrl = require('../controllers/permissions.controller');

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès refusé — admin requis' });
  }
  next();
};

// Accessible à tout utilisateur authentifié (admin + manager)
router.get('/me', ctrl.getMyPermissions);

// Admin uniquement
router.get('/definitions', requireAdmin, ctrl.getDefinitions);
router.get('/manager', requireAdmin, ctrl.getManagerPermissions);
router.put('/manager', requireAdmin, ctrl.updateManagerPermissions);

module.exports = router;
