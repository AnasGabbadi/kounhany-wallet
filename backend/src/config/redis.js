const { createClient } = require('redis');

const client = createClient({
    url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`,
});

client.on('error', (err) => console.error('[Redis] Erreur:', err.message));
client.on('connect', () => console.log('[Redis] Connecté'));

// Connexion au démarrage
client.connect().catch((err) => console.error('[Redis] Échec connexion:', err.message));

module.exports = client;