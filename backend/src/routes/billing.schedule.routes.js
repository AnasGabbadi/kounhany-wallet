const express = require('express');
const router = express.Router();
const { list, create, update, deleteSchedule, runNow } = require('../controllers/billing.schedule.controller');
const { requirePermission } = require('../middlewares/permission.middleware');

router.get('/', list);
router.post('/', requirePermission('facturation.create'), create);
router.put('/:id', requirePermission('facturation.edit'), update);
router.delete('/:id', requirePermission('facturation.delete'), deleteSchedule);
router.post('/:id/run', requirePermission('facturation.run'), runNow);

module.exports = router;
