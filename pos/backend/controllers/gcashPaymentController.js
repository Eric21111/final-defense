/**
 * GCash Payment Controller
 *
 * Production-grade payment endpoints:
 * 1. POST /api/payments/gcash/create   — Create GCash payment + dynamic QR
 * 2. GET  /api/payments/gcash/status/:merchantOrderId — Poll payment status
 * 3. POST /api/payments/gcash/webhook  — Receive payment notifications (webhook)
 * 4. POST /api/payments/gcash/cancel/:merchantOrderId — Cancel pending payment
 *
 * Security:
 * - Payment creation is server-side only
 * - Webhook verifies PayMongo signature (HMAC-SHA256)
 * - Idempotent webhook processing via event ID tracking
 * - Frontend never receives private keys
 */

const apicache = require("apicache");
const SalesTransaction = require("../models/SalesTransaction");
const Product = require("../models/Product");
const Discount = require("../models/Discount");
const gcashService = require("../services/gcashPaymentService");
const { assertSaleStockAvailable } = require("../utils/saleStockValidation");

const clearTransactionAnalyticsCache = () => {
  try {
    apicache.clear();
  } catch (_) {
    /* ignore */
  }
};

// In-memory WebSocket clients map: merchantOrderId → Set<ws>
// Populated by server.js WebSocket setup
let wsClients = new Map();

/**
 * Set the WebSocket clients map (called from server.js)
 */
exports.setWsClients = (clients) => {
  wsClients = clients;
};

/**
 * Notify POS frontend via WebSocket that payment status changed
 */
const notifyPaymentUpdate = (merchantOrderId, data) => {
  const clients = wsClients.get(merchantOrderId);
  if (clients && clients.size > 0) {
    const message = JSON.stringify({
      type: "PAYMENT_UPDATE",
      merchantOrderId,
      ...data,
    });
    clients.forEach((ws) => {
      try {
        if (ws.readyState === 1) {
          // WebSocket.OPEN
          ws.send(message);
        }
      } catch (err) {
        console.error("[WS] Error sending to client:", err.message);
      }
    });
    console.log(
      `[WS] Notified ${clients.size} client(s) for order ${merchantOrderId}`,
    );
  }
};

/**
 * Helper: Generate unique receipt number
 */
const generateUniqueReceiptNumber = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const receiptNo = Math.floor(100000 + Math.random() * 900000).toString();
    const existing = await SalesTransaction.findOne({ receiptNo });
    if (!existing) {
      return receiptNo;
    }
    attempts++;
  }
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(10 + Math.random() * 90).toString();
  return `${timestamp}${random}`;
};

/**
 * POST /api/payments/gcash/create
 *
 * Creates a GCash payment order:
 * 1. Creates a PENDING transaction in the database
 * 2. Calls GCash/PayMongo API to create a payment source
 * 3. Returns checkout URL + QR payload for frontend to display
 *
 * Body: {
 *   items: [...],
 *   totalAmount: number,
 *   userId: string,
 *   performedById: string,
 *   performedByName: string,
 *   subtotal: number,
 *   discount: number,
 *   discountType: string,
 *   discountValue: number,
 *   appliedDiscountIds: string[]
 * }
 */
