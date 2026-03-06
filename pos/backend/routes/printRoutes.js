const express = require('express');
const router = express.Router();
const { printReceipt } = require('../controllers/printController');

router.post('/receipt', printReceipt);

module.exports = router;


