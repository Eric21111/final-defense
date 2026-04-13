const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");
const Archive = require("../models/Archive");
const SalesTransaction = require("../models/SalesTransaction");

const ARCHIVE_CATEGORY_ENUM = new Set([
  "Tops",
  "Bottoms",
  "Dresses",
  "Makeup",
  "Accessories",
  "Essentials",
  "Shoes",
  "Head Wear",
  "Foods",
  "Others",
]);

const mapProductCategoryToArchiveCategory = (category) => {
  const c = String(category || "").trim();
  if (ARCHIVE_CATEGORY_ENUM.has(c)) return c;
  return "Others";
};

exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit);
    let skip = 0;

    // Build projection: always exclude stockHistory, optionally exclude heavy fields
    // ?fields=minimal excludes itemImage (base64 strings can be 50-500KB per product)
    const isMinimal = req.query.fields === "minimal";
    const projection = isMinimal ? "-stockHistory -itemImage" : "-stockHistory";

    let query = Product.find({ isArchived: { $ne: true } }, projection).sort({ dateAdded: -1 });

    // Only apply pagination if limit is specified (Mobile uses limit=20, Web sends none)
    if (limit) {
      skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    // Run find and count in parallel instead of sequentially
    const [products, totalCount] = await Promise.all([
      query.lean(),
      Product.countDocuments(),
    ]);

    const formattedProducts = products.map((product) => {
      // Recalculate currentStock from sizes if sizes exist
      let currentStock = product.currentStock || 0;
      if (
        product.sizes &&
        typeof product.sizes === "object" &&
        Object.keys(product.sizes).length > 0
      ) {
        currentStock = Object.values(product.sizes).reduce((sum, sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined
          ) {
            return sum + (sizeData.quantity || 0);
          }
          return sum + (typeof sizeData === "number" ? sizeData : 0);
        }, 0);
      }

      return {
        ...product,
        _id: product._id.toString(),
        variant: product.variant || "",
        size: product.size || "",
        brandName: product.brandName || "",
        costPrice: product.costPrice || 0,
        currentStock,
        reorderNumber: product.reorderNumber || 0,
        supplierName: product.supplierName || "",
        supplierContact: product.supplierContact || "",
        displayInTerminal:
          product.displayInTerminal !== undefined
            ? product.displayInTerminal
            : true,
        terminalStatus:
          product.displayInTerminal !== false ? "shown" : "not shown",
      };
    });

    res.json({
      success: true,
      count: formattedProducts.length,
      total: totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
      currentPage: page,
      data: formattedProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Recalculate currentStock from sizes if sizes exist
    let currentStock = product.currentStock || 0;
    if (
      product.sizes &&
      typeof product.sizes === "object" &&
      Object.keys(product.sizes).length > 0
    ) {
      currentStock = Object.values(product.sizes).reduce((sum, sizeData) => {
        if (
          typeof sizeData === "object" &&
          sizeData !== null &&
          sizeData.quantity !== undefined
        ) {
          return sum + (sizeData.quantity || 0);
        }
        return sum + (typeof sizeData === "number" ? sizeData : 0);
      }, 0);
    }

    const productResponse = {
      ...product,
      currentStock,
      displayInTerminal:
        product.displayInTerminal !== undefined
          ? product.displayInTerminal
          : true,
      terminalStatus:
        product.displayInTerminal !== false ? "shown" : "not shown",
    };

    res.json({
      success: true,
      data: productResponse,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
      error: error.message,
    });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    if (!productData.sizes && productData.selectedSizes) {
      if (productData.selectedSizes.length > 0) {
        // Construct sizes object
        productData.sizes = {};
        productData.selectedSizes.forEach((size) => {
          // Check if this size has variant pricing
          const hasDifferentPricesPerVariant = productData.differentPricesPerVariant?.[size];

          if (hasDifferentPricesPerVariant && productData.variantQuantities?.[size]) {
            // Variant-level pricing: store each variant with its own qty/price/cost
            const variants = {};
            const variantQtys = productData.variantQuantities[size] || {};
            const variantPrices = productData.variantPrices?.[size] || {};
            const variantCostPrices = productData.variantCostPrices?.[size] || {};

            Object.keys(variantQtys).forEach(variantName => {
              const qty = parseInt(variantQtys[variantName]) || 0;
              if (qty > 0 || variantPrices[variantName] > 0) {
                variants[variantName] = {
                  quantity: qty,
                  price: parseFloat(variantPrices[variantName]) || productData.itemPrice || 0,
                  costPrice: parseFloat(variantCostPrices[variantName]) || productData.costPrice || 0,
                };
              }
            });

            // Calculate total quantity for this size
            const totalQty = Object.values(variants).reduce((sum, v) => sum + (v.quantity || 0), 0);

            productData.sizes[size] = {
              quantity: totalQty,
              variants: variants,
              hasDifferentPricesPerVariant: true,
            };
          } else if (productData.differentPricesPerSize || productData.differentVariantsPerSize) {
            // Size-level pricing
            const sizeData = {
              quantity: productData.sizeQuantities[size] || 0,
              price: productData.differentPricesPerSize
                ? productData.sizePrices?.[size] || productData.itemPrice
                : productData.itemPrice,
              variant: productData.differentVariantsPerSize
                ? productData.sizeVariants?.[size] || productData.variant
                : productData.variant,
            };

            // Add cost price if available
            if (productData.differentPricesPerSize && productData.sizeCostPrices?.[size]) {
              sizeData.costPrice = productData.sizeCostPrices[size];
            }

            // Also handle variant quantities if present (without variant-specific pricing)
            if (productData.variantQuantities?.[size]) {
              const variants = {};
              const variantQtys = productData.variantQuantities[size];
              Object.keys(variantQtys).forEach(variantName => {
                const qty = parseInt(variantQtys[variantName]) || 0;
                if (qty > 0) {
                  variants[variantName] = {
                    quantity: qty,
                    price: sizeData.price,
                    costPrice: sizeData.costPrice || productData.costPrice || 0,
                  };
                }
              });
              if (Object.keys(variants).length > 0) {
                sizeData.variants = variants;
                sizeData.quantity = Object.values(variants).reduce((sum, v) => sum + (v.quantity || 0), 0);
              }
            }

            productData.sizes[size] = sizeData;
          } else {
            // Simple quantity only, but check for variant quantities
            if (productData.variantQuantities?.[size]) {
              const variants = {};
              const variantQtys = productData.variantQuantities[size];
              Object.keys(variantQtys).forEach(variantName => {
                const qty = parseInt(variantQtys[variantName]) || 0;
                if (qty > 0) {
                  variants[variantName] = {
                    quantity: qty,
                    price: productData.itemPrice || 0,
                    costPrice: productData.costPrice || 0,
                  };
                }
              });

              const totalQtySimple = Object.values(variants).reduce(
                (sum, v) => sum + (v.quantity || 0),
                0,
              );

              productData.sizes[size] = {
                quantity: totalQtySimple,
                variants: variants,
              };
            } else {
              productData.sizes[size] = productData.sizeQuantities?.[size] || 0;
            }
          }
        });
      }
    }

    // Opening stock = first FIFO batch when qty was set at create (otherwise first batch comes from stock-in)
    if (productData.sizes && typeof productData.sizes === "object") {
      const dr = productData.dateReceived;
      const openingTs =
        dr && String(dr).trim()
          ? new Date(
              `${String(dr).slice(0, 10)}T12:00:00`,
            ).toISOString()
          : new Date().toISOString();
      const openingExp = productData.expirationDate
        ? String(productData.expirationDate).slice(0, 10)
        : "";
      const attachOpeningBatches = (sizes) => {
        for (const sizeKey of Object.keys(sizes)) {
          const sd = sizes[sizeKey];
          if (typeof sd === "number") continue;
          if (!sd || typeof sd !== "object") continue;
          if (sd.variants && typeof sd.variants === "object") {
            for (const vk of Object.keys(sd.variants)) {
              const v = sd.variants[vk];
              if (typeof v !== "object" || v === null) continue;
              const q = parseInt(v.quantity, 10) || 0;
              if (q <= 0) continue;
              if (Array.isArray(v.batches) && v.batches.length > 0) continue;
              sd.variants[vk] = {
                ...v,
                batches: [
                  {
                    qty: q,
                    price: parseFloat(v.price) || 0,
                    costPrice: parseFloat(v.costPrice) || 0,
                    createdAt: openingTs,
                    ...(openingExp ? { expirationDate: openingExp } : {}),
                  },
                ],
              };
            }
          } else if (sd.quantity !== undefined && !sd.variants) {
            const q = parseInt(sd.quantity, 10) || 0;
            if (
              q > 0 &&
              (!Array.isArray(sd.batches) || sd.batches.length === 0)
            ) {
              sizes[sizeKey] = {
                ...sd,
                batches: [
                  {
                    qty: q,
                    price: parseFloat(sd.price) || 0,
                    costPrice: parseFloat(sd.costPrice) || 0,
                    createdAt: openingTs,
                    ...(openingExp ? { expirationDate: openingExp } : {}),
                  },
                ],
              };
            }
          }
        }
      };
      attachOpeningBatches(productData.sizes);
    }

    // Clean up temporary fields
    delete productData.selectedSizes;
    delete productData.sizeQuantities;
    delete productData.sizePrices;
    delete productData.sizeCostPrices;
    delete productData.sizeVariants;
    delete productData.differentPricesPerSize;
    delete productData.differentVariantsPerSize;
    delete productData.differentPricesPerVariant;
    delete productData.variantQuantities;
    delete productData.variantPrices;
    delete productData.variantCostPrices;
    delete productData.sizeMultiVariants;
    delete productData.multipleVariantsPerSize;
    delete productData.dateReceived;

    if (!productData.dateAdded) {
      productData.dateAdded = Date.now();
    }

    // Auto-generate unique SKU if not provided
    if (!productData.sku) {
      const category = productData.category || "Foods";
      const variant = productData.variant || "";
      const categoryCode = category.substring(0, 3).toUpperCase();
      const variantCode = variant
        ? `-${variant.substring(0, 3).toUpperCase()}`
        : "";

      // Generate random alphanumeric string (6 characters)
      const generateRandomCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      // Keep generating until we find a unique SKU
      let attempts = 0;
      let uniqueSku = "";
      while (attempts < 10) {
        const randomCode = generateRandomCode();
        uniqueSku = `${categoryCode}-${randomCode}${variantCode}`;
        const existing = await Product.findOne({ sku: uniqueSku });
        if (!existing) break;
        attempts++;
      }

      productData.sku = uniqueSku;
    }

    const product = await Product.create(productData);

    const productResponse = {
      ...product.toObject(),
      displayInTerminal:
        product.displayInTerminal !== undefined
          ? product.displayInTerminal
          : true,
      terminalStatus:
        product.displayInTerminal !== false ? "shown" : "not shown",
    };

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: productResponse,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product with this SKU already exists",
      });
    }

    res.status(400).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

