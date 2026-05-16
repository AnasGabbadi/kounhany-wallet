const client = require('prom-client');

const register = client.register;

// Collecte automatique Node.js (CPU, RAM, event loop, GC)
client.collectDefaultMetrics({ register });

// ── Métriques HTTP ─────────────────────────────────────────

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Nombre total de requêtes HTTP',
  labelNames: ['method', 'route', 'status_code'],
});

const httpErrorTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'Nombre total d erreurs HTTP (4xx, 5xx)',
  labelNames: ['method', 'route', 'status_code'],
});

// ── Métriques Blnk ─────────────────────────────────────────

const blnkRequestDuration = new client.Histogram({
  name: 'blnk_request_duration_seconds',
  help: 'Durée des appels vers Blnk',
  labelNames: ['operation'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const blnkErrorTotal = new client.Counter({
  name: 'blnk_errors_total',
  help: 'Nombre d erreurs Blnk',
  labelNames: ['operation'],
});

// ── Métriques Cache Redis ───────────────────────────────────

const cacheHits = new client.Counter({
  name: 'redis_cache_hits_total',
  help: 'Nombre de hits du cache Redis',
  labelNames: ['key_prefix'],
});

const cacheMisses = new client.Counter({
  name: 'redis_cache_misses_total',
  help: 'Nombre de misses du cache Redis',
  labelNames: ['key_prefix'],
});

// ── Métriques PostgreSQL ────────────────────────────────────

const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Durée des requêtes PostgreSQL',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

const dbErrorTotal = new client.Counter({
  name: 'db_errors_total',
  help: 'Nombre d erreurs PostgreSQL',
});

// ── Middleware Express ──────────────────────────────────────

const metricsMiddleware = (req, res, next) => {
  if (req.path === '/metrics') return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;

    const route = (req.route?.path || req.path)
      .replace(/\/[a-f0-9-]{36}/g, '/:id')
      .replace(/\/client_\w+/g, '/:clientId')
      || 'unknown';

    const labels = {
      method: req.method,
      route,
      status_code: res.statusCode,
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);

    if (res.statusCode >= 400) {
      httpErrorTotal.inc(labels);
    }
  });

  next();
};

// ── Endpoint /metrics ───────────────────────────────────────

const metricsEndpoint = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
};

module.exports = {
  metricsMiddleware,
  metricsEndpoint,
  metrics: {
    blnkRequestDuration,
    blnkErrorTotal,
    cacheHits,
    cacheMisses,
    dbQueryDuration,
    dbErrorTotal,
  },
};