exports.createGCashPayment = async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      userId,
      performedById,
      performedByName,
      subtotal,
      discount,
      discountType,
      discountValue,
      appliedDiscountIds,
    } = req.body;

    // Validate
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items are required",
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid total amount is required",
      });
    }

    try {
      await assertSaleStockAvailable(items);
    } catch (stockErr) {
      return res.status(400).json({
        success: false,
        message: stockErr.message || "Insufficient stock for this sale",
      });
    }

    // Generate unique IDs
    const merchantOrderId = gcashService.generateMerchantOrderId();
    const receiptNo = await generateUniqueReceiptNumber();

    // Get merchant config for expiry time
    const MerchantSettings = require("../models/MerchantSettings");
    const config = await MerchantSettings.getActiveConfig();
    const expiryMinutes = config?.paymentExpiryMinutes || 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Step 1: Create pending transaction in DB FIRST (before calling external API)
    const transactionData = {
      receiptNo,
      userId: userId || performedById || "system",
      performedById: performedById || "",
      performedByName: performedByName || "",
      items: items.map((item) => ({
        productId: item.productId || item._id,
        itemName: item.itemName || "Unknown Item",
        sku: item.sku || "",
        variant: item.variant || null,
        selectedSize: item.selectedSize || null,
        quantity: item.quantity || 1,
        price: item.price || item.itemPrice || 0,
        itemImage: item.itemImage || "",
      })),
      subtotal: subtotal || totalAmount,
      discount: discount || 0,
      discountType: discountType || null,
      discountValue: discountValue || 0,
      totalAmount,
      paymentMethod: "gcash",
      amountReceived: 0,
      changeGiven: 0,
      status: "Pending", // Will be updated to Completed when payment is confirmed
      merchantOrderId,
      gcashStatus: "PENDING",
      gcashExpiresAt: expiresAt,
      checkedOutAt: new Date(),
    };

    const transaction = await SalesTransaction.create(transactionData);

    // Step 2: Call GCash payment gateway API
    let paymentSource;
    try {
      paymentSource = await gcashService.createPaymentSource({
        merchantOrderId,
        amount: totalAmount,
        description: `POS Order ${receiptNo}`,
      });
    } catch (gatewayError) {
      // If gateway fails, mark transaction as FAILED
      transaction.gcashStatus = "FAILED";
      transaction.status = "Failed";
      await transaction.save();

      console.error(
        "[GCash] Gateway error, transaction marked FAILED:",
        gatewayError.message,
      );
      return res.status(502).json({
        success: false,
        message: gatewayError.message || "Payment gateway unavailable",
        merchantOrderId,
      });
    }

    // Step 3: Update transaction with gateway response
    transaction.gcashSourceId = paymentSource.sourceId;
    transaction.gcashCheckoutUrl = paymentSource.checkoutUrl;
    await transaction.save();

    console.log("[GCash] Payment created:", {
      merchantOrderId,
      receiptNo,
      sourceId: paymentSource.sourceId,
      amount: totalAmount,
      expiresAt: expiresAt.toISOString(),
    });

    // Step 4: Return data to frontend for QR display
    res.status(201).json({
      success: true,
      data: {
        merchantOrderId,
        receiptNo,
        sourceId: paymentSource.sourceId,
        checkoutUrl: paymentSource.checkoutUrl,
        amount: totalAmount,
        currency: "PHP",
        status: "PENDING",
        expiresAt: expiresAt.toISOString(),
        expiryMinutes,
      },
    });

    // Update discount usage counts asynchronously
    if (
      appliedDiscountIds &&
      Array.isArray(appliedDiscountIds) &&
      appliedDiscountIds.length > 0
    ) {
      Promise.all(
        appliedDiscountIds.map((id) =>
          Discount.findByIdAndUpdate(id, { $inc: { usageCount: 1 } }),
        ),
      ).catch((err) =>
        console.error("Error updating discount usage counts:", err),
      );
    }
  } catch (error) {
    console.error("[GCash] Error creating payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create GCash payment",
      error: error.message,
    });
  }
};

/**
 * GET /api/payments/gcash/status/:merchantOrderId
 *
 * Poll payment status from the POS frontend.
 * Returns current gcashStatus and transaction details.
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;

    const transaction = await SalesTransaction.findOne({ merchantOrderId })
      .select(
        "merchantOrderId gcashStatus gcashPaidAt gcashReference receiptNo totalAmount status gcashExpiresAt",
      )
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check if expired
    if (
      transaction.gcashStatus === "PENDING" &&
      transaction.gcashExpiresAt &&
      new Date() > new Date(transaction.gcashExpiresAt)
    ) {
      // Mark as expired
      await SalesTransaction.findOneAndUpdate(
        { merchantOrderId, gcashStatus: "PENDING" },
        { gcashStatus: "EXPIRED" },
      );
      transaction.gcashStatus = "EXPIRED";
    }

    res.json({
      success: true,
      data: {
        merchantOrderId: transaction.merchantOrderId,
        status: transaction.gcashStatus,
        paidAt: transaction.gcashPaidAt,
        gcashReference: transaction.gcashReference,
        receiptNo: transaction.receiptNo,
        totalAmount: transaction.totalAmount,
        transactionStatus: transaction.status,
        expiresAt: transaction.gcashExpiresAt,
      },
    });
  } catch (error) {
    console.error("[GCash] Error checking status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment status",
    });
  }
};

/**
 * POST /api/payments/gcash/webhook
 *
 * PayMongo webhook handler.
 *
 * Security:
 * - Verifies HMAC-SHA256 signature
 * - Idempotent: duplicate webhooks are safely ignored
 * - Only processes source.chargeable events
 *
 * Flow:
 * 1. Verify webhook signature
 * 2. Extract source ID and merchant_order_id from event
 * 3. Find matching PENDING transaction
 * 4. Create payment from chargeable source (charge the customer)
 * 5. Update transaction → PAID
 * 6. Notify POS frontend via WebSocket
 * 7. Update stock
 */
