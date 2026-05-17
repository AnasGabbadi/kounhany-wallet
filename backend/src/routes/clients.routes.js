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

/**
 * @swagger
 * /clients/by-email/{email}/company-wallet:
 *   get:
 *     summary: Récupère le wallet company d'un client via son email
 *     tags: [Clients]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet company retourné
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Client ou wallet introuvable
 */
router.get('/by-email/:email/company-wallet', clientsController.getCompanyWallet);

/**
 * @swagger
 * /clients/{clientId}/members:
 *   get:
 *     summary: Lister les membres de la société d'un client
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
 *         description: Liste des membres retournée
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
 *                       member_id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                       active:
 *                         type: boolean
 *                       scim_id:
 *                         type: string
 *       404:
 *         description: Client ou membres introuvables
 */
router.get('/:clientId/members', clientsController.getCompanyMembers);

module.exports = router;