// Helper function to log stock movements
const logStockMovement = async (
  product,
  stockBefore,
  stockAfter,
  type,
  reason,
  handledBy,
  handledById,
  sizeQuantities = null,
) => {
  try {
    const quantity = Math.abs(stockAfter - stockBefore);
    if (quantity === 0) return;

    await StockMovement.create({
      productId: product._id,
      sku: product.sku,
      itemName: product.itemName,
      itemImage: product.itemImage || "",
      category: product.category,
      brandName: product.brandName || "",
      type: type || (stockAfter > stockBefore ? "Stock-In" : "Stock-Out"),
      quantity,
      stockBefore,
      stockAfter,
      reason: reason || "Other",
      handledBy: handledBy || "System",
      handledById: handledById || "",
      notes: "",
      sizeQuantities: sizeQuantities || null,
    });
  } catch (error) {
    console.error("Error logging stock movement:", error);
  }
};

// Helper function to check if product has zero stock
const hasZeroStock = (productData) => {
  if (
    productData.sizes &&
    typeof productData.sizes === "object" &&
    Object.keys(productData.sizes).length > 0
  ) {
    return Object.values(productData.sizes).every((sizeData) => {
      if (
        typeof sizeData === "object" &&
        sizeData !== null &&
        sizeData.quantity !== undefined
      ) {
        return (sizeData.quantity || 0) === 0;
      }
      return (typeof sizeData === "number" ? sizeData : 0) === 0;
    });
  }
  return (productData.currentStock || 0) === 0;
};

// ==========================
// Stock In/Out (Batch FIFO)
// ==========================
const nowIso = () => new Date().toISOString();
const safeNum = (v, fallback = 0) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const toSizeObject = (sizeData, fallbackPrice, fallbackCostPrice) => {
  if (typeof sizeData === "object" && sizeData !== null) {
    const qty = safeNum(sizeData.quantity, 0);
    return {
      ...sizeData,
      quantity: qty,
      price: safeNum(sizeData.price, safeNum(fallbackPrice, 0)),
      costPrice: safeNum(sizeData.costPrice, safeNum(fallbackCostPrice, 0)),
    };
  }
  const qty = typeof sizeData === "number" ? sizeData : 0;
  return {
    quantity: qty,
    price: safeNum(fallbackPrice, 0),
    costPrice: safeNum(fallbackCostPrice, 0),
  };
};

const ensureBatches = (obj, fallbackPrice, fallbackCostPrice) => {
  const next = typeof obj === "object" && obj !== null ? { ...obj } : { ...toSizeObject(obj, fallbackPrice, fallbackCostPrice) };
  // Lot/exp live only on each batch entry — never on the variant/size root (avoids leaking one batch's meta to siblings)
  delete next.expirationDate;
  delete next.batchCode;
  next.quantity = safeNum(next.quantity, 0);
  next.price = safeNum(next.price, safeNum(fallbackPrice, 0));
  next.costPrice = safeNum(next.costPrice, safeNum(fallbackCostPrice, 0));
  if (!Array.isArray(next.batches) || next.batches.length === 0) {
    next.batches = next.quantity > 0 ? [{ qty: next.quantity, price: next.price, costPrice: next.costPrice, createdAt: nowIso() }] : [];
  }
  return next;
};

const addBatch = (batches, addQty, price, costPrice, meta = {}) => {
  const qty = safeNum(addQty, 0);
  const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
  if (qty > 0) {
    next.push({
      qty,
      price: safeNum(price, 0),
      costPrice: safeNum(costPrice, 0),
      createdAt: nowIso(),
      ...(meta.batchCode ? { batchCode: String(meta.batchCode) } : {}),
      ...(meta.expirationDate ? { expirationDate: String(meta.expirationDate) } : {}),
    });
  }
  return next;
};

/** Add qty to an existing FIFO batch slot; preserves lot code and pricing on that entry. */
const addToExistingBatchSlot = (batches, slotIndex, addQty, meta, padPrice, padCost) => {
  const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
  const S = Math.floor(safeNum(slotIndex, -1));
  const q = safeNum(addQty, 0);
  if (S < 0 || q <= 0) return next;
  while (next.length <= S) {
    next.push({
      qty: 0,
      price: safeNum(padPrice, 0),
      costPrice: safeNum(padCost, 0),
      createdAt: nowIso(),
      batchSlotPadding: true,
    });
  }
  const entry = { ...next[S] };
  entry.qty = safeNum(entry.qty, 0) + q;
  if (entry.batchSlotPadding && entry.qty > 0) {
    delete entry.batchSlotPadding;
  }
  if (meta.expirationDate) {
    entry.expirationDate = String(meta.expirationDate);
  }
  next[S] = entry;
  return next;
};

