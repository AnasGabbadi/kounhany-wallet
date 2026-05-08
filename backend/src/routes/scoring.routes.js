const router = require('express').Router();
const scoringController = require('../controllers/scoring.controller');

/**
 * @swagger
 * /scoring:
 *   get:
 *     summary: Scores de tous les clients triés par score
 *     tags: [Scoring]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liste des scores retournée
 */
router.get('/', scoringController.getAllScores);

/**
 * @swagger
 * /scoring/{clientId}:
 *   get:
 *     summary: Score détaillé d'un client
 *     tags: [Scoring]
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
 *         description: Score retourné
 *       404:
 *         description: Client introuvable
 */
router.get('/:clientId', scoringController.getClientScore);

module.exports = router;