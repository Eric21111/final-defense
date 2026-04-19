/**
 * Cart lines often carry base64 `itemImage` (100KB+ each). Sending that on checkout
 * dominates request time and server JSON parse. Keep only short http(s) URLs.
 */
export function lightweightItemImageForApi(img) {
  const s = typeof img === "string" ? img.trim() : "";
  if (!s) return "";
  const head = s.slice(0, 8).toLowerCase();
  if (head.startsWith("http://") || head.startsWith("https://")) {
    return s.length > 2048 ? "" : s;
  }
  return "";
}
