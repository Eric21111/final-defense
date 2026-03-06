const express = require('express');
const router = express.Router();
const {
  getAllDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount
} = require('../controllers/discountController');

router.route('/')
  .get(getAllDiscounts)
  .post(createDiscount);

router.route('/:id')
  .get(getDiscountById)
  .put(updateDiscount)
  .delete(deleteDiscount);

module.exports = router;

