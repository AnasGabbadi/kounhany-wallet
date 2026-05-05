const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

// Client JWKS — récupère les clés publiques depuis Authentik
const jwksClient = jwksRsa({
  jwksUri: `${process.env.AUTHENTIK_URL}/application/o/${process.env.AUTHENTIK_APP_SLUG}/jwks/`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
});

// Récupérer la clé publique depuis Authentik
function getSigningKey(header, callback) {
  jwksClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// Middleware JWT
const jwtMiddleware = (req, res, next) => {
  console.log('[JWT] Headers reçus:', JSON.stringify(req.headers['authorization']?.substring(0, 30)));
  console.log('[JWT] x-api-key:', req.headers['x-api-key']);
  // En mode test — garder API Key
  if (process.env.NODE_ENV === 'test') {
    const apiKey = req.headers['x-api-key'];
    if (apiKey === process.env.API_KEY) return next();
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const auth = req.headers.authorization;

  // Support API Key legacy (pour les apps qui appellent directement)
  if (req.headers['x-api-key']) {
    if (req.headers['x-api-key'] === process.env.API_KEY) return next();
    return res.status(401).json({ success: false, message: 'Unauthorized — API key invalide' });
  }

  // Vérifier Bearer token
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized — Token requis' });
  }

  const token = auth.split(' ')[1];

  // Vérifier le token JWT Authentik
  jwt.verify(token, getSigningKey, {
    algorithms: ['RS256'],
    audience: process.env.AUTHENTIK_CLIENT_ID,
    issuer: process.env.AUTHENTIK_ISSUER,
  }, (err, decoded) => {
    if (err) {
      const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('[JWT] Issuer dans le token:', payload.iss);
    console.log('[JWT] Issuer attendu:', process.env.AUTHENTIK_ISSUER);
    console.error('[JWT] Token invalide:', err.message);
    return res.status(401).json({ success: false, message: 'Unauthorized — Token invalide' });
    }

    // ← Vérifier que l'user est dans le groupe Wallet Admins
    const groups = decoded.groups || [];
    const allowedGroups = (process.env.AUTHENTIK_ADMIN_GROUPS || 'Wallet Admins').split(',');

    const isAdmin = groups.some(g => allowedGroups.includes(g));

    if (!isAdmin) {
      console.log(`[JWT] Accès refusé — groupes: ${groups.join(', ')}`);
      return res.status(403).json({
        success: false,
        message: 'Accès refusé — droits administrateur requis'
      });
    }

    req.user = decoded;
    next();
  });
};

module.exports = jwtMiddleware;