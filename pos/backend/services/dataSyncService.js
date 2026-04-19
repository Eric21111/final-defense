const dbManager = require("../config/databaseManager");

/**
 * Legacy bidirectional sync (localhost ↔ Atlas) was removed with the local database.
 * The app uses a single MONGODB_URI. Cron and POST /api/sync/all still call this module;
 * sync() is a no-op. Set ENABLE_SYNC=false in .env to skip the cron job entirely.
 */
class DataSyncService {
  constructor() {
    this._loggedSkipNoLocal = false;
  }

  /**
   * @returns {{ skipped: boolean, reason?: string }}
   */
  async sync() {
    const isOnline = await dbManager.checkInternetConnection();
    if (!isOnline) {
      console.log("[Sync] Offline, skipping sync.");
      return { skipped: true, reason: "offline" };
    }

    if (!this._loggedSkipNoLocal) {
      this._loggedSkipNoLocal = true;
      console.log(
        "[Sync] Skipped: no local secondary DB (single MONGODB_URI). Set ENABLE_SYNC=false to disable this cron.",
      );
    }
    return { skipped: true, reason: "no_local_secondary" };
  }
}

module.exports = new DataSyncService();
