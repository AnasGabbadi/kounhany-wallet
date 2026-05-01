const authMiddleware = require('../../src/middlewares/auth.middleware');
const errorMiddleware = require('../../src/middlewares/error.middleware');
const validate = require('../../src/middlewares/validate.middleware');
const Joi = require('joi');

process.env.API_KEY = 'test-api-key';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  test('doit retourner 401 si pas de API key', () => {
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('doit retourner 401 si API key incorrecte', () => {
    req.headers['x-api-key'] = 'wrong-key';
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('doit appeler next() si API key correcte', () => {
    req.headers['x-api-key'] = 'test-api-key';
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

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
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Erreur interne',
    });
  });

  test('doit retourner le status de l erreur', () => {
    const err = new Error('Non trouvé');
    err.status = 404;
    errorMiddleware(err, req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

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
});