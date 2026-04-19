const express = require("express");
const dataSyncService = require("../services/dataSyncService");

const router = express.Router();

// Manual sync endpoint - triggers bidirectional sync between local and cloud
router.post("/all", async (req, res) => {
  try {
    console.log("[Sync Route] Manual sync triggered...");
    const startTime = Date.now();

    const syncResult = await dataSyncService.sync();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Sync Route] Manual sync finished in ${duration}s`);

    if (syncResult?.skipped) {
      return res.json({
        success: true,
        skipped: true,
        message:
          "Bidirectional local/cloud sync is disabled (single MONGODB_URI deployment).",
        reason: syncResult.reason,
        syncedAt: new Date().toISOString(),
        duration: `${duration}s`,
      });
    }

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