/** Zero-qty placeholders so every variant/size in the same stock-in gets the new lot at the same batch index */
const padBatchesToLengthBeforeAdd = (batches, targetLenBeforePush, price, costPrice) => {
  const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
  while (next.length < targetLenBeforePush) {
    next.push({
      qty: 0,
      price: safeNum(price, 0),
      costPrice: safeNum(costPrice, 0),
      createdAt: nowIso(),
      batchSlotPadding: true,
    });
  }
  return next;
};

const consumeBatches = (batches, removeQty) => {
  let remaining = safeNum(removeQty, 0);
  const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
  for (let i = 0; i < next.length && remaining > 0; i++) {
    const take = Math.min(safeNum(next[i].qty, 0), remaining);
    next[i].qty = safeNum(next[i].qty, 0) - take;
    remaining -= take;
  }
  return next;
};

const sumBatchesQty = (batches) =>
  (Array.isArray(batches) ? batches : []).reduce((sum, b) => sum + safeNum(b.qty, 0), 0);

exports.stockInProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const stockData = req.body || {};

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const stockBefore = product.currentStock || 0;
    const handledBy = stockData.handledBy || "System";
    const handledById = stockData.handledById || "";
    const reason = stockData.reason || "Restock";
    const batchMeta = {
      batchCode: stockData.batchCode ? String(stockData.batchCode).trim() : "",
      expirationDate: stockData.expirationDate ? String(stockData.expirationDate) : "",
    };
    const rawTargetSlot = stockData.targetBatchSlotIndex;
    const parsedTargetSlot = Number.isFinite(Number(rawTargetSlot))
      ? Math.floor(Number(rawTargetSlot))
      : -1;
    const shouldAddToExistingSlot = parsedTargetSlot >= 0;

    // Stock-in from inventory always appends a new FIFO batch (never merge into a prior slot).

    if (!product.sizes || typeof product.sizes !== "object" || Object.keys(product.sizes).length === 0) {
      // No sizes case: keep behavior same as before
      const qty = safeNum(stockData.quantity, 0);
      if (qty <= 0) {
        return res.status(400).json({ success: false, message: "Invalid quantity" });
      }
      const hadZeroStockBefore = hasZeroStock(product.toObject());
      const hasZeroStockNow = hasZeroStock({ ...product.toObject(), currentStock: stockBefore + qty });

      const updatePayload = {
        $set: {
          currentStock: stockBefore + qty,
          lastUpdated: Date.now()
        }
      };

      if (hasZeroStockNow && stockData.displayInTerminal === undefined) {
        updatePayload.$set.displayInTerminal = false;
      } else if (!hasZeroStockNow && hadZeroStockBefore && stockData.displayInTerminal === undefined) {
        updatePayload.$set.displayInTerminal = true;
      }

      const updatedProduct = await Product.findByIdAndUpdate(productId, updatePayload, { new: true, runValidators: true });

      await logStockMovement(updatedProduct, stockBefore, updatedProduct.currentStock, "Stock-In", reason, handledBy, handledById, null);

      return res.json({ success: true, message: "Stock added successfully", data: updatedProduct.toObject() });
    }

    const updatedSizes = { ...(product.sizes || {}) };
    const selectedSizes = Array.isArray(stockData.selectedSizes) ? stockData.selectedSizes : [];
    if (selectedSizes.length === 0) {
      return res.status(400).json({ success: false, message: "No sizes selected" });
    }

    const hasVariants = !!(stockData.hasVariants && stockData.variantQuantities);

    const sizeQuantitiesAdded = {};

    if (hasVariants) {
      let globalMaxBatchLenBeforeAdd = 0;
      if (!shouldAddToExistingSlot) {
        selectedSizes.forEach((size) => {
          const currentSizeData = ensureBatches(
            toSizeObject(updatedSizes[size] || {}, product.itemPrice || 0, product.costPrice || 0),
            product.itemPrice || 0,
            product.costPrice || 0,
          );
          const currentVariants =
            currentSizeData.variants && typeof currentSizeData.variants === "object" ? currentSizeData.variants : {};
          const addVariantQtys = stockData.variantQuantities?.[size] || {};
          Object.entries(addVariantQtys).forEach(([variant, addQty]) => {
            if (safeNum(addQty, 0) <= 0) return;
            const fallbackExistingPrice =
              safeNum(currentSizeData.variantPrices?.[variant], safeNum(currentSizeData.price, product.itemPrice || 0));
            const fallbackExistingCost =
              safeNum(currentSizeData.variantCostPrices?.[variant], safeNum(currentSizeData.costPrice, product.costPrice || 0));
            const normalized = ensureBatches(currentVariants[variant] || {}, fallbackExistingPrice, fallbackExistingCost);
            globalMaxBatchLenBeforeAdd = Math.max(globalMaxBatchLenBeforeAdd, normalized.batches.length);
          });
        });
      }

      selectedSizes.forEach((size) => {
        const currentSizeData = ensureBatches(
          toSizeObject(updatedSizes[size] || {}, product.itemPrice || 0, product.costPrice || 0),
          product.itemPrice || 0,
          product.costPrice || 0,
        );

        const currentVariants =
          currentSizeData.variants && typeof currentSizeData.variants === "object" ? currentSizeData.variants : {};

        const addVariantQtys = stockData.variantQuantities?.[size] || {};
        const newVariants = { ...currentVariants };

        Object.entries(addVariantQtys).forEach(([variant, addQty]) => {
          const qty = safeNum(addQty, 0);
          if (qty <= 0) return;

          const fallbackExistingPrice =
            safeNum(currentSizeData.variantPrices?.[variant], safeNum(currentSizeData.price, product.itemPrice || 0));
          const fallbackExistingCost =
            safeNum(currentSizeData.variantCostPrices?.[variant], safeNum(currentSizeData.costPrice, product.costPrice || 0));

          const normalizedVariant = ensureBatches(newVariants[variant] || {}, fallbackExistingPrice, fallbackExistingCost);

          // Determine incoming prices for new batch
          let incomingPrice = fallbackExistingPrice;
          let incomingCost = fallbackExistingCost;

          if (stockData.diffPricesPerVariant?.[size] && stockData.stockVariantPrices?.[size]?.[variant]) {
            incomingPrice = safeNum(stockData.stockVariantPrices[size][variant].price, incomingPrice);
            incomingCost = safeNum(stockData.stockVariantPrices[size][variant].costPrice, incomingCost);
          } else if (stockData.newVariantPrices?.[variant]) {
            incomingPrice = safeNum(stockData.newVariantPrices[variant].price, incomingPrice);
            incomingCost = safeNum(stockData.newVariantPrices[variant].costPrice, incomingCost);
          } else if (stockData.newSizePrices?.[size]) {
            incomingPrice = safeNum(stockData.newSizePrices[size].price, incomingPrice);
            incomingCost = safeNum(stockData.newSizePrices[size].costPrice, incomingCost);
          }

          let nextBatches;
          if (shouldAddToExistingSlot) {
            nextBatches = addToExistingBatchSlot(
              normalizedVariant.batches,
              parsedTargetSlot,
              qty,
              batchMeta,
              incomingPrice,
              incomingCost,
            );
          } else {
            const padLen = globalMaxBatchLenBeforeAdd;
            const alignedBatches = padBatchesToLengthBeforeAdd(
              normalizedVariant.batches,
              padLen,
              incomingPrice,
              incomingCost,
            );
            nextBatches = addBatch(
              alignedBatches,
              qty,
              incomingPrice,
              incomingCost,
              batchMeta,
            );
          }
          newVariants[variant] = {
            ...normalizedVariant,
            batches: nextBatches,
            quantity: sumBatchesQty(nextBatches),
            price: incomingPrice,
            costPrice: incomingCost,
          };
        });

        const newTotalQty = Object.values(newVariants).reduce((sum, v) => {
          if (typeof v === "number") return sum + safeNum(v, 0);
          if (typeof v === "object" && v !== null) return sum + safeNum(v.quantity, 0);
          return sum;
        }, 0);

        updatedSizes[size] = {
          ...currentSizeData,
          variants: newVariants,
          quantity: newTotalQty,
          hasDifferentPricesPerVariant: stockData.diffPricesPerVariant?.[size] ? true : currentSizeData.hasDifferentPricesPerVariant,
        };

        // Apply price/costPrice for new sizes if provided
        if (stockData.newSizePrices?.[size]) {
          updatedSizes[size].price = safeNum(stockData.newSizePrices[size].price, product.itemPrice || 0);
          updatedSizes[size].costPrice = safeNum(stockData.newSizePrices[size].costPrice, product.costPrice || 0);
        }

        const totalForSize = Object.values(addVariantQtys).reduce((s, q) => s + safeNum(q, 0), 0);
        if (totalForSize > 0) sizeQuantitiesAdded[size] = totalForSize;
      });
    } else {
      let maxBatchLenBeforeAddNoVar = 0;
      selectedSizes.forEach((size) => {
        const addQty = safeNum(stockData.sizes?.[size], 0);
        if (addQty <= 0) return;
        const cur = ensureBatches(
          toSizeObject(updatedSizes[size] || {}, product.itemPrice || 0, product.costPrice || 0),
          product.itemPrice || 0,
          product.costPrice || 0,
        );
        maxBatchLenBeforeAddNoVar = Math.max(maxBatchLenBeforeAddNoVar, cur.batches.length);
      });

      selectedSizes.forEach((size) => {
        const addQty = safeNum(stockData.sizes?.[size], 0);
        if (addQty <= 0) return;

        const currentSizeData = ensureBatches(
          toSizeObject(updatedSizes[size] || {}, product.itemPrice || 0, product.costPrice || 0),
          product.itemPrice || 0,
          product.costPrice || 0,
        );

        let incomingPrice = currentSizeData.price;
        let incomingCost = currentSizeData.costPrice;
        if (stockData.newSizePrices?.[size]) {
          incomingPrice = safeNum(stockData.newSizePrices[size].price, incomingPrice);
          incomingCost = safeNum(stockData.newSizePrices[size].costPrice, incomingCost);
        }

        let nextBatches;
        if (shouldAddToExistingSlot) {
          nextBatches = addToExistingBatchSlot(
            currentSizeData.batches,
            parsedTargetSlot,
            addQty,
            batchMeta,
            incomingPrice,
            incomingCost,
          );
        } else {
          const padLenNoVar = maxBatchLenBeforeAddNoVar;
          const alignedBatches = padBatchesToLengthBeforeAdd(
            currentSizeData.batches,
            padLenNoVar,
            incomingPrice,
            incomingCost,
          );
          nextBatches = addBatch(
            alignedBatches,
            addQty,
            incomingPrice,
            incomingCost,
            batchMeta,
          );
        }
        const nextQty = sumBatchesQty(nextBatches);
        updatedSizes[size] = {
          ...currentSizeData,
          batches: nextBatches,
          quantity: nextQty,
          price: incomingPrice,
          costPrice: incomingCost,
        };

        sizeQuantitiesAdded[size] = addQty;
      });
    }

    // Recalculate total stock across sizes
    const totalStock = Object.values(updatedSizes).reduce((sum, sizeData) => {
      if (typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined) {
        return sum + safeNum(sizeData.quantity, 0);
      }
      return sum + (typeof sizeData === "number" ? safeNum(sizeData, 0) : 0);
    }, 0);

    const hadZeroStockBefore = hasZeroStock(product.toObject());
    const hasZeroStockNow = hasZeroStock({ ...product.toObject(), sizes: updatedSizes, currentStock: totalStock });

    const updatePayload = {
      $set: {
        sizes: updatedSizes,
        currentStock: totalStock,
        lastUpdated: Date.now()
      }
    };

    if (hasZeroStockNow && stockData.displayInTerminal === undefined) {
      updatePayload.$set.displayInTerminal = false;
    } else if (!hasZeroStockNow && hadZeroStockBefore && stockData.displayInTerminal === undefined) {
      updatePayload.$set.displayInTerminal = true;
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, updatePayload, { new: true, runValidators: true });

    await logStockMovement(
      updatedProduct,
      stockBefore,
      updatedProduct.currentStock,
      "Stock-In",
      reason,
      handledBy,
      handledById,
      Object.keys(sizeQuantitiesAdded).length > 0 ? sizeQuantitiesAdded : null,
    );

    res.json({ success: true, message: "Stock added successfully", data: updatedProduct.toObject() });
  } catch (error) {
    console.error("Error stock-in:", error);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => console.error("Validation error:", error.errors[key].message));
    }
    res.status(400).json({ success: false, message: "Error stocking in", error: error.message, stack: error.stack });
  }
};

