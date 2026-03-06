const express = require('express');
const router = express.Router();
const {
  createVoidLog,
  getVoidLogs,
  getVoidLogById,
  getVoidLogStats
} = require('../controllers/voidLogController');

router.post('/', createVoidLog);
router.get('/', getVoidLogs);
router.get('/stats', getVoidLogStats);
router.get('/:id', getVoidLogById);

module.exports = router;


