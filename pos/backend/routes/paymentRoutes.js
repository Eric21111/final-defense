const express = require("express");
const router = express.Router();
const {
  createGCashPayment,
  checkPaymentStatus,
  handleWebhook,
  cancelPayment,
  getConfigStatus,
} = require("../controllers/gcashPaymentController");

// GET /api/payments/gcash/config-status — Check if GCash is configured
router.get("/gcash/config-status", getConfigStatus);

// POST /api/payments/gcash/create — Create GCash payment + dynamic QR
router.post("/gcash/create", createGCashPayment);

// GET /api/payments/gcash/status/:merchantOrderId — Poll payment status
router.get("/gcash/status/:merchantOrderId", checkPaymentStatus);

// POST /api/payments/gcash/webhook — PayMongo webhook (no auth middleware)
router.post("/gcash/webhook", handleWebhook);

// POST /api/payments/gcash/cancel/:merchantOrderId — Cancel pending payment
router.post("/gcash/cancel/:merchantOrderId", cancelPayment);

// GET /api/payments/gcash/redirect — Customer redirect after GCash payment
// This is where PayMongo sends the customer after they pay/cancel in GCash app
router.get("/gcash/redirect", (req, res) => {
  const { status, order } = req.query;
  const message =
    status === "success"
      ? "Payment successful! You can close this page and return to the store."
      : "Payment was not completed. Please return to the store counter.";

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Payment ${status === "success" ? "Complete" : "Failed"}</title>
      <style>
        body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .card { background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px; }
        .icon { font-size: 64px; margin-bottom: 16px; }
        h1 { color: ${status === "success" ? "#22c55e" : "#ef4444"}; font-size: 24px; }
        p { color: #666; line-height: 1.6; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${status === "success" ? "✅" : "❌"}</div>
        <h1>${status === "success" ? "Payment Successful!" : "Payment Not Completed"}</h1>
        <p>${message}</p>
        <p style="color:#999; font-size:12px; margin-top:20px;">Order: ${order || "N/A"}</p>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;
