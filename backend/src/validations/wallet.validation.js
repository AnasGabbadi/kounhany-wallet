const Joi = require('joi');

const checkAvailable = Joi.object({
  client_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
});

const block = Joi.object({
  client_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  reference: Joi.string().optional(),
  description: Joi.string().optional(),
});

const confirm = Joi.object({
  client_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  reference: Joi.string().optional(),
  description: Joi.string().optional(),
});

const pay = Joi.object({
  client_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  reference: Joi.string().optional(),
  description: Joi.string().optional(),
});

const externalDebt = Joi.object({
  client_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  reference: Joi.string().required(),
  description: Joi.string().optional(),
});

const externalPayment = Joi.object({
  client_id: Joi.string().required(),
  amount: Joi.number().positive().required(),
  reference: Joi.string().required(),
  description: Joi.string().optional(),
});

module.exports = { checkAvailable, block, confirm, pay, externalDebt, externalPayment };