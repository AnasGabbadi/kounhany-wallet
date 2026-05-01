const express = require('express');
const router = express.Router();
const scimController = require('../controllers/scim.controller');

/**
 * @swagger
 * tags:
 *   name: SCIM
 *   description: SCIM v2 — Synchronisation identités Authentik → Wallet
 */

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     ScimBearer:
 *       type: http
 *       scheme: bearer
 *       description: Token SCIM partagé avec Authentik
 *   schemas:
 *     ScimUser:
 *       type: object
 *       properties:
 *         schemas:
 *           type: array
 *           items:
 *             type: string
 *           example: ["urn:ietf:params:scim:schemas:core:2.0:User"]
 *         id:
 *           type: string
 *         userName:
 *           type: string
 *         name:
 *           type: object
 *           properties:
 *             formatted:
 *               type: string
 *         emails:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               value:
 *                 type: string
 *               primary:
 *                 type: boolean
 *         active:
 *           type: boolean
 *         groups:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               value:
 *                 type: string
 *               display:
 *                 type: string
 */

// Middleware auth SCIM — vérifie le token Bearer
const scimAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  const token = auth?.split(' ')[1];

  if (token !== process.env.SCIM_TOKEN) {
    return res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: 401,
      detail: 'Unauthorized',
    });
  }
  next();
};

router.use(scimAuth);

// ── Discovery ─────────────────────────────────────────────────────

/**
 * @swagger
 * /scim/v2/ServiceProviderConfig:
 *   get:
 *     summary: Configuration du fournisseur SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     responses:
 *       200:
 *         description: Configuration SCIM retournée
 */
router.get('/ServiceProviderConfig', scimController.serviceProviderConfig);

/**
 * @swagger
 * /scim/v2/Schemas:
 *   get:
 *     summary: Schémas SCIM supportés
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     responses:
 *       200:
 *         description: Schémas retournés
 */
router.get('/Schemas', scimController.schemas);

/**
 * @swagger
 * /scim/v2/ResourceTypes:
 *   get:
 *     summary: Types de ressources SCIM supportés
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     responses:
 *       200:
 *         description: Types retournés
 */
router.get('/ResourceTypes', scimController.resourceTypes);

// ── Users ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /scim/v2/Users:
 *   get:
 *     summary: Lister tous les utilisateurs SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schemas:
 *                   type: array
 *                   items:
 *                     type: string
 *                 totalResults:
 *                   type: integer
 *                 Resources:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ScimUser'
 */
router.get('/Users', scimController.listUsers);

/**
 * @swagger
 * /scim/v2/Users/{id}:
 *   get:
 *     summary: Récupérer un utilisateur par ID SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID SCIM de l'utilisateur
 *     responses:
 *       200:
 *         description: Utilisateur retourné
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScimUser'
 *       404:
 *         description: Utilisateur introuvable
 */
router.get('/Users/:id', scimController.getUser);

/**
 * @swagger
 * /scim/v2/Users:
 *   post:
 *     summary: Créer un utilisateur (appelé par Authentik)
 *     description: |
 *       Authentik appelle cet endpoint automatiquement via SCIM
 *       quand un utilisateur est créé dans Authentik.
 *       Le wallet est créé automatiquement selon le groupe de l'utilisateur.
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScimUser'
 *           example:
 *             schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"]
 *             id: "550e8400-e29b-41d4-a716-446655440000"
 *             userName: "ahmed.alami@kounhany.ma"
 *             name:
 *               formatted: "Ahmed Alami"
 *             emails:
 *               - value: "ahmed.alami@kounhany.ma"
 *                 primary: true
 *             active: true
 *             groups:
 *               - value: "fleet-group-id"
 *                 display: "Fleet"
 *     responses:
 *       201:
 *         description: Utilisateur et wallet créés
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ScimUser'
 *       409:
 *         description: Utilisateur déjà existant
 */
router.post('/Users', scimController.createUser);

/**
 * @swagger
 * /scim/v2/Users/{id}:
 *   put:
 *     summary: Mettre à jour un utilisateur (appelé par Authentik)
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScimUser'
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour
 */
router.put('/Users/:id', scimController.updateUser);

/**
 * @swagger
 * /scim/v2/Users/{id}:
 *   patch:
 *     summary: Modifier partiellement un utilisateur (appelé par Authentik)
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Operations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     op:
 *                       type: string
 *                       example: replace
 *                     value:
 *                       type: object
 *     responses:
 *       200:
 *         description: Utilisateur modifié
 */
router.patch('/Users/:id', scimController.patchUser);

/**
 * @swagger
 * /scim/v2/Users/{id}:
 *   delete:
 *     summary: Désactiver un utilisateur (appelé par Authentik)
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Utilisateur désactivé
 */
router.delete('/Users/:id', scimController.deleteUser);

// ── Groups ────────────────────────────────────────────────────────

/**
 * @swagger
 * /scim/v2/Groups:
 *   get:
 *     summary: Lister les groupes SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     responses:
 *       200:
 *         description: Liste des groupes
 */
router.get('/Groups', scimController.listGroups);

/**
 * @swagger
 * /scim/v2/Groups/{id}:
 *   get:
 *     summary: Récupérer un groupe par ID
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       404:
 *         description: Groupe non géré
 */
router.get('/Groups/:id', scimController.getGroup);

/**
 * @swagger
 * /scim/v2/Groups:
 *   post:
 *     summary: Créer un groupe SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     responses:
 *       201:
 *         description: Groupe créé
 */
router.post('/Groups', scimController.createGroup);

/**
 * @swagger
 * /scim/v2/Groups/{id}:
 *   put:
 *     summary: Mettre à jour un groupe SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Groupe mis à jour
 */
router.put('/Groups/:id', scimController.updateGroup);

/**
 * @swagger
 * /scim/v2/Groups/{id}:
 *   delete:
 *     summary: Supprimer un groupe SCIM
 *     tags: [SCIM]
 *     security:
 *       - ScimBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Groupe supprimé
 */
router.delete('/Groups/:id', scimController.deleteGroup);

module.exports = router;