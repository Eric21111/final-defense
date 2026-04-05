const express = require('express');
const apicache = require('apicache');
const router = express.Router();
const {
  createArchiveItem,
  getAllArchiveItems,
  getArchiveItemById,
  deleteArchiveItem,
  deleteAllArchiveItems,
  restoreArchiveItem
} = require('../controllers/archiveController');

const clearCache = (req, res, next) => {
  apicache.clear();
  next();
};

router.get('/', getAllArchiveItems);
router.get('/:id', getArchiveItemById);
router.post('/', createArchiveItem);
router.delete('/all', clearCache, deleteAllArchiveItems);
router.delete('/:id', clearCache, deleteArchiveItem);
router.post('/:id/restore', clearCache, restoreArchiveItem);

module.exports = router;
