const express = require("express");
const dotenv = require("dotenv");

// Load env vars before other imports
dotenv.config();

const http = require("http");
const { WebSocketServer } = require("ws");
const cors = require("cors");
const compression = require("compression");
const connectDB = require("./config/database");
const networkDetection = require("./middleware/networkDetection");
const { initStockAlertCron } = require("./services/stockAlertCron");
const {
  initPaymentExpiryCron,
  setWsClients: setExpiryCronWsClients,
} = require("./services/paymentExpiryCron");
const {
  setWsClients: setPaymentControllerWsClients,
} = require("./controllers/gcashPaymentController");

const app = express();
const server = http.createServer(app);

// ==========================================
// WebSocket Server for Real-Time Payment Updates
// ==========================================
const wss = new WebSocketServer({ server, path: "/ws/payments" });

// Map: merchantOrderId → Set<WebSocket>
const wsPaymentClients = new Map();

wss.on("connection", (ws, req) => {
  // Extract merchantOrderId from query string: /ws/payments?orderId=GCASH-xxx
  const url = new URL(req.url, `http://${req.headers.host}`);
  const merchantOrderId = url.searchParams.get("orderId");

  if (!merchantOrderId) {
    ws.close(4000, "Missing orderId parameter");
    return;
  }

  // Register this WebSocket client for the specific order
  if (!wsPaymentClients.has(merchantOrderId)) {
    wsPaymentClients.set(merchantOrderId, new Set());
  }
  wsPaymentClients.get(merchantOrderId).add(ws);

  console.log(
    `[WS] Client connected for order: ${merchantOrderId} (${wsPaymentClients.get(merchantOrderId).size} clients)`,
  );

  // Send initial connection confirmation
  ws.send(
    JSON.stringify({
      type: "CONNECTED",
      merchantOrderId,
      message: "Listening for payment updates",
    }),
  );

  // Cleanup on disconnect
  ws.on("close", () => {
    const clients = wsPaymentClients.get(merchantOrderId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        wsPaymentClients.delete(merchantOrderId);
      }
    }
    console.log(`[WS] Client disconnected for order: ${merchantOrderId}`);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Error for order ${merchantOrderId}:`, err.message);
  });
});

// Share WebSocket clients map with payment controller and expiry cron
setPaymentControllerWsClients(wsPaymentClients);
setExpiryCronWsClients(wsPaymentClients);

// Connect to database
connectDB();

// CORS: Restrict to known origins
const allowedOrigins = [
  "http://localhost:5173",    // Vite dev server
  "http://localhost:3000",    // Alternate dev port
  "http://localhost:8081",    // Expo Web dev server (default)
  "http://localhost:19006",   // Expo Web legacy dev port
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "https://createyourstyle.me", // Explicitly added to prevent CORS blocks
  process.env.FRONTEND_URL,  // Production frontend URL (set in .env)
  process.env.WEBHOOK_BASE_URL, // ngrok tunnel URL
].filter(Boolean); // Remove undefined values

// Regex patterns for dynamic origins (Vercel preview deployments)
const allowedOriginPatterns = [
  /\.vercel\.app$/,           // All Vercel deployments
  /\.onrender\.com$/,         // Render deployments
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, server-to-server, Postman)
    if (!origin) return callback(null, true);

    // Check exact matches
    if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }

    // Check pattern matches (for Vercel preview deployments, etc.)
    if (allowedOriginPatterns.some(pattern => pattern.test(origin))) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));
app.use(compression()); // Gzip compress all responses (~60-80% smaller payloads for mobile)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Enable ETag for conditional 304 responses (saves bandwidth on repeated requests)
app.set("etag", "strong");

// Database connection check middleware
app.use(networkDetection);

app.get("/", (req, res) => {
  const dbManager = require("./config/databaseManager");
  res.json({
    message: "Welcome to POS System API",
    database: `${dbManager.getCurrentMode()} MongoDB`,
  });
});

// Lightweight ping for connection warmup (no DB query)
app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/print", require("./routes/printRoutes"));

const employeeRoutes = require("./routes/employeeRoutes");
const verificationRoutes = require("./routes/verificationRoutes");

// Use Routes
app.use("/api/employees", employeeRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/cart", require("./routes/cartRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/stock-movements", require("./routes/stockMovementRoutes"));
app.use("/api/archive", require("./routes/archiveRoutes"));
app.use("/api/void-logs", require("./routes/voidLogRoutes"));
app.use("/api/discounts", require("./routes/discountRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/brand-partners", require("./routes/brandPartnerRoutes"));
app.use("/api/sync", require("./routes/syncRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/data-management", require("./routes/dataManagementRoutes"));

// GCash Payment Integration Routes
app.use("/api/merchant-settings", require("./routes/merchantSettingsRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/remittances", require("./routes/remittanceRoutes"));
app.use("/api/global-settings", require("./routes/globalSettingsRoutes"));

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`\n========================================`);
  console.log(`  POS Backend Server Started`);
  console.log(`========================================`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Host: ${HOST}`);
  console.log(`  Cloud-Only Mode: ${process.env.CLOUD_ONLY === 'true' ? 'Yes' : 'No'}`);
  console.log(`  Sync Enabled: ${process.env.ENABLE_SYNC !== 'false' ? 'Yes' : 'No'}`);
  console.log(`========================================\n`);

  // Initialize background services (Sync & Alerts) - Only run if enabled (default: true)
  // Disable this on the Cloud Backend to prevent it from trying to sync with a non-existent local DB
  if (process.env.ENABLE_SYNC !== "false") {
    // Initialize stock alert cron job
    initStockAlertCron();

    // Schedule Data Sync (Every 5 minutes)
    const cron = require("node-cron");
    const dataSyncService = require("./services/dataSyncService");

    cron.schedule("*/5 * * * *", async () => {
      console.log("[Cron] Triggering Data Sync...");
      await dataSyncService.sync();
    });
    console.log("✓ Background services (Sync & Alerts) started");
  } else {
    console.log("ℹ Background services (Sync & Alerts) disabled (ENABLE_SYNC=false)");
  }

  // Always start payment expiry cron (independent of sync)
  initPaymentExpiryCron();
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    const dbManager = require("./config/databaseManager");
    dbManager.disconnect().then(() => {
      console.log('Database connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
