const express = require('express');
const router = express.Router();
const dolibarrController = require('../controllers/dolibarr.controller');

/**
 * @swagger
 * tags:
 *   name: Dolibarr
 *   description: Intégration Dolibarr — factures et synchronisation
 */

/**
 * @swagger
 * /dolibarr/status:
 *   get:
 *     summary: État de la connexion Dolibarr
 *     tags: [Dolibarr]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Statut retourné
 *       503:
 *         description: Dolibarr inaccessible
 */
router.get('/status', dolibarrController.getStatus);

/**
 * @swagger
 * /dolibarr/invoices:
 *   get:
 *     summary: Lister toutes les factures non payées
 *     tags: [Dolibarr]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des factures retournée
 */
router.get('/invoices', dolibarrController.getInvoices);

/**
 * @swagger
 * /dolibarr/invoices/{clientId}:
 *   get:
 *     summary: Factures d'un client spécifique
 *     tags: [Dolibarr]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Factures du client retournées
 *       404:
 *         description: Client introuvable
 */
router.get('/invoices/:clientId', dolibarrController.getClientInvoices);

/**
 * @swagger
 * /dolibarr/sync:
 *   post:
 *     summary: Forcer une synchronisation manuelle des paiements
 *     tags: [Dolibarr]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Synchronisation effectuée
 *       503:
 *         description: Dolibarr inaccessible
 */
router.post('/sync', dolibarrController.forceSync);

module.exports = router;