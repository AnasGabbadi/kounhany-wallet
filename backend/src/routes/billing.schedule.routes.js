const express = require('express');
const router = express.Router();
const { list, create, update, deleteSchedule, runNow } = require('../controllers/billing.schedule.controller');

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', deleteSchedule);
router.post('/:id/run', runNow);

module.exports = router;
