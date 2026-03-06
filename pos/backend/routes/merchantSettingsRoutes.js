const express = require("express");
const router = express.Router();
const {
  getSettings,
  saveSettings,
  deleteSettings,
  testConnection,
} = require("../controllers/merchantSettingsController");

// GET /api/merchant-settings — Get active config (safe, no private keys)
router.get("/", getSettings);

// POST /api/merchant-settings — Create or update credentials
router.post("/", saveSettings);

// DELETE /api/merchant-settings — Remove/deactivate config
router.delete("/", deleteSettings);

// POST /api/merchant-settings/test — Test gateway connection
router.post("/test", testConnection);

module.exports = router;
