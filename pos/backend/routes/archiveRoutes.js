const express = require('express');
const router = express.Router();
const {
  createArchiveItem,
  getAllArchiveItems,
  getArchiveItemById,
  deleteArchiveItem,
  deleteAllArchiveItems,
  restoreArchiveItem
} = require('../controllers/archiveController');

router.get('/', getAllArchiveItems);
router.get('/:id', getArchiveItemById);
router.post('/', createArchiveItem);
router.delete('/all', deleteAllArchiveItems);
router.delete('/:id', deleteArchiveItem);
router.post('/:id/restore', restoreArchiveItem);

module.exports = router;
