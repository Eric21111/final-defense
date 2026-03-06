const mongoose = require("mongoose");
const SyncLog = require("../models/SyncLog");
const dbManager = require("../config/databaseManager");

// Import Schemas
const SalesTransactionSchema = require("../models/SalesTransaction").schema;
const ProductSchema = require("../models/Product").schema;
const StockMovementSchema = require("../models/StockMovement").schema;
const EmployeeSchema = require("../models/Employee").schema;
const CategorySchema = require("../models/Category").schema;
const DiscountSchema = require("../models/Discount").schema;
const BrandPartnerSchema = require("../models/BrandPartner").schema;
const VoidLogSchema = require("../models/VoidLog").schema;
const ArchiveSchema = require("../models/Archive").schema;
const CartSchema = require("../models/Cart").schema;

class DataSyncService {
  constructor() {
    this.isSyncing = false;
    this.localURI = "mongodb://localhost:27017/pos-system";
    this.cloudURI = process.env.MONGODB_URI || "";
  }

  async sync() {
    if (this.isSyncing) {
      console.log("[Sync] Sync already in progress, skipping...");
      return;
    }

    // Only sync if we have internet
    const isOnline = await dbManager.checkInternetConnection();
    if (!isOnline) {
      console.log("[Sync] Offline, skipping sync.");
      return;
    }

    this.isSyncing = true;
    console.log("[Sync] Starting synchronization...");

    let localConn = null;
    let cloudConn = null;

    try {
      // Create separate connections for isolation
      console.log("[Sync] Connecting to Local DB...");
      localConn = await mongoose.createConnection(this.localURI).asPromise();

      console.log("[Sync] Connecting to Cloud DB...");
      cloudConn = await mongoose.createConnection(this.cloudURI).asPromise();

      // Register Models on connections
      const models = {
        SalesTransaction: {
          Local: localConn.model("SalesTransaction", SalesTransactionSchema),
          Cloud: cloudConn.model("SalesTransaction", SalesTransactionSchema),
          uniqueField: "_id",
        },
        Product: {
          Local: localConn.model("Product", ProductSchema),
          Cloud: cloudConn.model("Product", ProductSchema),
          uniqueField: "sku",
        },
        StockMovement: {
          Local: localConn.model("StockMovement", StockMovementSchema),
          Cloud: cloudConn.model("StockMovement", StockMovementSchema),
          uniqueField: "_id",
        },
        Employee: {
          Local: localConn.model("Employee", EmployeeSchema),
          Cloud: cloudConn.model("Employee", EmployeeSchema),
          uniqueField: "email",
        }, // Changed to email
        Category: {
          Local: localConn.model("Category", CategorySchema),
          Cloud: cloudConn.model("Category", CategorySchema),
          uniqueField: "_id",
        },
        Discount: {
          Local: localConn.model("Discount", DiscountSchema),
          Cloud: cloudConn.model("Discount", DiscountSchema),
          uniqueField: "_id",
        },
        BrandPartner: {
          Local: localConn.model("BrandPartner", BrandPartnerSchema),
          Cloud: cloudConn.model("BrandPartner", BrandPartnerSchema),
          uniqueField: "_id",
        },
        VoidLog: {
          Local: localConn.model("VoidLog", VoidLogSchema),
          Cloud: cloudConn.model("VoidLog", VoidLogSchema),
          uniqueField: "_id",
        },
        Archive: {
          Local: localConn.model("Archive", ArchiveSchema),
          Cloud: cloudConn.model("Archive", ArchiveSchema),
          uniqueField: "_id",
        },
        Cart: {
          Local: localConn.model("Cart", CartSchema),
          Cloud: cloudConn.model("Cart", CartSchema),
          uniqueField: "_id",
        },
      };

      // --- SYNC ALL ENTITIES ---
      for (const [entityName, config] of Object.entries(models)) {
        await this.syncBidirectional(
          entityName,
          config.Local,
          config.Cloud,
          config.uniqueField,
        );
      }

      console.log("[Sync] Synchronization complete.");
    } catch (error) {
      console.error("[Sync] Error during synchronization:", error);
    } finally {
      this.isSyncing = false;
      if (localConn) await localConn.close();
      if (cloudConn) await cloudConn.close();
    }
  }

  async syncBidirectional(
    entityName,
    LocalModel,
    CloudModel,
    uniqueField = "_id",
  ) {
    try {
      // Get last sync time
      let lastSync = await SyncLog.findOne({ entity: entityName });
      if (!lastSync) {
        lastSync = new SyncLog({
          entity: entityName,
          lastSyncedAt: new Date(0),
        });
      }

      console.log(
        `[Sync] Syncing ${entityName} since ${lastSync.lastSyncedAt}...`,
      );

      // 1. Push Local -> Cloud (Modified in Local)
      const localUpdates = await LocalModel.find({
        updatedAt: { $gt: lastSync.lastSyncedAt },
      });

      if (localUpdates.length > 0) {
        console.log(
          `[Sync] Pushing ${localUpdates.length} ${entityName} updates to Cloud...`,
        );
        const bulkPush = localUpdates.map((doc) => {
          const docObj = doc.toObject ? doc.toObject() : { ...doc };
          // Preserve the original createdAt timestamp during sync
          // Remove Mongoose version key to avoid conflicts
          delete docObj.__v;
          return {
            updateOne: {
              filter: { [uniqueField]: doc[uniqueField] },
              update: {
                $set: docObj,
                $setOnInsert: { createdAt: docObj.createdAt || doc.createdAt },
              },
              upsert: true,
              timestamps: false, // Prevent Mongoose from overwriting createdAt on upsert
            },
          };
        });
        await CloudModel.bulkWrite(bulkPush, { timestamps: false });
      }

      // 2. Pull Cloud -> Local (Modified in Cloud)
      const cloudUpdates = await CloudModel.find({
        updatedAt: { $gt: lastSync.lastSyncedAt },
      });

      if (cloudUpdates.length > 0) {
        console.log(
          `[Sync] Pulling ${cloudUpdates.length} ${entityName} updates from Cloud...`,
        );
        const bulkPull = cloudUpdates.map((doc) => {
          const docObj = doc.toObject ? doc.toObject() : { ...doc };
          // Preserve the original createdAt timestamp during sync
          delete docObj.__v;
          return {
            updateOne: {
              filter: { [uniqueField]: doc[uniqueField] },
              update: {
                $set: docObj,
                $setOnInsert: { createdAt: docObj.createdAt || doc.createdAt },
              },
              upsert: true,
              timestamps: false, // Prevent Mongoose from overwriting createdAt on upsert
            },
          };
        });
        await LocalModel.bulkWrite(bulkPull, { timestamps: false });
      }

      // Update Log
      lastSync.lastSyncedAt = new Date();
      lastSync.status = "Success";
      await lastSync.save();

      if (localUpdates.length === 0 && cloudUpdates.length === 0) {
        console.log(`[Sync] ${entityName} is up to date.`);
      }
    } catch (error) {
      console.error(`[Sync] Failed to sync ${entityName}:`, error);
      await SyncLog.findOneAndUpdate(
        { entity: entityName },
        { status: "Failed", message: error.message },
        { upsert: true },
      );
    }
  }
}

module.exports = new DataSyncService();
