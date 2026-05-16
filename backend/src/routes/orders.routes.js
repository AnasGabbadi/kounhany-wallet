const express = require('express');
const router = express.Router();
const ordersController = require('../controllers/orders.controller');

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Gestion des commandes Fleet / Logistique / B2C
 */

// ── Endpoints dédiés par app (avant /:id pour éviter conflit) ─────────────────
 
/**
 * @swagger
 * /orders/fleet:
 *   post:
 *     summary: Créer une commande Fleet (depuis Fleet App)
 *     description: BLOCK automatique — Available → Blocked
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, amount, reference]
 *             properties:
 *               clientId:
 *                 type: string
 *                 example: client_xxx
 *               amount:
 *                 type: number
 *                 example: 1500
 *               reference:
 *                 type: string
 *                 example: FLEET-CMD-001
 *               description:
 *                 type: string
 *               external_order_id:
 *                 type: string
 *                 example: fleet_order_123
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Commande créée — montant bloqué
 *       422:
 *         description: Solde insuffisant
 */
router.post('/fleet', ordersController.createFleetOrder);
 
/**
 * @swagger
 * /orders/logistique:
 *   post:
 *     summary: Créer une commande Logistique (depuis Logistique App)
 *     description: CONFIRM direct — Available → Receivable
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, amount, reference]
 *             properties:
 *               clientId:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference:
 *                 type: string
 *               description:
 *                 type: string
 *               external_order_id:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Mission créée — confirmée directement
 *       422:
 *         description: Solde insuffisant
 */
router.post('/logistique', ordersController.createLogistiqueOrder);
 
/**
 * @swagger
 * /orders/b2c:
 *   post:
 *     summary: Créer un paiement B2C (depuis B2C App)
 *     description: PAYMENT immédiat — @World → Available
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId, amount, reference]
 *             properties:
 *               clientId:
 *                 type: string
 *               amount:
 *                 type: number
 *               reference:
 *                 type: string
 *               description:
 *                 type: string
 *               external_order_id:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Paiement enregistré
 */
router.post('/b2c', ordersController.createB2COrder);

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

/**
 * @swagger
 * /orders/logistique/invoice:
 *   post:
 *     summary: Générer les factures mensuelles LOGISTIQUE manuellement
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Factures générées
 */
router.post('/logistique/invoice', async (req, res, next) => {
  try {
    const logistiqueBilling = require('../jobs/logistique.billing');
    await logistiqueBilling.generateMonthlyInvoices();
    res.json({ success: true, message: 'Facturation mensuelle lancée' });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /orders/{id}/confirm:
 *   post:
 *     summary: Confirmer une commande FLEET
 *     description: |
 *       Confirme une commande FLEET en statut BLOCKED.
 *       - Déplace le montant : Blocked → Receivable
 *       - Crée une facture dans Dolibarr automatiquement
 *       - Met à jour le statut de la commande → CONFIRMED
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la commande à confirmer
 *     responses:
 *       200:
 *         description: Commande confirmée
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
 *                     id:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       example: CONFIRMED
 *                     confirmed_at:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Commande introuvable
 *       422:
 *         description: Commande non BLOCKED
 */
router.post('/:id/confirm', ordersController.confirmOrder);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   post:
 *     summary: Annuler une commande FLEET
 *     description: |
 *       Annule une commande FLEET en statut BLOCKED.
 *       - Restitue le montant : Blocked → Available
 *       - Met à jour le statut → CANCELLED
 *       - Aucune facture Dolibarr créée
 *     tags: [Orders]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Commande annulée
 *       404:
 *         description: Commande introuvable
 *       422:
 *         description: Commande non BLOCKED
 */
router.post('/:id/cancel', ordersController.cancelOrder);

module.exports = router;