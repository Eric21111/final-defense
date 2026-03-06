const express = require('express');
const router = express.Router();
const apicache = require('apicache');
const {
  createStockMovement,
  getStockMovements,
  getTodayStats,
  getMovementsByProduct,
  getStockStatsOverTime
} = require('../controllers/stockMovementController');

// Cache middleware for read-heavy stats endpoints
const cache = apicache.middleware;
const clearCache = (req, res, next) => { apicache.clear(); next(); };

router.post('/', clearCache, createStockMovement);
router.get('/', cache('30 seconds'), getStockMovements);
router.get('/stats/today', cache('30 seconds'), getTodayStats);
router.get('/stats/over-time', cache('1 minute'), getStockStatsOverTime);
router.get('/product/:productId', getMovementsByProduct);

module.exports = router;
