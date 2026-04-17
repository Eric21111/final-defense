const mongoose = require("mongoose");
const Product = require("../models/Product");

const toObjectId = (id) => {
  if (!id) return null;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return new mongoose.Types.ObjectId(id);
    }
    return null;
  } catch (e) {
    return null;
  }
};

const safeNum = (v, fallback = 0) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const findSizeKey = (sizes, size = "") => {
  if (!sizes || typeof sizes !== "object") return null;
  const keys =
    sizes instanceof Map ? Array.from(sizes.keys()) : Object.keys(sizes);
  const normalized = String(size || "").toLowerCase();
  return (
    keys.find((key) => String(key).toLowerCase() === normalized) || null
  );
};

const findVariantKey = (variants, name) => {
  if (!name || typeof variants !== "object" || variants === null) {
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(variants, name)) {
    return name;
  }
  const target = String(name).trim().toLowerCase();
  return (
    Object.keys(variants).find(
      (k) => String(k).trim().toLowerCase() === target,
    ) || null
  );
};

const getSizeQuantity = (sizeData) => {
  if (
    typeof sizeData === "object" &&
    sizeData !== null &&
    sizeData.quantity !== undefined
  ) {
    return sizeData.quantity;
  }
  return typeof sizeData === "number" ? sizeData : 0;
};

const getVariantQty = (variantData) => {
  if (typeof variantData === "number") return variantData;
  if (typeof variantData === "object" && variantData !== null) {
    return safeNum(variantData.quantity, 0);
  }
  return 0;
};

function aggregateSaleItems(items) {
  const map = new Map();
  for (const item of items) {
    const pid = toObjectId(item._id || item.productId);
    if (!pid) continue;
    const qty = Math.max(0, safeNum(item.quantity, 1));
    if (qty <= 0) continue;
    const size = String(item.selectedSize || item.size || "").trim();
    const variant = String(item.variant || item.selectedVariation || "").trim();
    const key = `${String(pid)}|${size}|${variant}`;
    const prev = map.get(key) || {
      productId: pid,
      qty: 0,
      itemName: item.itemName || "Item",
      size,
      variant,
    };
    prev.qty += qty;
    prev.itemName = item.itemName || prev.itemName;
    map.set(key, prev);
  }
  return Array.from(map.values());
}

/**
 * Throws if any line cannot be fulfilled from current inventory (matches update-stock rules).
 */
async function assertSaleStockAvailable(rawItems) {
  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Items are required");
  }

  const aggregated = aggregateSaleItems(rawItems);
  if (aggregated.length === 0) {
    throw new Error("No valid items to sell");
  }

  const byProduct = new Map();
  for (const agg of aggregated) {
    const idStr = String(agg.productId);
    if (!byProduct.has(idStr)) {
      byProduct.set(idStr, []);
    }
    byProduct.get(idStr).push(agg);
  }

  for (const [, aggs] of byProduct) {
    const product = await Product.findById(aggs[0].productId);
    if (!product) {
      throw new Error(`Product not found: ${aggs[0].itemName}`);
    }

    const sizeKeys =
      product.sizes instanceof Map
        ? Array.from(product.sizes.keys())
        : Object.keys(product.sizes || {});
    const hasSizes = sizeKeys.length > 0;

    if (!hasSizes) {
      const totalReq = aggs.reduce((s, a) => s + a.qty, 0);
      const avail = safeNum(product.currentStock, 0);
      if (avail < totalReq) {
        throw new Error(
          `Insufficient stock for ${product.itemName}. Available: ${avail}, Requested: ${totalReq}`,
        );
      }
      continue;
    }

    for (const agg of aggs) {
      if (!agg.size) {
        throw new Error(`Size is required for "${product.itemName}"`);
      }

      const sizeKey = findSizeKey(product.sizes, agg.size);
      if (!sizeKey) {
        throw new Error(
          `Size "${agg.size}" not found for ${product.itemName}`,
        );
      }

      const currentSizeData = product.sizes.get
        ? product.sizes.get(sizeKey)
        : product.sizes[sizeKey];

      const currentQuantity = getSizeQuantity(currentSizeData);
      const hasVariantBuckets =
        typeof currentSizeData === "object" &&
        currentSizeData !== null &&
        currentSizeData.variants &&
        typeof currentSizeData.variants === "object" &&
        Object.keys(currentSizeData.variants).length > 0;

      let variantForStock = agg.variant || null;
      if (hasVariantBuckets && !variantForStock) {
        const vKeys = Object.keys(currentSizeData.variants);
        if (vKeys.length === 1) variantForStock = vKeys[0];
      }
      if (hasVariantBuckets && !variantForStock) {
        throw new Error(
          `Variant is required for ${product.itemName} (size ${sizeKey}).`,
        );
      }

      if (hasVariantBuckets && variantForStock) {
        const variantKey = findVariantKey(
          currentSizeData.variants,
          variantForStock,
        );
        if (!variantKey) {
          throw new Error(
            `Variant "${variantForStock}" not found for ${product.itemName} (size ${sizeKey}).`,
          );
        }
        const variantData = currentSizeData.variants[variantKey];
        const currentVariantQty = getVariantQty(variantData);
        if (currentVariantQty < agg.qty) {
          throw new Error(
            `Insufficient stock for ${product.itemName} (${sizeKey}, ${variantForStock}). Available: ${currentVariantQty}, Requested: ${agg.qty}`,
          );
        }
      } else if (currentQuantity < agg.qty) {
        throw new Error(
          `Insufficient stock for ${product.itemName} (${agg.size}). Available: ${currentQuantity}, Requested: ${agg.qty}`,
        );
      }
    }
  }
}

module.exports = {
  assertSaleStockAvailable,
};
