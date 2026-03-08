const express = require('express');
const router = express.Router();
const apicache = require('apicache');
const {
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  createTransaction,
  voidTransaction,
  returnItems,
  getTransactionStats,
  getDashboardStats,
  getTopSellingProducts,
  getSalesOverTime,
  getSalesByCategory
} = require('../controllers/transactionController');

// Cache middleware for analytics endpoints
const cache = apicache.middleware;

// Clear cache on any write operation
const clearCache = (req, res, next) => {
  apicache.clear();
  next();
};

router.get('/', cache('30 seconds'), getAllTransactions);
router.get('/stats', cache('2 minutes'), getTransactionStats);
router.get('/dashboard/stats', cache('2 minutes'), getDashboardStats);
router.get('/top-selling', cache('2 minutes'), getTopSellingProducts);
router.get('/sales-over-time', cache('2 minutes'), getSalesOverTime);
router.get('/sales-by-category', cache('2 minutes'), getSalesByCategory);
router.post('/', clearCache, createTransaction);
router.get('/:id', getTransactionById);
router.put('/:id', clearCache, updateTransaction);
router.post('/:id/void', clearCache, voidTransaction);
router.post('/:id/return', clearCache, returnItems);

module.exports = router;
