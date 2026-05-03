module.exports = jest.fn(() => ({
  getSigningKey: jest.fn((kid, cb) => {
    cb(null, { getPublicKey: () => 'mock-public-key' });
  }),
}));