exports.handleWebhook = async (req, res) => {
  try {
    // PayMongo sends raw JSON body
    const rawBody = JSON.stringify(req.body);
    const signatureHeader = req.headers["paymongo-signature"];
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // Step 1: Verify webhook signature (MANDATORY — never skip in any environment)
    if (!webhookSecret) {
      console.error(
        "[GCash Webhook] PAYMONGO_WEBHOOK_SECRET is not configured — rejecting webhook for security",
      );
      return res.status(500).json({ message: "Webhook secret not configured" });
    }

    const isValid = gcashService.verifyWebhookSignature(
      rawBody,
      signatureHeader,
      webhookSecret,
    );
    if (!isValid) {
      console.warn("[GCash Webhook] Invalid signature — rejecting");
      return res.status(401).json({ message: "Invalid signature" });
    }

    const event = req.body?.data;
    if (!event) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const eventId = event.id;
    const eventType = event.attributes?.type;
    const sourceData = event.attributes?.data;

    console.log("[GCash Webhook] Received event:", {
      eventId,
      eventType,
      sourceId: sourceData?.id,
    });

    // Step 2: Only process source.chargeable events
    if (eventType !== "source.chargeable") {
      // Acknowledge but don't process
      console.log("[GCash Webhook] Ignoring event type:", eventType);
      return res.status(200).json({ message: "Event acknowledged" });
    }

    const sourceId = sourceData?.id;
    const merchantOrderId = sourceData?.attributes?.metadata?.merchant_order_id;
    const paidAmount = sourceData?.attributes?.amount; // in centavos

    if (!sourceId || !merchantOrderId) {
      console.warn("[GCash Webhook] Missing sourceId or merchantOrderId");
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Step 3: Idempotency check — has this event already been processed?
    const existingProcessed = await SalesTransaction.findOne({
      merchantOrderId,
      gcashWebhookEventId: eventId,
    });

    if (existingProcessed) {
      console.log(
        "[GCash Webhook] Duplicate event, already processed:",
        eventId,
      );
      return res.status(200).json({ message: "Already processed" });
    }

    // Step 4: Find matching PENDING transaction
    const transaction = await SalesTransaction.findOne({
      merchantOrderId,
      gcashSourceId: sourceId,
      gcashStatus: { $in: ["PENDING", "CHARGEABLE"] },
    });

    if (!transaction) {
      console.warn(
        "[GCash Webhook] No matching pending transaction for:",
        merchantOrderId,
      );
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Step 5: Validate amount matches (centavos comparison)
    const expectedAmountCentavos = Math.round(transaction.totalAmount * 100);
    if (paidAmount && Math.abs(paidAmount - expectedAmountCentavos) > 1) {
      console.error("[GCash Webhook] Amount mismatch:", {
        expected: expectedAmountCentavos,
        received: paidAmount,
        merchantOrderId,
      });
      transaction.gcashStatus = "FAILED";
      transaction.status = "Failed";
      await transaction.save();
      return res.status(400).json({ message: "Amount mismatch" });
    }

    // Step 6: Mark as CHARGEABLE and create payment
    transaction.gcashStatus = "CHARGEABLE";
    transaction.gcashWebhookEventId = eventId;
    await transaction.save();

    let paymentResult;
    try {
      paymentResult = await gcashService.createPayment(
        sourceId,
        transaction.totalAmount,
      );
    } catch (paymentError) {
      console.error(
        "[GCash Webhook] Failed to create payment:",
        paymentError.message,
      );
      transaction.gcashStatus = "FAILED";
      transaction.status = "Failed";
      await transaction.save();

      notifyPaymentUpdate(merchantOrderId, {
        status: "FAILED",
        error: "Payment processing failed",
      });

      return res.status(500).json({ message: "Payment creation failed" });
    }

    // Step 7: Prepare transaction data (but don't save PAID status yet)
    transaction.gcashPaymentId = paymentResult.paymentId;
    transaction.gcashPaidAt = paymentResult.paidAt || new Date();
    transaction.gcashReference = paymentResult.gcashReference;
    transaction.gcashFeeAmount = paymentResult.feeAmount;
    transaction.gcashNetAmount = paymentResult.netAmount;
    transaction.amountReceived = transaction.totalAmount;
    transaction.referenceNo =
      paymentResult.gcashReference || paymentResult.paymentId;

    console.log("[GCash Webhook] ✅ Payment confirmed:", {
      merchantOrderId,
      paymentId: paymentResult.paymentId,
      amount: transaction.totalAmount,
      gcashReference: paymentResult.gcashReference,
    });

    // Step 8: Update stock BEFORE marking as PAID (so poll/refresh gets updated data)
    try {
      await updateStockAfterPayment(transaction);
    } catch (stockErr) {
      console.error("[GCash] Stock update error:", stockErr.message);
    }

    // Step 9: NOW mark as PAID and save (poll endpoint will see PAID only after stock is updated)
    transaction.gcashStatus = "PAID";
    transaction.status = "Completed";
    await transaction.save();

    // Step 10: Notify POS frontend via WebSocket (stock is already updated)
    notifyPaymentUpdate(merchantOrderId, {
      status: "PAID",
      paidAt: transaction.gcashPaidAt,
      gcashReference: transaction.gcashReference,
      receiptNo: transaction.receiptNo,
      totalAmount: transaction.totalAmount,
    });

    // Respond 200 to acknowledge webhook
    res.status(200).json({ message: "Payment processed successfully" });
  } catch (error) {
    console.error("[GCash Webhook] Unhandled error:", error);
    // Always return 200 for webhooks to prevent retries on our errors
    res.status(200).json({ message: "Acknowledged with error" });
  }
};

/**
 * POST /api/payments/gcash/cancel/:merchantOrderId
 *
 * Cancel a pending GCash payment (before customer pays)
 */
exports.cancelPayment = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;

    const transaction = await SalesTransaction.findOne({
      merchantOrderId,
      gcashStatus: "PENDING",
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "No pending payment found to cancel",
      });
    }

    transaction.gcashStatus = "EXPIRED";
    transaction.status = "Voided";
    transaction.voidReason = "GCash payment cancelled by cashier";
    transaction.voidedAt = new Date();
    await transaction.save();

    console.log("[GCash] Payment cancelled:", merchantOrderId);

    res.json({
      success: true,
      message: "Payment cancelled successfully",
    });
  } catch (error) {
    console.error("[GCash] Error cancelling payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel payment",
    });
  }
};

