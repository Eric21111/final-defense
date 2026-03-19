const mongoose = require("mongoose");
const Product = require("../models/Product");
const SalesTransaction = require("../models/SalesTransaction");
const StockMovement = require("../models/StockMovement");
const Employee = require("../models/Employee");
const Category = require("../models/Category");
const Discount = require("../models/Discount");
const BrandPartner = require("../models/BrandPartner");
const VoidLog = require("../models/VoidLog");
const Archive = require("../models/Archive");
const Cart = require("../models/Cart");
const MerchantSettings = require("../models/MerchantSettings");
const SyncLog = require("../models/SyncLog");
const bcrypt = require("bcryptjs");

// Map of collection keys to models and display names
const DATA_COLLECTIONS = {
  products: { model: Product, name: "Inventory / Products" },
  transactions: { model: SalesTransaction, name: "Sales Transactions" },
  stockMovements: { model: StockMovement, name: "Stock Movements" },
  categories: { model: Category, name: "Categories" },
  discounts: { model: Discount, name: "Discounts" },
  brandPartners: { model: BrandPartner, name: "Brand Partners" },
  voidLogs: { model: VoidLog, name: "Void Logs" },
  archives: { model: Archive, name: "Archives" },
  carts: { model: Cart, name: "Cart Data" },
  employees: { model: Employee, name: "Employees" },
  merchantSettings: { model: MerchantSettings, name: "Merchant Settings" },
};

// GET /api/data-management/collections - Get available data collections with counts
exports.getCollections = async (req, res) => {
  try {
    const collections = await Promise.all(
      Object.entries(DATA_COLLECTIONS).map(async ([key, { model, name }]) => {
        try {
          const count = await model.countDocuments();
          return { key, name, count };
        } catch {
          return { key, name, count: 0 };
        }
      }),
    );

    res.json({ success: true, data: collections });
  } catch (error) {
    console.error("Error fetching collections:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch collections" });
  }
};

// POST /api/data-management/clear - Clear selected collections
exports.clearData = async (req, res) => {
  try {
    const { collections, pin } = req.body;

    if (!pin) {
      return res
        .status(400)
        .json({ success: false, message: "PIN is required" });
    }

    if (
      !collections ||
      !Array.isArray(collections) ||
      collections.length === 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please select at least one data type to clear",
        });
    }

    // Verify PIN belongs to Owner or Manager
    const employees = await Employee.find({
      status: "Active",
      role: { $in: ["Owner", "Manager"] },
    })
      .select("+pin")
      .lean();

    let verified = false;
    for (const emp of employees) {
      if (!emp.pin) continue;
      try {
        const isMatch = await bcrypt.compare(pin, emp.pin);
        if (isMatch) {
          verified = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!verified) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Invalid PIN. Only Owner or Manager can perform this action.",
        });
    }

    // Validate all collection keys
    const invalidKeys = collections.filter((key) => !DATA_COLLECTIONS[key]);
    if (invalidKeys.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Invalid collections: ${invalidKeys.join(", ")}`,
        });
    }

    const results = [];
    for (const key of collections) {
      const { model, name } = DATA_COLLECTIONS[key];
      try {
        if (key === "employees") {
          // Safety: never delete Owner accounts during "Clear Data"
          const result = await model.deleteMany({ role: { $ne: "Owner" } });
          results.push({
            key,
            name,
            deleted: result.deletedCount,
            note: "Owner accounts were preserved",
          });
        } else {
          const result = await model.deleteMany({});
          results.push({ key, name, deleted: result.deletedCount });
        }
      } catch (err) {
        results.push({ key, name, deleted: 0, error: err.message });
      }
    }

    // Also clear sync logs for cleared collections
    try {
      await SyncLog.deleteMany({});
    } catch {
      // Non-critical
    }

    const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);

    res.json({
      success: true,
      message: `Successfully cleared ${totalDeleted} records from ${results.length} collection(s)`,
      data: results,
    });
  } catch (error) {
    console.error("Error clearing data:", error);
    res.status(500).json({ success: false, message: "Failed to clear data" });
  }
};

// POST /api/data-management/export - Export selected collections as JSON
exports.exportData = async (req, res) => {
  try {
    const { collections } = req.body;

    if (
      !collections ||
      !Array.isArray(collections) ||
      collections.length === 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please select at least one data type to export",
        });
    }

    const invalidKeys = collections.filter((key) => !DATA_COLLECTIONS[key]);
    if (invalidKeys.length > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Invalid collections: ${invalidKeys.join(", ")}`,
        });
    }

    const exportedData = {};
    const summary = [];

    for (const key of collections) {
      const { model, name } = DATA_COLLECTIONS[key];
      try {
        // For employees, exclude pin field
        let data;
        if (key === "employees") {
          data = await model.find().select("-pin").lean();
        } else if (key === "merchantSettings") {
          // Exclude encrypted private key fields
          data = await model
            .find()
            .select("-encryptedPrivateKey -privateKeyIV -privateKeyAuthTag")
            .lean();
        } else {
          data = await model.find().lean();
        }
        exportedData[key] = data;
        summary.push({ key, name, count: data.length });
      } catch (err) {
        exportedData[key] = [];
        summary.push({ key, name, count: 0, error: err.message });
      }
    }

    res.json({
      success: true,
      data: exportedData,
      summary,
      exportedAt: new Date().toISOString(),
      version: "1.0",
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ success: false, message: "Failed to export data" });
  }
};

