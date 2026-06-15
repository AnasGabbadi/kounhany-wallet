const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');

// Normaliser au boot — protège contre \r, espaces, BOM dans le .env
const API_KEY = (process.env.API_KEY || '').trim();

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
  const apiKey = (req.headers['x-api-key'] || '').trim();

  if (process.env.NODE_ENV === 'test') {
    if (apiKey === API_KEY) return next();
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const auth = req.headers.authorization;

  // Support API Key legacy (pour les apps qui appellent directement)
  if (apiKey) {
    if (apiKey === API_KEY) return next();
    return res.status(401).json({ success: false, message: 'Unauthorized — API key invalide' });
  }

  // Support API Key via Authorization: Bearer <key>
  // Pour les apps (Fleet, Kounhany App) qui envoient Bearer au lieu de x-api-key
  if (auth?.startsWith('Bearer ') && API_KEY) {
    const bearerToken = auth.slice(7).trim();
    if (bearerToken === API_KEY) {
      req.auth = { type: 'api-key' };
      return next();
    }
  }

  // Vérifier Bearer token JWT
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized — Token requis' });
  }

  const token = auth.split(' ')[1];

  // Vérifier le token JWT Authentik
  // Accepte les deux issuers : Docker-interne (authentik-server) ET public (localhost)
  const allowedIssuers = [
    process.env.AUTHENTIK_ISSUER,
    process.env.AUTHENTIK_ISSUER_PUBLIC,
  ].filter(Boolean);

  jwt.verify(token, getSigningKey, {
    algorithms: ['RS256'],
    audience: process.env.AUTHENTIK_CLIENT_ID,
    issuer: allowedIssuers,
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