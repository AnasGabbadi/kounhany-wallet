const router = require('express').Router();
const clientsController = require('../controllers/clients.controller');

/**
 * @swagger
 * tags:
 *   name: Clients
 *   description: Gestion des clients et leurs wallets
 */

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Lister tous les clients
 *     tags: [Clients]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des clients retournée
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       client_id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       client_type:
 *                         type: string
 *                         enum: [FLEET, LOGISTIQUE, B2C]
 *                       active:
 *                         type: boolean
 *                       scim_id:
 *                         type: string
 */
router.get('/', clientsController.list);

/**
 * @swagger
 * /clients/{clientId}:
 *   get:
 *     summary: Détail d'un client avec ses soldes
 *     tags: [Clients]
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
 *         description: Client trouvé
 *       404:
 *         description: Client introuvable
 */
router.get('/:clientId', clientsController.getOne);

/**
 * @swagger
 * /clients/{clientId}/wallet:
 *   get:
 *     summary: Wallet complet d'un client — soldes, stats, historique transactions
 *     tags: [Clients]
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
 *         description: Wallet retourné avec soldes Blnk + stats + transactions
 *       404:
 *         description: Wallet introuvable
 */
router.get('/:clientId/wallet', clientsController.getWallet);

module.exports = router;