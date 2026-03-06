/**
 * GCash Payment Service
 *
 * Production-grade integration with GCash for Business via PayMongo-compatible API.
 *
 * Architecture:
 * - GCash for Business uses PayMongo as the payment gateway
 * - PayMongo provides: Source creation → QR generation → Webhook notification
 * - This service abstracts the gateway API behind a clean interface
 *
 * Flow:
 * 1. createPaymentSource() → creates a GCash payment source with amount
 * 2. Gateway returns checkout_url + QR payload
 * 3. Customer scans QR / opens checkout_url
 * 4. Gateway sends webhook on payment completion
 * 5. verifyWebhookSignature() validates authenticity
 * 6. Payment is marked PAID
 *
 * Supports: PayMongo (default GCash for Business gateway)
 * Can be extended for: Xendit, DragonPay, or direct GCash API
 */

const crypto = require("crypto");
const MerchantSettings = require("../models/MerchantSettings");
const { decrypt } = require("../utils/encryption");

// PayMongo API endpoints
const PAYMONGO_ENDPOINTS = {
  sandbox: "https://api.paymongo.com/v1",
  production: "https://api.paymongo.com/v1",
};

class GCashPaymentService {
  /**
   * Get active merchant configuration with decrypted private key.
   * Private key is decrypted in-memory only, never stored decrypted.
   */
  async getConfig() {
    const settings = await MerchantSettings.getActiveConfig();
    if (!settings) {
      throw new Error(
        "GCash payment not configured. Please set up merchant credentials in Admin Settings.",
      );
    }

    let privateKey;
    try {
      privateKey = decrypt(
        settings.encryptedPrivateKey,
        settings.privateKeyIV,
        settings.privateKeyAuthTag,
      );
    } catch (err) {
      console.error("[GCash] Failed to decrypt private key:", err.message);
      throw new Error(
        "Payment configuration error. Please re-enter merchant credentials.",
      );
    }

    return {
      appId: settings.appId,
      privateKey,
      publicKey: settings.publicKey,
      environment: settings.environment,
      baseUrl: PAYMONGO_ENDPOINTS[settings.environment],
      merchantName: settings.merchantName,
      paymentExpiryMinutes: settings.paymentExpiryMinutes,
    };
  }

