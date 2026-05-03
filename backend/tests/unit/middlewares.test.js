// Mock avant tous les requires pour éviter les erreurs ES modules
jest.mock('jwks-rsa', () => jest.fn(() => ({
  getSigningKey: jest.fn((kid, cb) => cb(null, { getPublicKey: () => 'mock-public-key' })),
})));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

process.env.API_KEY = 'test-api-key';
process.env.AUTHENTIK_URL = 'http://authentik:9000';
process.env.AUTHENTIK_APP_SLUG = 'kounhany-wallet-admin';

const jwtMiddleware = require('../../src/middlewares/jwt.middleware');
const errorMiddleware = require('../../src/middlewares/error.middleware');
const validate = require('../../src/middlewares/validate.middleware');
const Joi = require('joi');

// ─── JWT Middleware — x-api-key ───────────────────────────────────────────────
describe('JWT Middleware — x-api-key', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('doit retourner 401 si pas de x-api-key ni Authorization', () => {
    jwtMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('doit appeler next() si x-api-key correcte', () => {
    req.headers['x-api-key'] = 'test-api-key';
    jwtMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('doit retourner 401 si x-api-key incorrecte', () => {
    req.headers['x-api-key'] = 'wrong-key';
    jwtMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── Error Middleware ─────────────────────────────────────────────────────────
describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { method: 'POST', path: '/test' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('doit retourner 500 par défaut', () => {
    const err = new Error('Erreur interne');
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Erreur interne',
    }));
  });

  test('doit retourner le status de l erreur', () => {
    const err = new Error('Non trouvé');
    err.status = 404;
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('doit retourner 500 si status non défini', () => {
    const err = new Error('Erreur sans status');
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── Validate Middleware ──────────────────────────────────────────────────────
describe('Validate Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('doit retourner 400 si validation échoue', () => {
    const schema = Joi.object({ amount: Joi.number().required() });
    const middleware = validate(schema);
    req.body = { amount: 'invalid' };
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('doit appeler next() si validation passe', () => {
    const schema = Joi.object({ amount: Joi.number().required() });
    const middleware = validate(schema);
    req.body = { amount: 100 };
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('doit retourner les détails de validation', () => {
    const schema = Joi.object({
      client_id: Joi.string().required(),
      amount: Joi.number().positive().required(),
    });
    const middleware = validate(schema);
    req.body = { client_id: 'test' }; // amount manquant
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
    }));
  });

  test('doit retourner 400 si champ requis manquant', () => {
    const schema = Joi.object({
      client_id: Joi.string().required(),
      amount: Joi.number().positive().required(),
    });
    const middleware = validate(schema);
    req.body = {}; // tout manquant
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});