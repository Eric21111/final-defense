const express = require('express');
const router = express.Router();
const { getCartByUser, saveCart } = require('../controllers/cartController');

router.get('/:userId', getCartByUser);
router.put('/:userId', saveCart);

module.exports = router;

