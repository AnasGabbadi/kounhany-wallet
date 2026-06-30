const router = require('express').Router();
const { requirePermission } = require('../middlewares/permission.middleware');
const ctrl = require('../controllers/users.controller');

router.get('/', requirePermission('users.view'), ctrl.listUsers);

module.exports = router;
