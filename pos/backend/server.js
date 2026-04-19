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
// Two paths on one HTTP server: the `ws` library's default attach mode runs every
// upgrade through each server's handleUpgrade(); the first server aborts non-matching
// paths and kills the socket before /ws/inventory can run. Route upgrades manually
// (see https://github.com/websockets/ws#multiple-servers-sharing-a-single-https-server).
const wss = new WebSocketServer({ noServer: true });

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

// ==========================================
// WebSocket: live inventory updates for terminals
// ==========================================
const {
  registerInventoryClient,
} = require("./services/inventoryBroadcast");
const wssInventory = new WebSocketServer({ noServer: true });
wssInventory.on("connection", (ws) => {
  registerInventoryClient(ws);
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  try {
    ws.send(
      JSON.stringify({
        type: "CONNECTED",
        message: "Subscribed to inventory updates",
      }),
    );
  } catch (e) {
    console.warn("[WS inventory] Failed to send hello:", e.message);
  }
  console.log("[WS inventory] Client connected");
});

// Keep inventory sockets warm (some hosts/proxies drop idle WS; cheap no-op traffic).
const inventoryWsPing = setInterval(() => {
  wssInventory.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      return;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  });
}, 25000);
inventoryWsPing.unref?.();

server.on("upgrade", (request, socket, head) => {
  let pathname;
  try {
    pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname === "/ws/payments") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else if (pathname === "/ws/inventory") {
    wssInventory.handleUpgrade(request, socket, head, (ws) => {
      wssInventory.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

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
  "https://createyourstyle.me",
  "https://www.createyourstyle.me", // www is a different origin than apex
  process.env.FRONTEND_URL,  // Production frontend URL (set in .env)
  process.env.WEBHOOK_BASE_URL, // ngrok tunnel URL
].filter(Boolean); // Remove undefined values

// Regex patterns for dynamic origins (Vercel preview deployments)
const allowedOriginPatterns = [
  /\.vercel\.app$/,           // All Vercel deployments
  /\.onrender\.com$/,         // Render deployments
];

app.use(
  cors((req, callback) => {
    const origin = req.header("Origin");
    const requestLabel = `${req.method} ${req.originalUrl}`;

    // Allow requests with no origin (mobile apps, server-to-server, Postman)
    if (!origin) {
      console.log(`[CORS] Allowed (no origin): ${requestLabel}`);
      return callback(null, { origin: true, credentials: true });
    }

    // Check exact matches
    if (allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
      console.log(
        `[CORS] Allowed (exact match): ${origin} -> ${requestLabel}`,
      );
      return callback(null, { origin: true, credentials: true });
    }

    // Check pattern matches (for Vercel preview deployments, etc.)
    if (allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
      console.log(
        `[CORS] Allowed (pattern match): ${origin} -> ${requestLabel}`,
      );
      return callback(null, { origin: true, credentials: true });
    }

    console.warn(`[CORS] Blocked: ${origin} -> ${requestLabel}`);
    return callback(new Error("Not allowed by CORS"), {
      origin: false,
      credentials: true,
    });
  }),
);
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

// Lightweight ping — does not touch MongoDB (good for plain load balancers)
app.get("/api/ping", (req, res) => {
  res.json({ ok: true });
});

// Health check with MongoDB ping — use this for uptime monitors (UptimeRobot, etc.) so the
// Render service and DB connection stay exercised instead of going cold / timing out.
app.get("/api/health", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        ok: false,
        db: "disconnected",
        readyState: mongoose.connection.readyState,
      });
    }
    await mongoose.connection.db.admin().command({ ping: 1 });
    res.json({ ok: true, db: "up" });
  } catch (error) {
    res.status(503).json({
      ok: false,
      db: "error",
      message: error.message,
    });
  }
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
  console.log(`  Database: single remote URI (MONGODB_URI); local MongoDB removed`);
  console.log(`  Sync cron: ${process.env.ENABLE_SYNC !== 'false' ? 'Yes (no-op; no local secondary)' : 'No'}`);
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
