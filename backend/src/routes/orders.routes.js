const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Gestion des commandes Fleet / Logistique / B2C
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Créer une commande
 *     description: |
 *       - **FLEET** → BLOCK automatique (Available → Blocked)
 *       - **LOGISTIQUE** → CONFIRM direct (Available → Receivable)
 *       - **B2C** → PAYMENT immédiat (@World → Available)
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, order_type, amount, reference]
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: client_seed_001
 *               order_type:
 *                 type: string
 *                 enum: [FLEET, LOGISTIQUE, B2C]
 *               amount:
 *                 type: number
 *                 example: 1500
 *               description:
 *                 type: string
 *               reference:
 *                 type: string
 *                 example: CMD-2026-001
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Commande créée
 *       400:
 *         description: Paramètres invalides
 *       404:
 *         description: Client introuvable
 *       409:
 *         description: Référence déjà utilisée
 *       422:
 *         description: Solde insuffisant
 */
router.post('/', ordersController.createOrder);

/**
 * @swagger
 * /orders/client/{clientId}:
 *   get:
 *     summary: Commandes d'un client
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: order_type
 *         schema:
 *           type: string
 *           enum: [FLEET, LOGISTIQUE, B2C]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, BLOCKED, CONFIRMED, CANCELLED, PAID]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des commandes
 */
router.get('/client/:clientId', ordersController.getClientOrders);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Toutes les commandes (admin)
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: order_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste globale des commandes
 */
router.get('/', ordersController.getAllOrders);

module.exports = router;