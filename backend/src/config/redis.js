const { createClient } = require('redis');

const isTest = process.env.NODE_ENV === 'test';

const client = createClient({
    url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}`,
    socket: isTest ? { reconnectStrategy: false } : undefined,
});

client.on('error', (err) => console.error('[Redis] Erreur:', err.message));
client.on('connect', () => console.log('[Redis] Connecté'));

if (!isTest) {
    client.connect().catch((err) => console.error('[Redis] Échec connexion:', err.message));
}

module.exports = client;