/**
 * GCash Payment Expiry Cron
 *
 * Runs every minute to expire GCash payments that have exceeded
 * their timeout period (default: 15 minutes).
 *
 * Expired payments are:
 * 1. Marked gcashStatus = 'EXPIRED'
 * 2. Transaction status set to 'Voided'
 * 3. POS frontend notified via WebSocket
 */

const cron = require("node-cron");
const SalesTransaction = require("../models/SalesTransaction");

let wsClients = null;

/**
 * Set WebSocket clients reference for notifications
 */
function setWsClients(clients) {
  wsClients = clients;
}

/**
 * Notify POS frontend about expired payment
 */
function notifyExpired(merchantOrderId) {
  if (!wsClients) return;

  const clients = wsClients.get(merchantOrderId);
  if (clients && clients.size > 0) {
    const message = JSON.stringify({
      type: "PAYMENT_UPDATE",
      merchantOrderId,
      status: "EXPIRED",
    });
    clients.forEach((ws) => {
      try {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      } catch (err) {
        // Client disconnected
      }
    });
  }
}

/**
 * Process expired GCash payments
 */
async function expireStalePayments() {
  try {
    const now = new Date();

    // Find all PENDING GCash payments past their expiry time
    const expiredTransactions = await SalesTransaction.find({
      gcashStatus: "PENDING",
      gcashExpiresAt: { $lte: now },
    }).select("merchantOrderId gcashStatus");

    if (expiredTransactions.length === 0) return;

    console.log(
      `[PaymentExpiry] Found ${expiredTransactions.length} expired GCash payment(s)`,
    );

    // Bulk update all expired transactions
    const merchantOrderIds = expiredTransactions.map((t) => t.merchantOrderId);

    await SalesTransaction.updateMany(
      {
        merchantOrderId: { $in: merchantOrderIds },
        gcashStatus: "PENDING",
      },
      {
        $set: {
          gcashStatus: "EXPIRED",
          status: "Voided",
          voidReason: "GCash payment expired (timeout)",
          voidedAt: now,
        },
      },
    );

    // Notify all expired orders via WebSocket
    merchantOrderIds.forEach((orderId) => {
      notifyExpired(orderId);
    });

    console.log(
      `[PaymentExpiry] Expired ${merchantOrderIds.length} payment(s):`,
      merchantOrderIds,
    );
  } catch (error) {
    console.error(
      "[PaymentExpiry] Error processing expired payments:",
      error.message,
    );
  }
}

/**
 * Initialize the payment expiry cron job.
 * Runs every minute.
 */
function initPaymentExpiryCron() {
  // Run every minute
  cron.schedule("* * * * *", async () => {
    await expireStalePayments();
  });

  console.log("✓ GCash payment expiry cron started (runs every minute)");
}

module.exports = {
  initPaymentExpiryCron,
  setWsClients,
  expireStalePayments,
};