/**
 * GET /api/payments/gcash/config-status
 *
 * Check if GCash payment is configured (no credentials returned).
 * Used by frontend to show/hide GCash payment option.
 */
exports.getConfigStatus = async (req, res) => {
  try {
    const MerchantSettings = require("../models/MerchantSettings");
    const config = await MerchantSettings.getActiveConfig();

    res.json({
      success: true,
      data: {
        isConfigured: !!config,
        environment: config?.environment || null,
        merchantName: config?.merchantName || null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check configuration",
    });
  }
};

/**
 * Update product stock after successful GCash payment.
 * Mirrors the stock update logic used in the cash payment flow (updateStockAfterTransaction).
 */
async function updateStockAfterPayment(transaction) {
  if (!transaction || !transaction.items || transaction.items.length === 0)
    return;

  // Helper to get quantity from size data (handles both {quantity: 5, price: 200} and plain number 5)
  const getSizeQty = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.quantity !== undefined
    ) {
      return sizeData.quantity;
    }
    return typeof sizeData === "number" ? sizeData : 0;
  };

  // Helper to get price from size data
  const getSizePrice = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.price !== undefined
    ) {
      return sizeData.price;
    }
    return null;
  };

  // Helper to find size key case-insensitively
  const findSizeKey = (sizes, targetSize) => {
    if (!sizes || !targetSize) return null;
    const keys =
      typeof sizes.keys === "function"
        ? Array.from(sizes.keys())
        : Object.keys(sizes);
    return (
      keys.find((k) => k.toLowerCase() === targetSize.toLowerCase()) || null
    );
  };

  for (const item of transaction.items) {
    try {
      const product = await Product.findById(item.productId);
      if (!product) {
        console.warn(`[GCash] Product not found: ${item.productId}`);
        continue;
      }

      const stockBefore = product.currentStock || 0;
      const qty = item.quantity || 1;
      const size = item.selectedSize || null;
      const variant = item.variant || null;

      if (size && product.sizes && typeof product.sizes === "object") {
        // Size-based stock update
        const sizeKey = findSizeKey(product.sizes, size);

        if (sizeKey) {
          const currentSizeData = product.sizes.get
            ? product.sizes.get(sizeKey)
            : product.sizes[sizeKey];
          const currentQty = getSizeQty(currentSizeData);
          const currentPrice = getSizePrice(currentSizeData);

          // Check if this size has variants and a variant is specified
          if (variant && typeof currentSizeData === "object" && currentSizeData !== null && currentSizeData.variants) {
            // Handle variant-specific stock
            const variantData = currentSizeData.variants[variant];
            
            // Get current variant quantity (handles both number and object formats)
            let currentVariantQty = 0;
            if (typeof variantData === "number") {
              currentVariantQty = variantData;
            } else if (typeof variantData === "object" && variantData !== null) {
              currentVariantQty = variantData.quantity || 0;
            }

            const newVariantQty = Math.max(0, currentVariantQty - qty);

            // Update variant quantity while preserving format
            if (typeof variantData === "object" && variantData !== null) {
              currentSizeData.variants[variant] = {
                ...variantData,
                quantity: newVariantQty,
              };
            } else {
              currentSizeData.variants[variant] = newVariantQty;
            }

            // Recalculate size total quantity from all variants
            let sizeTotal = 0;
            for (const [varKey, varValue] of Object.entries(currentSizeData.variants)) {
              if (typeof varValue === "number") {
                sizeTotal += varValue;
              } else if (typeof varValue === "object" && varValue !== null) {
                sizeTotal += varValue.quantity || 0;
              }
            }
            currentSizeData.quantity = sizeTotal;
            
            // Explicitly reassign the updated size data back to product.sizes
            if (product.sizes.set) {
              product.sizes.set(sizeKey, currentSizeData);
            } else {
              product.sizes[sizeKey] = currentSizeData;
            }
            product.markModified("sizes");
          } else {
            // No variants, update size quantity directly
            const newQty = Math.max(0, currentQty - qty);

            // Preserve price structure if it exists
            if (
              currentPrice !== null ||
              (typeof currentSizeData === "object" && currentSizeData !== null)
            ) {
              if (product.sizes.set) {
                product.sizes.set(sizeKey, {
                  ...currentSizeData,
                  quantity: newQty,
                  price:
                    currentPrice !== null ? currentPrice : product.itemPrice || 0,
                });
              } else {
                product.sizes[sizeKey] = {
                  ...currentSizeData,
                  quantity: newQty,
                  price:
                    currentPrice !== null ? currentPrice : product.itemPrice || 0,
                };
              }
            } else {
              if (product.sizes.set) {
                product.sizes.set(sizeKey, newQty);
              } else {
                product.sizes[sizeKey] = newQty;
              }
            }
            product.markModified("sizes");
          }
        } else {
          console.warn(
            `[GCash] Size "${size}" not found for product ${product.itemName}`,
          );
        }

        // Recalculate total currentStock from all sizes
        const sizeEntries = product.sizes.entries
          ? Array.from(product.sizes.entries())
          : Object.entries(product.sizes);
        let totalStock = 0;
        for (const [, value] of sizeEntries) {
          totalStock += getSizeQty(value);
        }
        product.currentStock = totalStock;
      } else {
        // Simple stock update (no sizes)
        product.currentStock = Math.max(0, (product.currentStock || 0) - qty);
      }

      // Auto-manage displayInTerminal based on stock levels
      if (product.currentStock === 0) {
        product.displayInTerminal = false;
      } else if (stockBefore === 0 && product.currentStock > 0) {
        product.displayInTerminal = true;
      }

      product.lastUpdated = Date.now();
      await product.save();
    } catch (err) {
      console.error(
        `[GCash] Stock update failed for product ${item.productId}:`,
        err.message,
      );
    }
  }

  console.log("[GCash] Stock updated for", transaction.items.length, "items");
}