exports.stockOutProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const stockData = req.body || {};

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const stockBefore = product.currentStock || 0;
    const handledBy = stockData.handledBy || "System";
    const handledById = stockData.handledById || "";
    const reason = stockData.reason || "Sold";
    const movementType =
      reason === "Damaged" || reason === "Lost" || reason === "Expired" ? "Pull-Out" : "Stock-Out";

    if (!product.sizes || typeof product.sizes !== "object" || Object.keys(product.sizes).length === 0) {
      const qty = safeNum(stockData.quantity, 0);
      if (qty <= 0) return res.status(400).json({ success: false, message: "Invalid quantity" });
      if (qty > stockBefore) return res.status(400).json({ success: false, message: "Insufficient stock" });

      const hadZeroStockBefore = hasZeroStock(product.toObject());
      const newStock = Math.max(0, stockBefore - qty);
      const hasZeroStockNow = hasZeroStock({ ...product.toObject(), currentStock: newStock });

      const updatePayload = {
        $set: {
          currentStock: newStock,
          lastUpdated: Date.now()
        }
      };

      if (hasZeroStockNow && stockData.displayInTerminal === undefined) {
        updatePayload.$set.displayInTerminal = false;
      } else if (!hasZeroStockNow && hadZeroStockBefore && stockData.displayInTerminal === undefined) {
        updatePayload.$set.displayInTerminal = true;
      }

      const updatedProduct = await Product.findByIdAndUpdate(productId, updatePayload, { new: true, runValidators: true });

      await logStockMovement(updatedProduct, stockBefore, updatedProduct.currentStock, movementType, reason, handledBy, handledById, null);
      return res.json({ success: true, message: "Stock removed successfully", data: updatedProduct.toObject() });
    }

    const updatedSizes = { ...(product.sizes || {}) };
    const selectedSizes = Array.isArray(stockData.selectedSizes) ? stockData.selectedSizes : [];
    if (selectedSizes.length === 0) {
      return res.status(400).json({ success: false, message: "No sizes selected" });
    }

    const hasVariants = !!(stockData.hasVariants && stockData.variantQuantities);
    const sizeQuantitiesRemoved = {};
    let totalQuantityRemoved = 0;

    if (hasVariants) {
      selectedSizes.forEach((size) => {
        const currentSizeData = toSizeObject(updatedSizes[size] || {}, product.itemPrice || 0, product.costPrice || 0);
        const currentVariants =
          currentSizeData.variants && typeof currentSizeData.variants === "object" ? currentSizeData.variants : {};
        const removeVariantQtys = stockData.variantQuantities?.[size] || {};

        const newVariants = { ...currentVariants };
        Object.entries(removeVariantQtys).forEach(([variant, removeQty]) => {
          const qty = safeNum(removeQty, 0);
          if (qty <= 0 || newVariants[variant] === undefined) return;

          const fallbackExistingPrice =
            safeNum(currentSizeData.variantPrices?.[variant], safeNum(currentSizeData.price, product.itemPrice || 0));
          const fallbackExistingCost =
            safeNum(currentSizeData.variantCostPrices?.[variant], safeNum(currentSizeData.costPrice, product.costPrice || 0));

          const normalizedVariant = ensureBatches(newVariants[variant] || {}, fallbackExistingPrice, fallbackExistingCost);
          const nextBatches = consumeBatches(normalizedVariant.batches, qty);
          newVariants[variant] = {
            ...normalizedVariant,
            batches: nextBatches,
            quantity: sumBatchesQty(nextBatches),
          };
        });

        const newTotalQty = Object.values(newVariants).reduce((sum, v) => {
          if (typeof v === "number") return sum + safeNum(v, 0);
          if (typeof v === "object" && v !== null) return sum + safeNum(v.quantity, 0);
          return sum;
        }, 0);

        updatedSizes[size] = {
          ...currentSizeData,
          variants: newVariants,
          quantity: newTotalQty,
        };

        const totalForSize = Object.values(removeVariantQtys).reduce((s, q) => s + safeNum(q, 0), 0);
        if (totalForSize > 0) {
          sizeQuantitiesRemoved[size] = totalForSize;
          totalQuantityRemoved += totalForSize;
        }
      });
    } else {
      selectedSizes.forEach((size) => {
        const removeQty = safeNum(stockData.sizes?.[size], 0);
        if (removeQty <= 0) return;

        const currentSizeData = ensureBatches(
          toSizeObject(updatedSizes[size] || {}, product.itemPrice || 0, product.costPrice || 0),
          product.itemPrice || 0,
          product.costPrice || 0,
        );
        const nextBatches = consumeBatches(currentSizeData.batches, removeQty);
        const newQty = sumBatchesQty(nextBatches);
        updatedSizes[size] = {
          ...currentSizeData,
          batches: nextBatches,
          quantity: newQty,
        };

        sizeQuantitiesRemoved[size] = removeQty;
        totalQuantityRemoved += removeQty;
      });
    }

    const totalStock = Object.values(updatedSizes).reduce((sum, sizeData) => {
      if (typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined) {
        return sum + safeNum(sizeData.quantity, 0);
      }
      return sum + (typeof sizeData === "number" ? safeNum(sizeData, 0) : 0);
    }, 0);

    const hadZeroStockBefore = hasZeroStock(product.toObject());
    const hasZeroStockNow = hasZeroStock({ ...product.toObject(), sizes: updatedSizes, currentStock: totalStock });

    const updatePayload = {
      $set: {
        sizes: updatedSizes,
        currentStock: totalStock,
        lastUpdated: Date.now()
      }
    };

    if (hasZeroStockNow && stockData.displayInTerminal === undefined) {
      updatePayload.$set.displayInTerminal = false;
    } else if (!hasZeroStockNow && stockBefore === 0 && totalStock > 0 && stockData.displayInTerminal === undefined) {
      updatePayload.$set.displayInTerminal = true;
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, updatePayload, { new: true, runValidators: true });

    await logStockMovement(
      updatedProduct,
      stockBefore,
      updatedProduct.currentStock,
      movementType,
      reason,
      handledBy,
      handledById,
      Object.keys(sizeQuantitiesRemoved).length > 0 ? sizeQuantitiesRemoved : null,
    );

    res.json({ success: true, message: "Stock removed successfully", data: updatedProduct.toObject() });
  } catch (error) {
    console.error("Error stock-out:", error);
    res.status(400).json({ success: false, message: "Error stocking out", error: error.message, stack: error.stack });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const updateData = { ...req.body };

    const stockMovementType = updateData.stockMovementType;
    const stockMovementReason = updateData.stockMovementReason;
    const handledBy = updateData.handledBy;
    const handledById = updateData.handledById;
    const stockMovementSizeQuantities = updateData.stockMovementSizeQuantities;

    delete updateData.stockMovementType;
    delete updateData.stockMovementReason;
    delete updateData.handledBy;
    delete updateData.handledById;
    delete updateData.stockMovementSizeQuantities;

    if (!updateData.sizes && updateData.selectedSizes) {
      if (updateData.selectedSizes.length > 0) {
        // Construct sizes object
        updateData.sizes = {};
        updateData.selectedSizes.forEach((size) => {
          let sizeData = updateData.sizeQuantities?.[size] || 0;

          if (
            updateData.differentPricesPerSize ||
            updateData.differentVariantsPerSize
          ) {
            sizeData = {
              quantity: updateData.sizeQuantities?.[size] || 0,
              price: updateData.differentPricesPerSize
                ? updateData.sizePrices?.[size] || updateData.itemPrice
                : updateData.itemPrice,
              variant: updateData.differentVariantsPerSize
                ? updateData.sizeVariants?.[size] || updateData.variant
                : updateData.variant,
            };

            // Add cost price if available
            if (
              updateData.differentPricesPerSize &&
              updateData.sizeCostPrices?.[size]
            ) {
              sizeData.costPrice = updateData.sizeCostPrices[size];
            }
          }

          updateData.sizes[size] = sizeData;
        });
      } else if (updateData.selectedSizes.length === 0) {
        updateData.sizes = null;
      }
    }

    delete updateData.selectedSizes;
    delete updateData.sizeQuantities;
    delete updateData.sizePrices;
    delete updateData.sizeVariants;
    delete updateData.differentPricesPerSize;
    delete updateData.differentVariantsPerSize;
    updateData.lastUpdated = Date.now();

    const productBefore = await Product.findById(productId);
    if (!productBefore) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const stockBefore = productBefore.currentStock;

    // Auto-manage displayInTerminal based on stock levels
    const hadZeroStockBefore = hasZeroStock(productBefore);
    const hasZeroStockNow = hasZeroStock(updateData);

    if (hasZeroStockNow && req.body.displayInTerminal === undefined) {
      // Auto-hide from terminal if stock reaches 0
      updateData.displayInTerminal = false;
    } else if (
      !hasZeroStockNow &&
      hadZeroStockBefore &&
      req.body.displayInTerminal === undefined
    ) {
      // Auto-show in terminal if stock was 0 and now has stock (restock scenario)
      updateData.displayInTerminal = true;
    } else if (updateData.displayInTerminal === undefined) {
      // Keep existing setting
      updateData.displayInTerminal =
        productBefore.displayInTerminal !== undefined
          ? productBefore.displayInTerminal
          : true;
    }

    const product = await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });

    // Log stock movement if stock changed
    const stockAfter = product.currentStock;
    if (
      stockBefore !== stockAfter &&
      stockMovementType &&
      stockMovementReason &&
      handledBy
    ) {
      await logStockMovement(
        product,
        stockBefore,
        stockAfter,
        stockMovementType,
        stockMovementReason,
        handledBy,
        handledById,
        stockMovementSizeQuantities,
      );
    }

    const productResponse = {
      ...product.toObject(),
      displayInTerminal:
        product.displayInTerminal !== undefined
          ? product.displayInTerminal
          : true,
      terminalStatus:
        product.displayInTerminal !== false ? "shown" : "not shown",
    };

    res.json({
      success: true,
      message: "Product updated successfully",
      data: productResponse,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting product",
      error: error.message,
    });
  }
};

