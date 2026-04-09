const mongoose = require("mongoose");
const dns = require("dns").promises;

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.cloudURI = process.env.MONGODB_URI || "";
    this.localURI = "mongodb://localhost:27017/pos-system";
    this.currentURI = null;
    this.isOnline = false;
    this.connectionCheckInterval = null;
    this.isReconnecting = false;
    this.connectPromise = null;
    // Cloud-only mode: meaningful for hosted backend (no local fallback)
    this.cloudOnlyMode = process.env.CLOUD_ONLY === "true";
  }

  async checkInternetConnection() {
    try {
      await dns.resolve("google.com");
      return true;
    } catch (error) {
      return false;
    }
  }

  async initialize() {
    try {
      await this.connect();

      this.startConnectionMonitoring();
    } catch (error) {
      console.error("Failed to initialize database:", error.message);
      throw error;
    }
  }

  startConnectionMonitoring() {
    if (this.cloudOnlyMode) return; // No need to monitor in cloud-only mode

    this.connectionCheckInterval = setInterval(async () => {
      if (this.isReconnecting) return;

      const wasOnline = this.isOnline;
      const isNowOnline = await this.checkInternetConnection();

      if (wasOnline !== isNowOnline) {
        this.isOnline = isNowOnline;
        console.log(
          `\n[Connection Status Changed] Online: ${wasOnline} -> ${isNowOnline}`,
        );

        const shouldUseCloud = isNowOnline && this.cloudURI;
        const currentlyUsingCloud = this.currentURI === this.cloudURI;

        if (shouldUseCloud && !currentlyUsingCloud) {
          console.log("[Switching] Moving from LOCAL to CLOUD database...");
          await this.reconnect();
        } else if (!shouldUseCloud && currentlyUsingCloud) {
          console.log("[Switching] Moving from CLOUD to LOCAL database...");
          await this.reconnect();
        }
      }
    }, 30000);
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
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = (async () => {
      try {
        if (process.env.MONGODB_URI) {
          this.cloudURI = process.env.MONGODB_URI;
        }

        if (mongoose.connection.readyState === 1 && !this.isReconnecting) {
          return mongoose.connection;
        }

        // CLOUD ONLY MODE (Hosted Backend)
        if (this.cloudOnlyMode) {
          this.currentURI = this.cloudURI;
          this.isOnline = true; // Assume online in cloud environment
          console.log("[Connection] Cloud-Only Mode - Connecting to Cloud DB...");
        }
        // HYBRID MODE (Local Backend)
        else {
          this.isOnline = await this.checkInternetConnection();

          console.log("DEBUG: isOnline =", this.isOnline);
          console.log(
            "DEBUG: cloudURI =",
            this.cloudURI ? "Configured" : "Not Configured",
          );

          if (this.isOnline && this.cloudURI) {
            this.currentURI = this.cloudURI;
            console.log("[Connection] Internet ONLINE - Forcing CLOUD database");
          } else {
            this.currentURI = this.localURI;
            if (!this.cloudURI) {
              console.log(
                "[Connection] No cloud URI configured - Using LOCAL database",
              );
            } else {
              console.log("[Connection] Internet OFFLINE - Using LOCAL database");
            }
          }
        }

        await mongoose.connect(this.currentURI, {
          maxPoolSize: 10,          // Max connections in pool (default is 5, 10 handles concurrent mobile+web)
          minPoolSize: 2,           // Keep 2 warm connections ready
          socketTimeoutMS: 45000,   // Close sockets after 45s of inactivity
          serverSelectionTimeoutMS: 10000,  // Fail fast if no server available (10s vs default 30s)
        });

        console.log(`✓ MongoDB Connected: ${mongoose.connection.host}`);
        console.log(
          `✓ Database mode: ${this.isOnline && this.cloudURI ? "CLOUD" : "LOCAL"}`,
        );

        this.connection = mongoose.connection;

        // Ensure we only attach these global handlers once
        if (!mongoose.connection.listeners('disconnected').length) {
          mongoose.connection.on("disconnected", () => {
            console.log("[Warning] Database disconnected");
          });
        }
        if (!mongoose.connection.listeners('error').length) {
          mongoose.connection.on("error", (err) => {
            console.error("[Error] Database connection error:", err.message);
          });
        }

        return mongoose.connection;
      } catch (error) {
        console.error("[Error] Failed to connect to MongoDB:", error.message);

        if (this.isOnline && this.currentURI === this.cloudURI) {
          console.log(
            "[Fallback] Cloud database failed - Attempting local database...",
          );
          try {
            this.currentURI = this.localURI;
            await mongoose.connect(this.currentURI);
            console.log(
              `✓ MongoDB Connected (Local Fallback): ${mongoose.connection.host}`,
            );
            this.connection = mongoose.connection;
            return mongoose.connection;
          } catch (fallbackError) {
            console.error(
              "[Error] Local database fallback failed:",
              fallbackError.message,
            );
            throw fallbackError;
          }
        }

        throw error;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  getConnection() {
    return mongoose.connection;
  }

  isConnected() {
    return mongoose.connection.readyState === 1;
  }

  getCurrentMode() {
    return this.currentURI === this.cloudURI ? "CLOUD" : "LOCAL";
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