  /**
   * Create a GCash payment source via PayMongo.
   *
   * This generates a checkout URL that produces a dynamic QR code.
   * Each call creates a unique payment source tied to the specific order.
   *
   * @param {Object} params
   * @param {string} params.merchantOrderId - Unique POS order ID
   * @param {number} params.amount - Amount in PHP (will be converted to centavos)
   * @param {string} params.description - Order description
   * @returns {Object} { sourceId, checkoutUrl, status }
   */
  async createPaymentSource({ merchantOrderId, amount, description }) {
    const config = await this.getConfig();

    // PayMongo amounts are in centavos (smallest currency unit)
    const amountInCentavos = Math.round(amount * 100);

    if (amountInCentavos < 10000) {
      // Minimum ₱100 for GCash
      throw new Error("Minimum GCash payment amount is ₱100.00");
    }

    // Redirect URLs after payment — points to our own server (or frontend)
    const webhookBaseUrl =
      process.env.WEBHOOK_BASE_URL ||
      `http://localhost:${process.env.PORT || 5000}`;

    const payload = {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: "PHP",
          type: "gcash",
          redirect: {
            success: `${webhookBaseUrl}/api/payments/gcash/redirect?status=success&order=${merchantOrderId}`,
            failed: `${webhookBaseUrl}/api/payments/gcash/redirect?status=failed&order=${merchantOrderId}`,
          },
          billing: {
            name: config.merchantName || "POS Customer",
            email: "pos-customer@payment.local",
          },
          metadata: {
            merchant_order_id: merchantOrderId,
            description: description || `POS Order ${merchantOrderId}`,
          },
        },
      },
    };

    try {
      const response = await fetch(`${config.baseUrl}/sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(config.privateKey + ":").toString("base64")}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[GCash] PayMongo source creation failed:", {
          status: response.status,
          error: errorData,
        });
        throw new Error(
          errorData?.errors?.[0]?.detail ||
            `Payment gateway error: ${response.status}`,
        );
      }

      const data = await response.json();
      const source = data.data;

      console.log("[GCash] Payment source created:", {
        sourceId: source.id,
        merchantOrderId,
        amount: amount,
        status: source.attributes.status,
      });

      return {
        sourceId: source.id,
        checkoutUrl: source.attributes.redirect.checkout_url,
        status: source.attributes.status,
        amount: amount,
        currency: "PHP",
      };
    } catch (error) {
      if (
        error.message.includes("Payment gateway") ||
        error.message.includes("Minimum")
      ) {
        throw error;
      }
      console.error(
        "[GCash] Network error creating payment source:",
        error.message,
      );
      throw new Error(
        "Unable to connect to payment gateway. Please check your internet connection.",
      );
    }
  }

  /**
   * Create a Payment object from a chargeable source.
   * Called when webhook notifies us the source is chargeable.
   *
   * @param {string} sourceId - The PayMongo source ID
   * @param {number} amount - Amount in PHP
   * @returns {Object} Payment confirmation
   */
  async createPayment(sourceId, amount) {
    const config = await this.getConfig();
    const amountInCentavos = Math.round(amount * 100);

    const payload = {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: "PHP",
          source: {
            id: sourceId,
            type: "source",
          },
          description: `POS GCash Payment`,
        },
      },
    };

    try {
      const response = await fetch(`${config.baseUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(config.privateKey + ":").toString("base64")}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[GCash] Payment creation failed:", errorData);
        throw new Error(
          errorData?.errors?.[0]?.detail ||
            `Payment processing error: ${response.status}`,
        );
      }

      const data = await response.json();
      const payment = data.data;

      console.log("[GCash] Payment created:", {
        paymentId: payment.id,
        sourceId,
        status: payment.attributes.status,
      });

      return {
        paymentId: payment.id,
        status: payment.attributes.status, // 'paid'
        paidAt: payment.attributes.paid_at,
        amount: payment.attributes.amount / 100,
        currency: payment.attributes.currency,
        feeAmount: payment.attributes.fee / 100,
        netAmount: payment.attributes.net_amount / 100,
        gcashReference:
          payment.attributes.external_reference_number || payment.id,
      };
    } catch (error) {
      if (error.message.includes("Payment processing")) {
        throw error;
      }
      console.error("[GCash] Network error creating payment:", error.message);
      throw new Error("Payment processing failed. Please try again.");
    }
  }

  /**
   * Check the status of a payment source.
   * Used for polling from the POS frontend.
   *
   * @param {string} sourceId - PayMongo source ID
   * @returns {Object} { status, checkoutUrl }
   */
  async checkSourceStatus(sourceId) {
    const config = await this.getConfig();

    try {
      const response = await fetch(`${config.baseUrl}/sources/${sourceId}`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(config.privateKey + ":").toString("base64")}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check payment status: ${response.status}`);
      }

      const data = await response.json();
      const source = data.data;

      return {
        sourceId: source.id,
        status: source.attributes.status, // pending, chargeable, cancelled, expired, paid
        amount: source.attributes.amount / 100,
        checkoutUrl: source.attributes.redirect?.checkout_url,
      };
    } catch (error) {
      console.error("[GCash] Error checking source status:", error.message);
      throw new Error("Unable to check payment status.");
    }
  }

  /**
   * Verify webhook signature from PayMongo.
   *
   * PayMongo signs webhooks with HMAC-SHA256 using the webhook secret key.
   * This prevents spoofed webhook calls.
   *
   * Signature header format: t=<timestamp>,te=<test_signature>,li=<live_signature>
   *
   * @param {string} rawBody - The raw request body string
   * @param {string} signatureHeader - The Paymongo-Signature header
   * @param {string} webhookSecretKey - The webhook signing secret
   * @returns {boolean} true if signature is valid
   */
  verifyWebhookSignature(rawBody, signatureHeader, webhookSecretKey) {
    if (!signatureHeader || !webhookSecretKey) {
      console.warn("[GCash] Missing signature header or webhook secret");
      return false;
    }

    try {
      // Parse the signature header
      const parts = {};
      signatureHeader.split(",").forEach((part) => {
        const [key, value] = part.split("=");
        parts[key.trim()] = value?.trim();
      });

      const timestamp = parts["t"];
      if (!timestamp) {
        console.warn("[GCash] No timestamp in signature header");
        return false;
      }

      // Prevent replay attacks: reject signatures older than 5 minutes
      const signatureAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
      if (signatureAge > 300) {
        console.warn(
          "[GCash] Webhook signature too old:",
          signatureAge,
          "seconds",
        );
        return false;
      }

      // Compute expected signature
      const signedPayload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecretKey)
        .update(signedPayload)
        .digest("hex");

      // Check against test (te) or live (li) signature
      const testSignature = parts["te"];
      const liveSignature = parts["li"];

      const isValid =
        (testSignature &&
          crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(testSignature, "hex"),
          )) ||
        (liveSignature &&
          crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "hex"),
            Buffer.from(liveSignature, "hex"),
          ));

      if (!isValid) {
        console.warn("[GCash] Webhook signature verification failed");
      }

      return !!isValid;
    } catch (error) {
      console.error("[GCash] Signature verification error:", error.message);
      return false;
    }
  }

  /**
   * Generate a unique merchant order ID.
   * Format: GCASH-<timestamp>-<random>
   */
  generateMerchantOrderId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `GCASH-${timestamp}-${random}`;
  }
}

module.exports = new GCashPaymentService();
