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
    const adminGroups = (process.env.AUTHENTIK_ADMIN_GROUPS || 'Wallet Admins').split(',').map(g => g.trim());
    const managerGroups = (process.env.AUTHENTIK_MANAGER_GROUPS || 'Wallet Managers').split(',').map(g => g.trim());
    const isAdmin = groups.some(g => adminGroups.includes(g));
    const isManager = groups.some(g => managerGroups.includes(g));

    if (!isAdmin && !isManager) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé — compte non autorisé'
      });
    }

    res.json({ success: true, data: tokenData });
  } catch (err) {
    const detail = err.response?.data || err.message || err;
    console.error('[Auth] Erreur:', JSON.stringify(detail));
    res.status(401).json({ success: false, message: 'Échec authentification' });
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ error: 'refresh_token requis' });

    const tokenUrl = `${process.env.AUTHENTIK_URL}/application/o/token/`;

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: process.env.AUTHENTIK_CLIENT_ID,
      client_secret: process.env.AUTHENTIK_CLIENT_SECRET,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      return res.status(401).json({ error: 'Refresh échoué' });
    }

    const data = await response.json();
    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;