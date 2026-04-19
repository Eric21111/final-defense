/**
 * Broadcasts inventory changes to all connected POS terminal WebSocket clients.
 * Used so other cashiers' browsers refresh product stock without polling.
 */

const inventoryClients = new Set();

function registerInventoryClient(ws) {
  inventoryClients.add(ws);
  ws.on("close", () => inventoryClients.delete(ws));
  ws.on("error", () => inventoryClients.delete(ws));
}

/**
 * @param {object} [payload]
 * @param {string[]} [payload.productIds]
 * @param {string} [payload.source]
 */
function broadcastInventoryChanged(payload = {}) {
  const msg = JSON.stringify({
    type: "INVENTORY_CHANGED",
    at: new Date().toISOString(),
    ...payload,
  });
  for (const ws of inventoryClients) {
    if (ws.readyState === 1) {
      try {
        ws.send(msg);
      } catch {
        inventoryClients.delete(ws);
      }
    }
  }
}

module.exports = {
  registerInventoryClient,
  broadcastInventoryChanged,
};
