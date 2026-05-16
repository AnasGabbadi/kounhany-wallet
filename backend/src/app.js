require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const jwtMiddleware = require('./middlewares/jwt.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const authRoutes = require('./routes/auth.routes');       
const walletRoutes = require('./routes/wallet.routes');
const clientsRoutes = require('./routes/clients.routes');
const kpisRoutes = require('./routes/kpis.routes');
const dolibarrRoutes = require('./routes/dolibarr.routes');
const scimRoutes = require('./routes/scim.routes');
const ordersRoutes = require('./routes/orders.routes');
const logistiqueBilling = require('./jobs/logistique.billing');
const scoringRoutes = require('./routes/scoring.routes');
const { metricsMiddleware, metricsEndpoint } = require('./metrics');

const app = express();

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
}));
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'kounhany-backend', version: '1.0.0' });
});

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// SCIM avec son propre parser JSON
app.use('/scim/v2',
  (req, res, next) => {
    if (req.headers['content-type']?.includes('scim+json')) {
      req.headers['content-type'] = 'application/json';
    }
    next();
  },
  express.json({ type: ['application/json', 'application/scim+json'] }),
  scimRoutes
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metricsMiddleware);

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.use('/auth', authRoutes);
app.get('/metrics', metricsEndpoint);

app.use(jwtMiddleware);
app.use('/clients', clientsRoutes);
app.use('/wallet', walletRoutes);
app.use('/kpis', kpisRoutes);
app.use('/dolibarr', dolibarrRoutes);
app.use('/orders', ordersRoutes);
app.use('/scoring', scoringRoutes);
app.use(errorMiddleware);

module.exports = app;