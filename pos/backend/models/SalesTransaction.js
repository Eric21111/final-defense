const mongoose = require("mongoose");

const transactionItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    itemName: String,
    sku: String,
    variant: String,
    selectedSize: String,
    quantity: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    itemImage: {
      type: String,
      default: "",
    },
    returnStatus: {
      type: String,
      enum: ["Returned", "Partially Returned", null],
      default: null,
    },
    returnedQuantity: {
      type: Number,
      default: null,
    },
    returnReason: {
      type: String,
      default: null,
    },
    voidReason: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

const salesTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    performedById: String,
    performedByName: String,
    items: {
      type: [transactionItemSchema],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "gcash", "void", "return"],
      required: true,
    },
    amountReceived: Number,
    changeGiven: Number,
    referenceNo: String,
    receiptNo: String,
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Completed", "Returned", "Partially Returned", "Voided"],
      default: "Completed",
    },
    checkedOutAt: {
      type: Date,
      default: Date.now,
    },
    originalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalesTransaction",
      default: null,
    },
    voidedBy: {
      type: String,
      default: null,
    },
    voidedByName: {
      type: String,
      default: null,
    },
    voidedAt: {
      type: Date,
      default: null,
    },
    voidReason: {
      type: String,
      default: null,
    },
    voidId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // === GCash Automated Payment Fields ===
    // Unique merchant-generated order ID for GCash payments (GCASH-<ts>-<rand>)
    merchantOrderId: {
      type: String,
      sparse: true,
      index: true,
      default: null,
    },
    // Payment gateway source ID (e.g. PayMongo source_xxx)
    gcashSourceId: {
      type: String,
      default: null,
    },
    // Payment gateway payment ID (after source is charged)
    gcashPaymentId: {
      type: String,
      default: null,
    },
    // GCash payment lifecycle status
    gcashStatus: {
      type: String,
      enum: ["PENDING", "CHARGEABLE", "PAID", "FAILED", "EXPIRED", null],
      default: null,
    },
    // URL for customer to complete GCash payment / generate QR
    gcashCheckoutUrl: {
      type: String,
      default: null,
    },
    // GCash reference number from payment gateway
    gcashReference: {
      type: String,
      default: null,
    },
    // Timestamp when GCash payment was confirmed
    gcashPaidAt: {
      type: Date,
      default: null,
    },
    // Payment expiry time for auto-expiration cron
    gcashExpiresAt: {
      type: Date,
      default: null,
    },
    // Fee charged by payment gateway
    gcashFeeAmount: {
      type: Number,
      default: null,
    },
    // Net amount after gateway fees
    gcashNetAmount: {
      type: Number,
      default: null,
    },
    // Webhook event ID for idempotency
    gcashWebhookEventId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
salesTransactionSchema.index({ checkedOutAt: -1 });
salesTransactionSchema.index({ status: 1 });
salesTransactionSchema.index({ receiptNo: 1 });
salesTransactionSchema.index({ userId: 1 });
salesTransactionSchema.index({ paymentMethod: 1 });
salesTransactionSchema.index({ referenceNo: 1 });
salesTransactionSchema.index({ createdAt: -1 });
salesTransactionSchema.index({ "items.productId": 1 }); // For product transaction lookups

// Compound indexes for dashboard/report queries (status + paymentMethod + date range)
salesTransactionSchema.index({ status: 1, paymentMethod: 1, checkedOutAt: -1 });
salesTransactionSchema.index({ status: 1, paymentMethod: 1, createdAt: -1 });

// GCash-specific indexes
salesTransactionSchema.index({ gcashSourceId: 1 }, { sparse: true });
salesTransactionSchema.index(
  { gcashStatus: 1, gcashExpiresAt: 1 },
  { sparse: true },
);

// Export schema for dynamic connection
module.exports.schema = salesTransactionSchema;

// Export default model for backward compatibility
module.exports = mongoose.model("SalesTransaction", salesTransactionSchema);
