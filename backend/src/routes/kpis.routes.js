const router = require('express').Router();
const kpisController = require('../controllers/kpis.controller');

/**
 * @swagger
 * /kpis/overview:
 *   get:
 *     summary: KPIs globaux du dashboard
 *     tags: [KPIs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [today, week, month, all]
 *         description: Période d'analyse
 *     responses:
 *       200:
 *         description: KPIs retournés
 */
router.get('/overview', kpisController.overview);

/**
 * @swagger
 * /kpis/transactions-trend:
 *   get:
 *     summary: Tendance des transactions par jour
 *     tags: [KPIs]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *     responses:
 *       200:
 *         description: Trend retourné
 */
router.get('/transactions-trend', kpisController.transactionsTrend);

/**
 * @swagger
 * /kpis/top-clients:
 *   get:
 *     summary: Top clients par encours et volume
 *     tags: [KPIs]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Top clients retournés
 */
router.get('/top-clients', kpisController.topClients);

/**
 * @swagger
 * /kpis/alerts:
 *   get:
 *     summary: Alertes système et anomalies
 *     tags: [KPIs]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Alertes retournées
 */
router.get('/alerts', kpisController.alerts);

/**
 * @swagger
 * /kpis/system-info:
 *   get:
 *     summary: Informations système et environnement
 *     tags: [KPIs]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Infos système retournées
 */
router.get('/system-info', kpisController.systemInfo);

module.exports = router;