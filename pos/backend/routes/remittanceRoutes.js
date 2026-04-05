const express = require('express');
const router = express.Router();
const {
    getRemittanceSummary,
    getRemittanceKpiStats,
    createRemittance,
    getRemittances
} = require('../controllers/remittanceController');

router.get('/summary', getRemittanceSummary);
router.get('/kpi-stats', getRemittanceKpiStats);
router.post('/', createRemittance);
router.get('/', getRemittances);

module.exports = router;
