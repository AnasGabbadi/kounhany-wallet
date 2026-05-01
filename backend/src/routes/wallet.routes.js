const router = require('express').Router();
const walletController = require('../controllers/wallet.controller');
const validate = require('../middlewares/validate.middleware');
const v = require('../validations/wallet.validation');

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Opérations wallet — block, confirm, pay
 */

/**
 * @swagger
 * /wallet/check-available:
 *   post:
 *     summary: Vérifier si un client a assez de solde
 *     tags: [Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, amount]
 *             properties:
 *               client_id:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Résultat de la vérification
 */
router.post('/check-available', validate(v.checkAvailable), walletController.checkAvailable);

/**
 * @swagger
 * /wallet/block:
 *   post:
 *     summary: Bloquer un montant (réservation)
 *     tags: [Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, amount]
 *             properties:
 *               client_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction créée
 */
router.post('/block', validate(v.block), walletController.block);

/**
 * @swagger
 * /wallet/confirm:
 *   post:
 *     summary: Confirmer un montant bloqué
 *     tags: [Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, amount]
 *             properties:
 *               client_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction confirmée
 */
router.post('/confirm', validate(v.confirm), walletController.confirm);

/**
 * @swagger
 * /wallet/pay:
 *   post:
 *     summary: Enregistrer un paiement reçu
 *     tags: [Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, amount]
 *             properties:
 *               client_id:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paiement enregistré
 */
router.post('/pay', validate(v.pay), walletController.pay);

/**
 * @swagger
 * /wallet/balance/{clientId}:
 *   get:
 *     summary: Soldes d'un client
 *     tags: [Wallet]
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
 *         description: Soldes retournés
 *       404:
 *         description: Client introuvable
 */
router.get('/balance/:clientId', walletController.getBalance);

/**
 * @swagger
 * /wallet/transactions/{clientId}:
 *   get:
 *     summary: Historique des transactions d'un client
 *     tags: [Wallet]
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
 *         description: Transactions retournées
 */
router.get('/transactions/:clientId', walletController.getTransactions);

/**
 * @swagger
 * /wallet/external-debt:
 *   post:
 *     summary: Enregistrer une dette externe Dolibarr
 *     tags: [Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, amount, reference]
 *             properties:
 *               client_id:
 *                 type: string
 *                 example: client_1776770615267
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 500
 *               reference:
 *                 type: string
 *                 example: DOLIBARR-INV-2024-001
 *               description:
 *                 type: string
 *                 example: Facture Dolibarr non payée
 *     responses:
 *       200:
 *         description: Dette enregistrée avec succès
 *       400:
 *         description: Erreur de validation — amount doit être positif, reference est obligatoire
 *       404:
 *         description: Client introuvable
 */
router.post('/external-debt', validate(v.externalDebt), walletController.externalDebt);

/**
 * @swagger
 * /wallet/external-payment:
 *   post:
 *     summary: Enregistrer un paiement externe Dolibarr
 *     tags: [Wallet]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [client_id, amount, reference]
 *             properties:
 *               client_id:
 *                 type: string
 *                 example: client_1776770615267
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 500
 *               reference:
 *                 type: string
 *                 example: DOLIBARR-PAY-2024-001
 *               description:
 *                 type: string
 *                 example: Paiement reçu via Dolibarr
 *     responses:
 *       200:
 *         description: Paiement enregistré avec succès
 *       400:
 *         description: Erreur de validation — amount doit être positif, reference est obligatoire
 *       404:
 *         description: Client introuvable
 */
router.post('/external-payment', validate(v.externalPayment), walletController.externalPayment);

module.exports = router;