const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/callback', async (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.header('Access-Control-Allow-Credentials', 'true');

  try {
    const { code } = req.body;
    const tokenUrl = `${process.env.AUTHENTIK_URL}/application/o/token/`;

    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.AUTHENTIK_CLIENT_ID,
        client_secret: process.env.AUTHENTIK_CLIENT_SECRET,
        redirect_uri: process.env.AUTHENTIK_REDIRECT_URI,
        code,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Décoder le token pour vérifier les groupes
    const tokenData = response.data;
    const decoded = JSON.parse(
      Buffer.from(tokenData.access_token.split('.')[1], 'base64').toString()
    );

    const groups = decoded.groups || [];
    const allowedGroups = (process.env.AUTHENTIK_ADMIN_GROUPS).split(',');
    const isAdmin = groups.some(g => allowedGroups.map(g => g.trim()).includes(g));

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé — compte non autorisé'
      });
    }

    res.json({ success: true, data: tokenData });
  } catch (err) {
    console.error('[Auth] Erreur complète:', JSON.stringify(err.response?.data));
    res.status(401).json({ success: false, message: 'Échec authentification' });
  }
});

module.exports = router;