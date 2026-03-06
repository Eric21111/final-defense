const express = require('express');
const router = express.Router();
const {
  getBrandPartners,
  createBrandPartner,
  updateBrandPartner,
  deleteBrandPartner,
} = require('../controllers/brandPartnerController');

router.get('/', getBrandPartners);
router.post('/', createBrandPartner);
router.put('/:id', updateBrandPartner);
router.delete('/:id', deleteBrandPartner);

module.exports = router;
