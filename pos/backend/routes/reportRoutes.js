const express = require("express");
const router = express.Router();
const apicache = require('apicache');
const { getInventoryAnalytics } = require("../controllers/reportController");

const cache = apicache.middleware;

// GET /api/reports/inventory-analytics?timeframe=daily|weekly|monthly|yearly|custom&startDate=...&endDate=...
router.get("/inventory-analytics", cache('1 minute'), getInventoryAnalytics);

module.exports = router;
