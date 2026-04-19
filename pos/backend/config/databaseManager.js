const mongoose = require("mongoose");

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.currentURI = null;
    this.isOnline = true;
    this.connectionCheckInterval = null;
    this.isReconnecting = false;
  }

  async checkInternetConnection() {
    try {
      const dns = require("dns").promises;
      await dns.resolve("google.com");
      return true;
    } catch {
      return false;
    }
  }

  async initialize() {
    try {
      await this.connect();
      // Single remote database — no local/cloud switching or polling.
    } catch (error) {
      console.error("Failed to initialize database:", error.message);
      throw error;
    }
  }

  startConnectionMonitoring() {
    // Intentionally empty: hybrid local/cloud switching was removed.
  }

  stopConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  async reconnect() {
    if (this.isReconnecting) {
      console.log("[Reconnect] Already reconnecting, skipping...");
      return;
    }

    try {
      this.isReconnecting = true;

      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log("[Reconnect] Previous connection closed");
      }

      await this.connect();
    } catch (error) {
      console.error("[Reconnect] Failed:", error.message);
    } finally {
      this.isReconnecting = false;
    }
  }

  async connect() {
    try {
      const uri = String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
      if (!uri) {
        throw new Error(
          "MONGODB_URI (or MONGO_URI) is not set. Add your Atlas / remote connection string to .env.",
        );
      }

      this.currentURI = uri;

      if (mongoose.connection.readyState === 1 && !this.isReconnecting) {
        return mongoose.connection;
      }

      this.isOnline = true;
      console.log("[Connection] Connecting to MongoDB...");

      const poolMax = Number(process.env.MONGO_MAX_POOL_SIZE) || 10;
      const poolMin = Number(process.env.MONGO_MIN_POOL_SIZE) || 1;

      await mongoose.connect(this.currentURI, {
        maxPoolSize: poolMax,
        minPoolSize: poolMin,
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 120000,
        retryWrites: true,
        retryReads: true,
        heartbeatFrequencyMS: 10000,
      });

      console.log(`✓ MongoDB Connected: ${mongoose.connection.host}`);
      console.log("✓ Database mode: REMOTE (single URI)");

      this.connection = mongoose.connection;

      mongoose.connection.on("disconnected", () => {
        console.log("[Warning] Database disconnected");
      });

      mongoose.connection.on("error", (err) => {
        console.error("[Error] Database connection error:", err.message);
      });

      return mongoose.connection;
    } catch (error) {
      console.error("[Error] Failed to connect to MongoDB:", error.message);
      throw error;
    }
  }

  getConnection() {
    return mongoose.connection;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  getCurrentMode() {
    return "CLOUD";
  }

  async disconnect() {
    this.stopConnectionMonitoring();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("Database connection closed");
    }
  }
}

const dbManager = new DatabaseManager();

module.exports = dbManager;
