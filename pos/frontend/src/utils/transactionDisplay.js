const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

/** Strip placeholder suffix from itemName (e.g. "Name (__VARIANT_ONLY__)"). */
export function cleanItemNameForDisplay(item) {
  let name = String(item?.itemName || "").trim();
  name = name.replace(/\s*\([^)]*__VARIANT_ONLY__[^)]*\)\s*$/i, "").trim();
  return name || "Item";
}

/** Variant + size label for receipts/modals (hides internal size key). */
export function formatItemVariantSizeLabel(item) {
  const size = item?.selectedSize || item?.size || "";
  const variant = String(item?.variant || item?.selectedVariation || "").trim();
  if (size === VARIANT_ONLY_SIZE_KEY) {
    return variant || "";
  }
  if (size && variant) return `${variant} / ${size}`;
  if (size) return size;
  return variant;
}

/** Line subtotal from item prices × qty (pre-discount). */
export function lineSubtotalFromItems(transaction) {
  if (!transaction?.items?.length) return 0;
  return transaction.items.reduce(
    (sum, item) =>
      sum + (item.price || item.itemPrice || 0) * (item.quantity || 1),
    0
  );
}

/**
 * Discount to show: stored on txn, or inferred from subtotal − total for legacy rows.
 */
export function resolveTransactionDiscount(transaction, lineSubtotal, { skipInference = false } = {}) {
  const stored = Number(transaction?.discount ?? transaction?.discountAmount ?? 0) || 0;
  if (stored > 0) return stored;
  if (skipInference) return 0;

  const status = transaction?.status || "";
  if (status === "Returned" || status === "Partially Returned") return 0;

  const hasLinkedReturns =
    (transaction?.returnTransactions?.length || 0) > 0 ||
    (transaction?.returnTransactionIds?.length || 0) > 0;
  if (hasLinkedReturns) return 0;

  const total = Number(transaction?.totalAmount);
  if (!Number.isFinite(total) || lineSubtotal <= total + 0.005) return 0;
  return Math.round((lineSubtotal - total) * 100) / 100;
}
