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

/** One line for printed receipts: "Variant | Size" (omits empty parts and placeholder size key). */
export function formatReceiptVariantSizeLine(item) {
  const rawSize = item?.selectedSize || item?.size || "";
  const size =
    rawSize === VARIANT_ONLY_SIZE_KEY ? "" : String(rawSize).trim();
  const variant = String(item?.variant || item?.selectedVariation || "").trim();
  const parts = [];
  if (variant) parts.push(variant);
  if (size) parts.push(size);
  return parts.join(" | ");
}

/** Line subtotal from item prices × qty (pre-discount). Excludes fully returned lines (qty is not zeroed in DB). */
export function lineSubtotalFromItems(transaction) {
  if (!transaction?.items?.length) return 0;
  return transaction.items.reduce((sum, item) => {
    if (item.returnStatus === "Returned") return sum;
    return (
      sum + (item.price || item.itemPrice || 0) * (item.quantity || 1)
    );
  }, 0);
}

/**
 * Original subtotal from ALL items at their original quantities (before any returns).
 * For partially returned items the original qty = current qty + returnedQuantity.
 * For fully returned items the original qty = returnedQuantity (or quantity as stored).
 * This value should NEVER change after a return — it represents what was originally purchased.
 */
export function originalSubtotalFromItems(transaction) {
  if (!transaction?.items?.length) return 0;
  return transaction.items.reduce((sum, item) => {
    const unitPrice = item.price || item.itemPrice || 0;
    let originalQty = item.quantity || 1;
    // For partial returns the DB reduces quantity, so add back returnedQuantity
    if (item.returnStatus === "Partially Returned" && item.returnedQuantity) {
      originalQty = (item.quantity || 0) + (item.returnedQuantity || 0);
    }
    // For full returns the quantity stays but is marked Returned
    if (item.returnStatus === "Returned" && item.returnedQuantity) {
      originalQty = item.returnedQuantity;
    }
    return sum + unitPrice * originalQty;
  }, 0);
}

/**
 * Total returned amount. Uses returnTransactions if available, otherwise computes from item statuses.
 */
export function totalReturnedFromTransaction(transaction) {
  const fromRecords = transaction?.returnTransactions?.reduce((sum, r) => sum + (r.totalAmount || 0), 0) || 0;
  if (fromRecords > 0) return fromRecords;

  if (!transaction?.items?.length) return 0;
  return transaction.items.reduce((sum, item) => {
    const isFullyReturned = item.returnStatus === "Returned";
    // For full returns, if returnedQuantity isn't set, it means the whole quantity was returned.
    const returnedQty = item.returnedQuantity || (isFullyReturned ? (item.quantity || 1) : 0);
    const unitPrice = item.price || item.itemPrice || 0;
    return sum + (returnedQty * unitPrice);
  }, 0);
}

/**
 * Discount to show: stored on txn, or inferred from subtotal − total for legacy rows.
 */
export function resolveTransactionDiscount(transaction, lineSubtotal, { skipInference = false } = {}) {
  let discount = Number(transaction?.discount ?? transaction?.discountAmount ?? 0) || 0;
  
  if (discount === 0 && !skipInference) {
    const status = transaction?.status || "";
    if (status !== "Returned" && status !== "Partially Returned") {
      const hasLinkedReturns =
        (transaction?.returnTransactions?.length || 0) > 0 ||
        (transaction?.returnTransactionIds?.length || 0) > 0;
      if (!hasLinkedReturns) {
        const total = Number(transaction?.totalAmount);
        if (Number.isFinite(total) && lineSubtotal > total + 0.005) {
          discount = Math.round((lineSubtotal - total) * 100) / 100;
        }
      }
    }
  }

  // Scale the discount proportionally:
  // If an item is returned, the discount applied to that item is revoked,
  // making the final returned total accurate without entering negatives.
  if (discount > 0 && lineSubtotal > 0) {
    const totalReturned = totalReturnedFromTransaction(transaction);
    const proportionKept = Math.max(0, lineSubtotal - Math.abs(totalReturned)) / lineSubtotal;
    discount = discount * proportionKept;
  }
  
  return discount;
}
