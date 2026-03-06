/**
 * Merchant Settings Controller
 *
 * Admin-only CRUD for GCash payment gateway credentials.
 * Credentials are encrypted at rest and never returned to the frontend after save.
 */

const MerchantSettings = require("../models/MerchantSettings");
const { encrypt } = require("../utils/encryption");

/**
 * GET /api/merchant-settings
 * Get active merchant settings (without private key)
 */
exports.getSettings = async (req, res) => {
  try {
    const settings = await MerchantSettings.getActiveConfig();

    if (!settings) {
      return res.json({
        success: true,
        data: null,
        message: "No payment gateway configured",
      });
    }

    // Return safe version (no encrypted fields)
    res.json({
      success: true,
      data: settings.toSafeJSON(),
    });
  } catch (error) {
    console.error("[MerchantSettings] Error fetching settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payment settings",
      error: error.message,
    });
  }
};

/**
 * POST /api/merchant-settings
 * Create or update merchant settings (upsert)
 *
 * Body: { appId, privateKey, publicKey, environment, merchantName, paymentExpiryMinutes }
 */
exports.saveSettings = async (req, res) => {
  try {
    const {
      appId,
      privateKey,
      publicKey,
      environment,
      merchantName,
      paymentExpiryMinutes,
      configuredBy,
      configuredByName,
    } = req.body;

    // Validate required fields
    if (!appId || !privateKey || !publicKey) {
      return res.status(400).json({
        success: false,
        message: "app_id, private_key, and public_key are all required",
      });
    }

    if (environment && !["sandbox", "production"].includes(environment)) {
      return res.status(400).json({
        success: false,
        message: 'Environment must be "sandbox" or "production"',
      });
    }

    // Encrypt the private key
    const { encrypted, iv, authTag } = encrypt(privateKey);

    // Auto-generate webhook URL
    const baseUrl =
      process.env.WEBHOOK_BASE_URL ||
      process.env.BASE_URL ||
      `http://localhost:${process.env.PORT || 5000}`;
    const webhookUrl = `${baseUrl}/api/payments/gcash/webhook`;

    // Upsert: deactivate any existing config, create new one
    await MerchantSettings.updateMany({ isActive: true }, { isActive: false });

    const settings = await MerchantSettings.create({
      isActive: true,
      appId: appId.trim(),
      encryptedPrivateKey: encrypted,
      privateKeyIV: iv,
      privateKeyAuthTag: authTag,
      publicKey: publicKey.trim(),
      environment: environment || "sandbox",
      webhookUrl,
      merchantName: merchantName?.trim() || "POS System",
      paymentExpiryMinutes: paymentExpiryMinutes || 15,
      configuredBy: configuredBy || "",
      configuredByName: configuredByName || "",
    });

    console.log("[MerchantSettings] Configuration saved:", {
      id: settings._id,
      appId: settings.appId,
      environment: settings.environment,
      configuredBy: configuredByName,
    });

    res.status(201).json({
      success: true,
      message: "Payment gateway configured successfully",
      data: settings.toSafeJSON(),
    });
  } catch (error) {
    console.error("[MerchantSettings] Error saving settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save payment settings",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/merchant-settings
 * Deactivate all merchant settings
 */
exports.deleteSettings = async (req, res) => {
  try {
    const result = await MerchantSettings.updateMany(
      { isActive: true },
      { isActive: false },
    );

    res.json({
      success: true,
      message:
        result.modifiedCount > 0
          ? "Payment gateway configuration removed"
          : "No active configuration to remove",
    });
  } catch (error) {
    console.error("[MerchantSettings] Error deleting settings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove payment settings",
      error: error.message,
    });
  }
};

/**
 * POST /api/merchant-settings/test
 * Test connection to the payment gateway
 */
exports.testConnection = async (req, res) => {
  try {
    const settings = await MerchantSettings.getActiveConfig();

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: "No payment gateway configured",
      });
    }

    // Try to hit the PayMongo API with a simple request
    const { decrypt: decryptKey } = require("../utils/encryption");
    const privateKey = decryptKey(
      settings.encryptedPrivateKey,
      settings.privateKeyIV,
      settings.privateKeyAuthTag,
    );

    const baseUrl =
      settings.environment === "production"
        ? "https://api.paymongo.com/v1"
        : "https://api.paymongo.com/v1";

    const response = await fetch(`${baseUrl}/payment_methods?limit=1`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(privateKey + ":").toString("base64")}`,
        Accept: "application/json",
      },
    });

    if (response.ok || response.status === 404) {
      // 200 = success, 404 = authenticated but no resources (also valid)
      res.json({
        success: true,
        message: `Connected to PayMongo (${settings.environment}) successfully`,
        environment: settings.environment,
      });
    } else {
      const errorData = await response.json().catch(() => ({}));
      res.status(400).json({
        success: false,
        message: "Connection failed. Please verify your credentials.",
        error: errorData?.errors?.[0]?.detail || `HTTP ${response.status}`,
      });
    }
  } catch (error) {
    console.error("[MerchantSettings] Test connection error:", error);
    res.status(500).json({
      success: false,
      message: "Connection test failed",
      error: error.message,
    });
  }
};
