const express = require("express");
const dataSyncService = require("../services/dataSyncService");

const router = express.Router();

// Manual sync endpoint - triggers bidirectional sync between local and cloud
router.post("/all", async (req, res) => {
  try {
    console.log("[Sync Route] Manual sync triggered...");
    const startTime = Date.now();

    await dataSyncService.sync();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sync Route] Manual sync completed in ${duration}s`);

    return res.json({
      success: true,
      message: `Data synchronized successfully (${duration}s)`,
      syncedAt: new Date().toISOString(),
      duration: `${duration}s`,
    });
  } catch (error) {
    console.error("Sync /all failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Sync failed",
    });
  }
});

module.exports = router;