// POST /api/data-management/import - Import data from backup
exports.importData = async (req, res) => {
  try {
    const { data, pin } = req.body;

    if (!pin) {
      return res
        .status(400)
        .json({ success: false, message: "PIN is required" });
    }

    if (!data || typeof data !== "object") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid import data format" });
    }

    // Verify PIN belongs to Owner or Manager
    const employees = await Employee.find({
      status: "Active",
      role: { $in: ["Owner", "Manager"] },
    })
      .select("+pin")
      .lean();

    let verified = false;
    for (const emp of employees) {
      if (!emp.pin) continue;
      try {
        const isMatch = await bcrypt.compare(pin, emp.pin);
        if (isMatch) {
          verified = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!verified) {
      return res
        .status(401)
        .json({
          success: false,
          message:
            "Invalid PIN. Only Owner or Manager can perform this action.",
        });
    }

    const results = [];
    const collectionKeys = Object.keys(data).filter(
      (key) => DATA_COLLECTIONS[key],
    );

    if (collectionKeys.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "No valid collection data found in import file",
        });
    }

    // Define unique key fields for each collection for upsert operations
    const uniqueKeyFields = {
      products: 'sku',
      employees: 'email',
      categories: 'name',
      brandPartners: 'name',
      discounts: 'name',
      merchantSettings: 'merchantName',
    };

    for (const key of collectionKeys) {
      const { model, name } = DATA_COLLECTIONS[key];
      const records = data[key];

      if (!Array.isArray(records) || records.length === 0) {
        results.push({ key, name, imported: 0, skipped: true });
        continue;
      }

      try {
        // Clean records by removing _id and __v
        const cleanRecords = records.map((record) => {
          const { _id, __v, ...rest } = record;
          return rest;
        });

        const uniqueField = uniqueKeyFields[key];
        let insertedCount = 0;
        let updatedCount = 0;

        if (uniqueField) {
          // Use bulkWrite with upsert for collections with unique fields
          const bulkOps = cleanRecords.map((record) => ({
            updateOne: {
              filter: { [uniqueField]: record[uniqueField] },
              update: { $set: record },
              upsert: true
            }
          }));

          const bulkResult = await model.bulkWrite(bulkOps, { ordered: false });
          insertedCount = bulkResult.upsertedCount || 0;
          updatedCount = bulkResult.modifiedCount || 0;
          results.push({ 
            key, 
            name, 
            imported: insertedCount, 
            updated: updatedCount,
            total: insertedCount + updatedCount
          });
        } else {
          // Use insertMany for collections without unique constraints
          const result = await model
            .insertMany(cleanRecords, { ordered: false })
            .catch((err) => {
              // If some inserts fail (duplicates), return the ones that succeeded
              if (err.insertedDocs) return err.insertedDocs;
              if (err.result && err.result.nInserted)
                return { length: err.result.nInserted };
              throw err;
            });

          insertedCount = Array.isArray(result)
            ? result.length
            : result?.length || 0;
          results.push({ key, name, imported: insertedCount });
        }
      } catch (err) {
        console.error(`Error importing ${key}:`, err);
        results.push({ key, name, imported: 0, error: err.message });
      }
    }

    const totalImported = results.reduce(
      (sum, r) => sum + (r.imported || 0),
      0,
    );
    const totalUpdated = results.reduce(
      (sum, r) => sum + (r.updated || 0),
      0,
    );

    let message = `Successfully imported ${totalImported} new records`;
    if (totalUpdated > 0) {
      message += ` and updated ${totalUpdated} existing records`;
    }
    message += ` across ${results.filter((r) => (r.imported || 0) + (r.updated || 0) > 0).length} collection(s)`;

    res.json({
      success: true,
      message,
      data: results,
    });
  } catch (error) {
    console.error("Error importing data:", error);
    res.status(500).json({ success: false, message: "Failed to import data" });
  }
};
