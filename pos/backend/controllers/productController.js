const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit);
    let skip = 0;

    // Build projection: always exclude heavy fields (stockHistory, itemImage)
    // We send images via a separate lazy-load endpoint for performance
    const projection = "-stockHistory -itemImage";

    let query = Product.find({}, projection).sort({ dateAdded: -1 });

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

exports.getProductImage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).select("itemImage").lean();

    if (!product || !product.itemImage) {
      return res.status(404).send("Image not found");
    }

    // Extract base64 data and content type
    const matches = product.itemImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).send("Invalid image format");
    }

    const contentType = matches[1];
    const base64Data = matches[2];

    const buffer = Buffer.from(base64Data, 'base64');

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(buffer);
  } catch (error) {
    res.status(500).send("Server error");
  }
};

exports.createProduct = async (req, res) => {
  try {
    const productData = { ...req.body };

    if (!productData.sizes && productData.selectedSizes) {
      if (productData.selectedSizes.length > 0 && productData.sizeQuantities) {
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

              const totalQty = Object.values(variants).reduce((sum, v) => sum + (v.quantity || 0), 0);
              productData.sizes[size] = {
                quantity: totalQty,
                variants: variants,
              };
            } else {
              productData.sizes[size] = productData.sizeQuantities[size] || 0;
            }
          }
        });
      }
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
      if (updateData.selectedSizes.length > 0 && updateData.sizeQuantities) {
        // Construct sizes object
        updateData.sizes = {};
        updateData.selectedSizes.forEach((size) => {
          let sizeData = updateData.sizeQuantities[size];

          // If we have specific prices or variants, use object structure
          if (
            updateData.differentPricesPerSize ||
            updateData.differentVariantsPerSize
          ) {
            sizeData = {
              quantity: updateData.sizeQuantities[size],
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
    const { items, performedByName, performedById, type, reason } = req.body;

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

      // Handle products with sizes
      if (product.sizes && item.size) {
        const sizeKey = findSizeKey(product.sizes, item.size);

        if (!sizeKey) {
          if (isStockIn) {
            const hasPriceStructure = Object.values(product.sizes).some(
              (s) =>
                typeof s === "object" && s !== null && s.price !== undefined,
            );
            if (hasPriceStructure) {
              product.sizes[item.size] = {
                quantity: item.quantity,
                price: item.price || product.itemPrice || 0,
              };
            } else {
              product.sizes[item.size] = item.quantity;
            }
            product.markModified("sizes");
          } else {
            throw new Error(
              `Size ${item.size} not found for product ${product.itemName}`,
            );
          }
        } else {
          // Get current size data (handle both Map and object types)
          const currentSizeData = product.sizes.get
            ? product.sizes.get(sizeKey)
            : product.sizes[sizeKey];
          const currentQuantity = getSizeQuantity(currentSizeData);
          const currentPrice = getSizePrice(currentSizeData);

          // Check if this size has variants and a variant is specified
          if (item.variant && typeof currentSizeData === "object" && currentSizeData !== null && currentSizeData.variants) {
            // Handle variant-specific stock
            const variantData = currentSizeData.variants[item.variant];

            // Get current variant quantity (handles both number and object formats)
            let currentVariantQty = 0;
            if (typeof variantData === "number") {
              currentVariantQty = variantData;
            } else if (typeof variantData === "object" && variantData !== null) {
              currentVariantQty = variantData.quantity || 0;
            }

            if (isStockOut && currentVariantQty < item.quantity) {
              throw new Error(
                `Insufficient stock for ${product.itemName} (${item.size}, ${item.variant}). Available: ${currentVariantQty}, Requested: ${item.quantity}`,
              );
            }

            const newVariantQty = isStockIn
              ? currentVariantQty + item.quantity
              : Math.max(0, currentVariantQty - item.quantity);

            // Update variant quantity while preserving format
            if (typeof variantData === "object" && variantData !== null) {
              currentSizeData.variants[item.variant] = {
                ...variantData,
                quantity: newVariantQty,
              };
            } else {
              currentSizeData.variants[item.variant] = newVariantQty;
            }

            // Recalculate size total quantity from all variants
            let sizeTotal = 0;
            for (const [varKey, varValue] of Object.entries(currentSizeData.variants)) {
              if (typeof varValue === "number") {
                sizeTotal += varValue;
              } else if (typeof varValue === "object" && varValue !== null) {
                sizeTotal += varValue.quantity || 0;
              }
            }
            currentSizeData.quantity = sizeTotal;

            // Explicitly reassign the updated size data back to product.sizes (handle both Map and object types)
            if (product.sizes.set) {
              product.sizes.set(sizeKey, currentSizeData);
            } else {
              product.sizes[sizeKey] = currentSizeData;
            }
            product.markModified("sizes");
          } else {
            // No variants, update size quantity directly
            if (isStockOut && currentQuantity < item.quantity) {
              throw new Error(
                `Insufficient stock for ${product.itemName} (${item.size}). Available: ${currentQuantity}, Requested: ${item.quantity}`,
              );
            }

            const newQuantity = isStockIn
              ? (currentQuantity || 0) + item.quantity
              : Math.max(0, currentQuantity - item.quantity);

            // Update size data (handle both Map and object types)
            const updatedSizeData = (
              currentPrice !== null ||
              (typeof currentSizeData === "object" && currentSizeData !== null)
            ) ? {
              ...currentSizeData,
              quantity: newQuantity,
              price:
                currentPrice !== null
                  ? currentPrice
                  : item.price || product.itemPrice || 0,
            } : newQuantity;

            if (product.sizes.set) {
              product.sizes.set(sizeKey, updatedSizeData);
            } else {
              product.sizes[sizeKey] = updatedSizeData;
            }
            product.markModified("sizes");
          }
        }

        // Recalculate total stock from all sizes
        let totalStock = 0;
        for (const [key, value] of Object.entries(product.sizes)) {
          totalStock += getSizeQuantity(value);
        }
        product.currentStock = totalStock;
      } else {
        // Handle products without sizes
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
        notes: item.size ? `Size: ${item.size}` : "",
        sizeQuantities: item.size ? { [item.size]: item.quantity } : null,
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
