const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/callback', async (req, res) => {
  res.header('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'https://kounhany.fr');
  res.header('Access-Control-Allow-Credentials', 'true');

  const tokenUrl = `${process.env.AUTHENTIK_URL}/application/o/token/`;

  try {
    const { code } = req.body;

    console.log('[Auth] Token URL:', tokenUrl);
    console.log('[Auth] Client ID:', process.env.AUTHENTIK_CLIENT_ID);
    console.log('[Auth] Redirect URI:', process.env.AUTHENTIK_REDIRECT_URI);

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

    const tokenData = response.data;
    const decoded = JSON.parse(
      Buffer.from(tokenData.access_token.split('.')[1], 'base64').toString()
    );

    const groups = decoded.groups || [];
    const allowedGroups = (process.env.AUTHENTIK_ADMIN_GROUPS || 'Wallet Admins').split(',').map(g => g.trim());
    const isAdmin = groups.some(g => allowedGroups.includes(g));

    if (!isAdmin) {
      console.log('[Auth] Groupes reçus:', groups);
      return res.status(403).json({
        success: false,
        message: 'Accès refusé — compte non autorisé'
      });
    }

    res.json({ success: true, data: tokenData });
  } catch (err) {
    console.error('[Auth] Erreur:', err.response?.data || err.message);
    console.error('[Auth] URL:', tokenUrl);
    res.status(401).json({ success: false, message: 'Échec authentification' });
  }
});

module.exports = router;
