const mongoose = require("mongoose");

const syncLogSchema = new mongoose.Schema(
  {
    entity: {
      type: String,
      required: true,
      enum: [
        "SalesTransaction",
        "Product",
        "StockMovement",
        "Employee",
        "Category",
        "Discount",
        "BrandPartner",
        "VoidLog",
        "Archive",
        "Cart",
      ],
      unique: true,
    },
    lastSyncedAt: {
      type: Date,
      default: new Date(0), // Default to epoch to sync everything initially
    },
    status: {
      type: String,
      enum: ["Success", "Failed", "InProgress"],
      default: "Success",
    },
    message: String,
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("SyncLog", syncLogSchema);
