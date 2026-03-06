const mongoose = require("mongoose");

const merchantSettingsSchema = new mongoose.Schema(
  {
    // Only one active config per merchant - enforced by unique index
    isActive: {
      type: Boolean,
      default: true,
    },
    // GCash for Business / Payment Gateway credentials
    appId: {
      type: String,
      required: true,
      trim: true,
    },
    // Encrypted at rest using AES-256-GCM — never returned to frontend after save
    encryptedPrivateKey: {
      type: String,
      required: true,
    },
    privateKeyIV: {
      type: String,
      required: true,
    },
    privateKeyAuthTag: {
      type: String,
      required: true,
    },
    publicKey: {
      type: String,
      required: true,
      trim: true,
    },
    // sandbox | production
    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "sandbox",
      required: true,
    },
    // Auto-generated webhook URL (read-only on frontend)
    webhookUrl: {
      type: String,
      default: "",
    },
    // Merchant display name for QR labels
    merchantName: {
      type: String,
      default: "POS System",
      trim: true,
    },
    // Payment expiry in minutes (default 15)
    paymentExpiryMinutes: {
      type: Number,
      default: 15,
      min: 5,
      max: 60,
    },
    // Who configured this
    configuredBy: {
      type: String,
      default: "",
    },
    configuredByName: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Ensure only one active configuration exists
merchantSettingsSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

// SECURITY: Never return private key fields in queries by default
merchantSettingsSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.encryptedPrivateKey;
  delete obj.privateKeyIV;
  delete obj.privateKeyAuthTag;
  return obj;
};

// Static: Get active configuration
merchantSettingsSchema.statics.getActiveConfig = async function () {
  return this.findOne({ isActive: true });
};

module.exports = mongoose.model("MerchantSettings", merchantSettingsSchema);
