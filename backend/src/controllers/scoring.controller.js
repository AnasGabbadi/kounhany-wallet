const scoringService = require('../services/scoring.service');
const redis = require('../config/redis');

const CACHE_TTL = 300; // 5 minutes

const scoringController = {

  // GET /scoring/:clientId
  async getClientScore(req, res, next) {
    try {
      const { clientId } = req.params;
      const cacheKey = `scoring:${clientId}`;

      const cached = await redis.get(cacheKey);
      if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });

      const score = await scoringService.getClientScore(clientId);
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(score));

      res.json({ success: true, data: score });
    } catch (err) { next(err); }
  },

  // GET /scoring — tous les clients triés par score
  async getAllScores(req, res, next) {
    try {
      const cacheKey = 'scoring:all';
      const cached = await redis.get(cacheKey);
      if (cached) return res.json({ success: true, data: JSON.parse(cached), cached: true });

      const scores = await scoringService.getAllScores();
      await redis.setEx(cacheKey, CACHE_TTL, JSON.stringify(scores));

      res.json({ success: true, data: scores });
    } catch (err) { next(err); }
  },
};

module.exports = scoringController;