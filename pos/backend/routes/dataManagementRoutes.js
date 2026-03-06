const express = require("express");
const router = express.Router();
const {
  getCollections,
  clearData,
  exportData,
  importData,
} = require("../controllers/dataManagementController");

// GET /api/data-management/collections - Get available collections with counts
router.get("/collections", getCollections);

// POST /api/data-management/clear - Clear selected collections
router.post("/clear", clearData);

// POST /api/data-management/export - Export selected collections
router.post("/export", exportData);

// POST /api/data-management/import - Import data from backup
router.post("/import", importData);

module.exports = router;