exports.archiveProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.isArchived) {
      return res.json({
        success: true,
        message: "Product already archived",
      });
    }

    const qty = Math.max(
      1,
      Number(product.currentStock) >= 0 ? Number(product.currentStock) : 0
    );

    const prevDisplayInTerminal = product.displayInTerminal;
    product.isArchived = true;
    product.displayInTerminal = false;
    product.lastUpdated = Date.now();
    await product.save();

    try {
      await Archive.create({
        productId: product._id,
        itemName: product.itemName,
        sku: product.sku || "N/A",
        variant: product.variant || "",
        selectedSize: product.size || "",
        category: mapProductCategoryToArchiveCategory(product.category),
        brandName: product.brandName || "",
        itemPrice: product.itemPrice ?? 0,
        costPrice: product.costPrice ?? 0,
        quantity: qty,
        itemImage: product.itemImage || "",
        reason: "Other",
        returnReason: "",
        originalTransactionId: null,
        source: "stock-out",
        archivedBy: req.body?.archivedByName || "Inventory",
        archivedById: req.body?.archivedById || "",
        notes: "Product archived from inventory",
      });
    } catch (archiveErr) {
      product.isArchived = false;
      product.displayInTerminal = prevDisplayInTerminal;
      await product.save();
      throw archiveErr;
    }

    res.json({
      success: true,
      message: "Product archived successfully",
    });
  } catch (error) {
    console.error("Error archiving product:", error);
    res.status(500).json({
      success: false,
      message: "Error archiving product",
      error: error.message,
    });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category })
      .sort({ dateAdded: -1 })
      .lean();

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
      error: error.message,
    });
  }
};

