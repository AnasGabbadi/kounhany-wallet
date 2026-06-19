const router = require('express').Router();
const ctrl = require('../controllers/prestataires.controller');

/**
 * @swagger
 * tags:
 *   name: Prestataires
 *   description: Gestion des prestataires et de leurs wallets
 */

/**
 * @swagger
 * /prestataires/find-or-create:
 *   post:
 *     summary: Trouver ou créer un wallet pour un prestataire
 *     tags: [Prestataires]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [garage_uuid, name]
 *             properties:
 *               garage_uuid:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Prestataire créé avec wallet
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     client_id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     created:
 *                       type: boolean
 *       200:
 *         description: Wallet prestataire déjà existant
 *       400:
 *         description: Requête invalide
 */
router.post('/find-or-create', ctrl.findOrCreate);

/**
 * @swagger
 * /prestataires:
 *   get:
 *     summary: Lister tous les prestataires
 *     tags: [Prestataires]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des prestataires retournée
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
 *                       phone:
 *                         type: string
 *                       client_type:
 *                         type: string
 *                         enum: [PRESTATAIRE]
 *                       active:
 *                         type: boolean
 *                       scim_id:
 *                         type: string
 *                       has_orders:
 *                         type: boolean
 */
router.get('/', ctrl.list);

/**
 * @swagger
 * /prestataires/{id}:
 *   get:
 *     summary: Détail d'un prestataire avec ses soldes
 *     tags: [Prestataires]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prestataire trouvé
 *       404:
 *         description: Prestataire introuvable
 */
router.get('/:id', ctrl.getOne);

/**
 * @swagger
 * /prestataires/{id}/wallet:
 *   get:
 *     summary: Wallet complet d'un prestataire
 *     tags: [Prestataires]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Wallet prestataire retourné
 *       404:
 *         description: Wallet introuvable
 */
router.get('/:id/wallet', ctrl.getWallet);

/**
 * @swagger
 * /prestataires/{id}/orders:
 *   get:
 *     summary: Lister les commandes d'un prestataire
 *     tags: [Prestataires]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Commandes du prestataire retournées
 */
router.get('/:id/orders', ctrl.getOrders);

router.post('/supplier-invoice', ctrl.createSupplierInvoice);

/**
 * @swagger
 * /prestataires/pieces/find-or-create:
 *   post:
 *     summary: Trouver ou créer un wallet prestataire pièces détachées (lié à une company Fleet)
 *     tags: [Prestataires]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [company_uuid]
 *             properties:
 *               company_uuid:
 *                 type: string
 *     responses:
 *       201:
 *         description: Prestataire pièces créé
 *       200:
 *         description: Prestataire pièces déjà existant
 *       400:
 *         description: Requête invalide
 */
router.post('/pieces/find-or-create', ctrl.findOrCreatePieces);

module.exports = router;
