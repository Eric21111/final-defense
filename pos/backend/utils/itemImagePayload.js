/**
 * Drop base64/huge image strings from persisted checkout payloads (same issue as frontend).
 */
function sanitizeItemImageForStorage(value) {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  const head = s.slice(0, 8).toLowerCase();
  if (head.startsWith("http://") || head.startsWith("https://")) {
    return s.length > 2048 ? "" : s;
  }
  return "";
}

module.exports = { sanitizeItemImageForStorage };