// Helper functions for size handling
const findSizeKey = (sizes = {}, size = "") => {
  const normalized = size?.toLowerCase();
  return Object.keys(sizes).find((key) => key?.toLowerCase() === normalized);
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

const getSizeKeys = (sizes) => {
  if (!sizes || typeof sizes !== "object") {
    return [];
  }
  return sizes instanceof Map ? Array.from(sizes.keys()) : Object.keys(sizes);
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

const getSizePrice = (sizeData) => {
  if (
    typeof sizeData === "object" &&
    sizeData !== null &&
    sizeData.price !== undefined
  ) {
    return sizeData.price;
  }
  return null;
};

// Update stock after successful transaction
exports.updateStockAfterTransaction = async (req, res) => {
  try {
    const { items, performedByName, performedById, type, reason, linkTransactionId } =
      req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Invalid items data",
      });
    }

    const isStockIn = type === "Stock-In";
    const isStockOut = type === "Stock-Out" || type === "Pull-Out";
    const movementType = type || "Stock-Out";
    const movementReason = reason || (isStockIn ? "Returned Item" : "Sold");

    // --- Batch helpers (FIFO) ---
    // We store batches as an array (oldest first): [{ qty, price, costPrice, createdAt }]
    // This preserves old price/cost for remaining old stock when prices change later.
    const nowIso = () => new Date().toISOString();
    const safeNum = (v, fallback = 0) => {
      const n = typeof v === "number" ? v : parseFloat(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const ensureBatches = (obj, fallbackPrice, fallbackCostPrice) => {
      const quantity = safeNum(obj?.quantity, safeNum(obj, 0));
      const price = safeNum(obj?.price, safeNum(fallbackPrice, 0));
      const costPrice = safeNum(obj?.costPrice, safeNum(fallbackCostPrice, 0));
      const next = typeof obj === "object" && obj !== null ? { ...obj } : { quantity, price, costPrice };
      delete next.expirationDate;
      delete next.batchCode;
      next.quantity = quantity;
      next.price = price;
      next.costPrice = costPrice;
      if (!Array.isArray(next.batches)) {
        next.batches = quantity > 0 ? [{ qty: quantity, price, costPrice, createdAt: nowIso() }] : [];
      } else if (next.batches.length === 0 && quantity > 0) {
        next.batches = [{ qty: quantity, price, costPrice, createdAt: nowIso() }];
      }
      return next;
    };
    const addBatch = (batches, addQty, price, costPrice, meta = {}) => {
      const qty = safeNum(addQty, 0);
      const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
      if (qty > 0) {
        next.push({
          qty,
          price: safeNum(price, 0),
          costPrice: safeNum(costPrice, 0),
          createdAt: nowIso(),
          ...(meta.batchCode ? { batchCode: String(meta.batchCode) } : {}),
          ...(meta.expirationDate ? { expirationDate: String(meta.expirationDate) } : {}),
        });
      }
      return next;
    };
    const consumeBatches = (batches, removeQty) => {
      let remaining = safeNum(removeQty, 0);
      const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
      for (let i = 0; i < next.length && remaining > 0; i++) {
        const take = Math.min(safeNum(next[i].qty, 0), remaining);
        next[i].qty = safeNum(next[i].qty, 0) - take;
        remaining -= take;
      }
      return next;
    };

    const consumeBatchesWithAllocations = (batches, removeQty) => {
      let remaining = safeNum(removeQty, 0);
      const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
      const allocations = [];
      for (let i = 0; i < next.length && remaining > 0; i++) {
        const avail = safeNum(next[i].qty, 0);
        if (avail <= 0) continue;
        const take = Math.min(avail, remaining);
        if (take <= 0) continue;
        const createdAt = next[i].createdAt || nowIso();
        allocations.push({
          createdAt: String(createdAt),
          qty: take,
          price: safeNum(next[i].price, 0),
          costPrice: safeNum(next[i].costPrice, 0),
        });
        next[i].qty = avail - take;
        remaining -= take;
      }
      return { batches: next, allocations };
    };

    const allocationsForReturnQty = (fullAllocations, returnQty) => {
      let rem = safeNum(returnQty, 0);
      const out = [];
      for (const a of fullAllocations || []) {
        if (rem <= 0) break;
        const q = safeNum(a.qty, 0);
        if (q <= 0) continue;
        const take = Math.min(q, rem);
        out.push({
          createdAt: a.createdAt,
          qty: take,
          price: safeNum(a.price, 0),
          costPrice: safeNum(a.costPrice, 0),
        });
        rem -= take;
      }
      return out;
    };

    const restoreBatchesFromAllocations = (batches, allocations) => {
      const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
      for (const alloc of allocations || []) {
        const q = safeNum(alloc.qty, 0);
        if (q <= 0) continue;
        const target = String(alloc.createdAt || "");
        const idx = next.findIndex((b) => String(b.createdAt || "") === target);
        if (idx >= 0) {
          next[idx].qty = safeNum(next[idx].qty, 0) + q;
        } else {
          next.push({
            qty: q,
            price: safeNum(alloc.price, 0),
            costPrice: safeNum(alloc.costPrice, 0),
            createdAt: alloc.createdAt || nowIso(),
          });
        }
      }
      next.sort((a, b) =>
        String(a.createdAt || "").localeCompare(String(b.createdAt || "")),
      );
      return next;
    };

    /** When allocations are missing, merge return qty into oldest FIFO batch (no new batch row). */
    const restoreReturnQtyToOldestBatches = (batches, addQty, price, costPrice) => {
      const q = safeNum(addQty, 0);
      if (q <= 0) {
        return Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
      }
      const next = Array.isArray(batches) ? batches.map((b) => ({ ...b })) : [];
      if (next.length === 0) {
        return [
          {
            qty: q,
            price: safeNum(price, 0),
            costPrice: safeNum(costPrice, 0),
            createdAt: nowIso(),
          },
        ];
      }
      next[0] = {
        ...next[0],
        qty: safeNum(next[0].qty, 0) + q,
        price: safeNum(price, safeNum(next[0].price, 0)),
        costPrice: safeNum(costPrice, safeNum(next[0].costPrice, 0)),
      };
      return next;
    };

    const persistLineBatchAllocations = async (txId, lineIndex, allocations) => {
      if (!txId || lineIndex == null || lineIndex < 0 || !allocations?.length) {
        return;
      }
      await SalesTransaction.updateOne(
        { _id: txId },
        { $set: { [`items.${lineIndex}.batchAllocations`]: allocations } },
      );
    };

    // Process items sequentially to prevent race conditions when multiple
    // items reference the same product (e.g., same shirt in different sizes)
    const updatedProducts = [];
    for (const item of items) {
      if (!item._id && !item.sku) {
        throw new Error("Item missing both _id and sku fields");
      }

      let product = null;
      if (item._id) {
        product = await Product.findById(item._id);
      }
      if (!product && item.sku) {
        product = await Product.findOne({ sku: item.sku });
      }

      if (!product) {
        throw new Error(
          `Product not found (ID: ${item._id || "N/A"}, SKU: ${item.sku || "N/A"})`,
        );
      }

      const stockBefore = product.currentStock;

      const isReturnStockIn =
        isStockIn &&
        (String(reason || "").includes("Returned") ||
          movementReason === "Returned Item");

      let batchAllocationsForReturn = null;
      if (isReturnStockIn) {
        batchAllocationsForReturn = Array.isArray(item.batchAllocations)
          ? item.batchAllocations
          : null;
        if (
          (!batchAllocationsForReturn || !batchAllocationsForReturn.length) &&
          item.originalTransactionId &&
          item.originalLineIndex != null
        ) {
          const origTx = await SalesTransaction.findById(
            item.originalTransactionId,
          ).lean();
          const line = origTx?.items?.[item.originalLineIndex];
          batchAllocationsForReturn = line?.batchAllocations || null;
        }
        if (batchAllocationsForReturn?.length) {
          batchAllocationsForReturn = allocationsForReturnQty(
            batchAllocationsForReturn,
            item.quantity,
          );
        }
      }

      const sizeKeys = getSizeKeys(product.sizes);
      const hasSizes = sizeKeys.length > 0;
      const rawSize = item.size || item.selectedSize || "";
      let sizeForStock =
        rawSize && String(rawSize).trim() ? String(rawSize).trim() : null;
      const rawVariant = item.variant || item.selectedVariation || "";
      let variantForStock =
        rawVariant && String(rawVariant).trim()
          ? String(rawVariant).trim()
          : null;

      if (hasSizes && !sizeForStock && isStockIn && sizeKeys.length === 1) {
        sizeForStock = sizeKeys[0];
      }

      if (hasSizes && !sizeForStock) {
        throw new Error(
          `Size is required to update stock for "${product.itemName}" (SKU: ${product.sku || "N/A"}).`,
        );
      }

      // Handle products with per-size (and optional per-variant) inventory
      if (hasSizes && sizeForStock) {
        const sizeKey = findSizeKey(product.sizes, sizeForStock);

        if (!sizeKey) {
          if (isStockIn) {
            const sizeVals =
              product.sizes instanceof Map
                ? Array.from(product.sizes.values())
                : Object.values(product.sizes);
            const hasPriceStructure = sizeVals.some(
              (s) =>
                typeof s === "object" && s !== null && s.price !== undefined,
            );
            if (hasPriceStructure) {
              product.sizes[sizeForStock] = {
                quantity: item.quantity,
                price: item.price || product.itemPrice || 0,
              };
            } else {
              product.sizes[sizeForStock] = item.quantity;
            }
            product.markModified("sizes");
          } else {
            throw new Error(
              `Size ${sizeForStock} not found for product ${product.itemName}`,
            );
          }
        } else {
          const currentSizeData = product.sizes.get
            ? product.sizes.get(sizeKey)
            : product.sizes[sizeKey];
          const currentQuantity = getSizeQuantity(currentSizeData);
          const currentPrice = getSizePrice(currentSizeData);

          const hasVariantBuckets =
            typeof currentSizeData === "object" &&
            currentSizeData !== null &&
            currentSizeData.variants &&
            typeof currentSizeData.variants === "object" &&
            Object.keys(currentSizeData.variants).length > 0;

          if (hasVariantBuckets && !variantForStock) {
            const vKeys = Object.keys(currentSizeData.variants);
            if (vKeys.length === 1) {
              variantForStock = vKeys[0];
            }
          }
          if (hasVariantBuckets && !variantForStock) {
            throw new Error(
              `Variant is required to update stock for ${product.itemName} (size ${sizeKey}).`,
            );
          }

          if (
            variantForStock &&
            hasVariantBuckets
          ) {
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

            const fallbackVariantPrice = safeNum(
              currentSizeData.variantPrices?.[variantKey],
              safeNum(
                currentPrice,
                safeNum(item.price, safeNum(product.itemPrice, 0)),
              ),
            );
            const fallbackVariantCostPrice = safeNum(
              currentSizeData.variantCostPrices?.[variantKey],
              safeNum(currentSizeData.costPrice, safeNum(product.costPrice, 0)),
            );

            const normalizedVariant = ensureBatches(
              variantData,
              fallbackVariantPrice,
              fallbackVariantCostPrice,
            );
            const currentVariantQty = safeNum(normalizedVariant.quantity, 0);

            if (isStockOut && currentVariantQty < item.quantity) {
              throw new Error(
                `Insufficient stock for ${product.itemName} (${sizeForStock}, ${variantForStock}). Available: ${currentVariantQty}, Requested: ${item.quantity}`,
              );
            }

            let nextVariantBatches;
            if (isStockIn) {
              if (batchAllocationsForReturn?.length > 0) {
                nextVariantBatches = restoreBatchesFromAllocations(
                  normalizedVariant.batches,
                  batchAllocationsForReturn,
                );
              } else if (isReturnStockIn) {
                nextVariantBatches = restoreReturnQtyToOldestBatches(
                  normalizedVariant.batches,
                  item.quantity,
                  safeNum(
                    item.price,
                    safeNum(fallbackVariantPrice, safeNum(product.itemPrice, 0)),
                  ),
                  safeNum(
                    item.costPrice,
                    safeNum(fallbackVariantCostPrice, safeNum(product.costPrice, 0)),
                  ),
                );
              } else {
                nextVariantBatches = addBatch(
                  normalizedVariant.batches,
                  item.quantity,
                  safeNum(
                    item.price,
                    safeNum(fallbackVariantPrice, safeNum(product.itemPrice, 0)),
                  ),
                  safeNum(
                    item.costPrice,
                    safeNum(fallbackVariantCostPrice, safeNum(product.costPrice, 0)),
                  ),
                  {
                    batchCode: item.batchCode,
                    expirationDate: item.expirationDate,
                  },
                );
              }
            } else {
              const cons = consumeBatchesWithAllocations(
                normalizedVariant.batches,
                item.quantity,
              );
              nextVariantBatches = cons.batches;
              if (
                linkTransactionId != null &&
                item.lineIndex != null &&
                cons.allocations?.length
              ) {
                await persistLineBatchAllocations(
                  linkTransactionId,
                  item.lineIndex,
                  cons.allocations,
                );
              }
            }

            const nextVariantQty = nextVariantBatches.reduce(
              (sum, b) => sum + safeNum(b.qty, 0),
              0,
            );
            currentSizeData.variants[variantKey] = {
              ...normalizedVariant,
              batches: nextVariantBatches,
              quantity: nextVariantQty,
            };

            let sizeTotal = 0;
            for (const [, varValue] of Object.entries(
              currentSizeData.variants,
            )) {
              if (typeof varValue === "number") {
                sizeTotal += varValue;
              } else if (typeof varValue === "object" && varValue !== null) {
                sizeTotal += varValue.quantity || 0;
              }
            }
            currentSizeData.quantity = sizeTotal;

            if (product.sizes.set) {
              product.sizes.set(sizeKey, currentSizeData);
            } else {
              product.sizes[sizeKey] = currentSizeData;
            }
            product.markModified("sizes");
          } else {
            if (isStockOut && currentQuantity < item.quantity) {
              throw new Error(
                `Insufficient stock for ${product.itemName} (${sizeForStock}). Available: ${currentQuantity}, Requested: ${item.quantity}`,
              );
            }

            const normalizedSize = ensureBatches(
              currentSizeData,
              safeNum(
                currentPrice,
                safeNum(item.price, safeNum(product.itemPrice, 0)),
              ),
              safeNum(currentSizeData?.costPrice, safeNum(product.costPrice, 0)),
            );

            let nextSizeBatches;
            if (isStockIn) {
              if (batchAllocationsForReturn?.length > 0) {
                nextSizeBatches = restoreBatchesFromAllocations(
                  normalizedSize.batches,
                  batchAllocationsForReturn,
                );
              } else if (isReturnStockIn) {
                nextSizeBatches = restoreReturnQtyToOldestBatches(
                  normalizedSize.batches,
                  item.quantity,
                  safeNum(
                    item.price,
                    safeNum(normalizedSize.price, safeNum(product.itemPrice, 0)),
                  ),
                  safeNum(
                    item.costPrice,
                    safeNum(
                      normalizedSize.costPrice,
                      safeNum(product.costPrice, 0),
                    ),
                  ),
                );
              } else {
                nextSizeBatches = addBatch(
                  normalizedSize.batches,
                  item.quantity,
                  safeNum(
                    item.price,
                    safeNum(normalizedSize.price, safeNum(product.itemPrice, 0)),
                  ),
                  safeNum(
                    item.costPrice,
                    safeNum(
                      normalizedSize.costPrice,
                      safeNum(product.costPrice, 0),
                    ),
                  ),
                  { batchCode: item.batchCode, expirationDate: item.expirationDate },
                );
              }
            } else {
              const cons = consumeBatchesWithAllocations(
                normalizedSize.batches,
                item.quantity,
              );
              nextSizeBatches = cons.batches;
              if (
                linkTransactionId != null &&
                item.lineIndex != null &&
                cons.allocations?.length
              ) {
                await persistLineBatchAllocations(
                  linkTransactionId,
                  item.lineIndex,
                  cons.allocations,
                );
              }
            }

            const newQuantity = nextSizeBatches.reduce(
              (sum, b) => sum + safeNum(b.qty, 0),
              0,
            );

            const updatedSizeData = {
              ...normalizedSize,
              batches: nextSizeBatches,
              quantity: newQuantity,
              price: safeNum(
                currentPrice,
                safeNum(item.price, safeNum(product.itemPrice, 0)),
              ),
            };

            if (product.sizes.set) {
              product.sizes.set(sizeKey, updatedSizeData);
            } else {
              product.sizes[sizeKey] = updatedSizeData;
            }
            product.markModified("sizes");
          }
        }

        let totalStock = 0;
        const sizeEntries =
          product.sizes instanceof Map
            ? Array.from(product.sizes.entries())
            : Object.entries(product.sizes);
        for (const [, value] of sizeEntries) {
          totalStock += getSizeQuantity(value);
        }
        product.currentStock = totalStock;
      } else {
        if (isStockOut && product.currentStock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.itemName}. Available: ${product.currentStock}, Requested: ${item.quantity}`,
          );
        }

        product.currentStock = isStockIn
          ? product.currentStock + item.quantity
          : Math.max(0, product.currentStock - item.quantity);
      }

      // Auto-manage displayInTerminal based on stock levels
      if (hasZeroStock(product)) {
        // Auto-hide from terminal if stock reaches 0
        product.displayInTerminal = false;
      } else if (stockBefore === 0 && product.currentStock > 0) {
        // Auto-show in terminal if stock was 0 and now has stock (restock scenario)
        product.displayInTerminal = true;
      }

      product.lastUpdated = Date.now();
      await product.save();

      const stockAfter = product.currentStock;

      // Log stock movement
      await StockMovement.create({
        productId: product._id,
        sku: product.sku,
        itemName: product.itemName,
        itemImage: product.itemImage || "",
        category: product.category,
        brandName: product.brandName || "",
        type: movementType,
        quantity: item.quantity,
        stockBefore,
        stockAfter,
        reason: movementReason,
        handledBy: performedByName || "System",
        handledById: performedById || "",
        notes: [
          sizeForStock ? `Size: ${sizeForStock}` : null,
          variantForStock ? `Variant: ${variantForStock}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        sizeQuantities: sizeForStock
          ? { [sizeForStock]: item.quantity }
          : null,
      });

      updatedProducts.push(product);
    }

    res.json({
      success: true,
      message: "Stock updated successfully",
      data: updatedProducts,
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error updating stock",
    });
  }
};

