const express = require('express');
const router = express.Router();
const {
    getRemittanceSummary,
    createRemittance,
    getRemittances
} = require('../controllers/remittanceController');

router.get('/summary', getRemittanceSummary);
router.post('/', createRemittance);
router.get('/', getRemittances);

module.exports = router;