// Toggle display in terminal
exports.toggleDisplayInTerminal = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayInTerminal } = req.body;

    const product = await Product.findByIdAndUpdate(
      id,
      { displayInTerminal, lastUpdated: Date.now() },
      { new: true },
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: `Product ${displayInTerminal ? "shown" : "hidden"} in terminal`,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating product",
      error: error.message,
    });
  }
};

// Search products
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.params;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Optimize: Use Text Search if available (requires index), fallback to regex for partial matches if needed
    // Assuming text index is set up as per model: { itemName: 'text', sku: 'text', brandName: 'text' }

    // First try text search for relevance
    let products = await Product.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } },
    )
      .select("-sizes") // Include itemImage, exclude heavy sizes
      .sort({ score: { $meta: "textScore" } })
      .lean();

    // Fallback: If text search returns nothing (e.g., partial words like "burg" for "burger"), try Regex
    if (products.length === 0) {
      products = await Product.find({
        $or: [
          { itemName: { $regex: query, $options: "i" } },
          { sku: { $regex: query, $options: "i" } },
          { category: { $regex: query, $options: "i" } },
          { brandName: { $regex: query, $options: "i" } },
        ],
      })
        .select("-sizes") // Include itemImage, exclude heavy sizes
        .sort({ dateAdded: -1 })
        .limit(50) // Limit regex results for performance
        .lean();
    }

    res.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      success: false,
      message: "Error searching products",
      error: error.message,
    });
  }
};

exports.getInventoryStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $match: {
          isArchived: { $ne: true },
        },
      },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          inStock: {
            $sum: { $cond: [{ $gt: ["$currentStock", 0] }, 1, 0] },
          },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$currentStock", 0] },
                    { $lte: ["$currentStock", 10] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          outOfStock: {
            $sum: { $cond: [{ $eq: ["$currentStock", 0] }, 1, 0] },
          },
          inventoryValue: {
            $sum: { $multiply: ["$currentStock", "$itemPrice"] },
          },
          totalCostValue: {
            $sum: { $multiply: ["$currentStock", "$costPrice"] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalItems: 0,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      inventoryValue: 0,
      totalCostValue: 0,
    };

    // Calculate margins
    const grossProfit = result.inventoryValue - result.totalCostValue;
    const grossMargin =
      result.inventoryValue > 0
        ? (grossProfit / result.inventoryValue) * 100
        : 0;

    res.json({
      success: true,
      data: {
        ...result,
        grossProfit,
        grossMargin,
      },
    });
  } catch (error) {
    console.error("Error getting inventory stats:", error);
    res.status(500).json({
      success: false,
      message: "Error getting inventory stats",
      error: error.message,
    });
  }
};
