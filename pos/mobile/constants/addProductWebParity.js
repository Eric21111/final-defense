/**
 * Mirrors web Inventory.jsx / AddProductModal.jsx for add-product parity.
 */

export const VARIANT_ONLY_KEY = "__VARIANT_ONLY__";

export const COMMON_COLORS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Navy Blue",
  "Green",
  "Yellow",
  "Orange",
  "Pink",
  "Purple",
  "Brown",
  "Gray",
  "Beige",
  "Cream",
  "Maroon",
  "Olive",
  "Teal",
  "Coral",
  "Lavender",
  "Mint",
  "Gold",
  "Silver",
  "Rose Gold",
  "Custom",
];

export const categoryStructure = {
  "Apparel - Men": ["Tops", "Bottoms", "Outerwear"],
  "Apparel - Women": ["Tops", "Bottoms", "Dresses", "Outerwear"],
  "Apparel - Kids": ["Tops", "Bottoms", "Dresses", "Outerwear"],
  "Apparel - Unisex": ["Tops", "Bottoms", "Dresses", "Outerwear"],
  Foods: ["Beverages", "Snacks", "Meals", "Desserts", "Ingredients", "Other"],
  Makeup: ["Face", "Eyes", "Lips", "Nails", "SkinCare", "Others"],
  Accessories: ["Jewelry", "Bags", "Head Wear", "Glasses/Sunglasses", "Others"],
  Shoes: ["Sneakers", "Boots", "Sandals", "Others"],
  Others: ["Others"],
};

export const parentCategories = Object.keys(categoryStructure);

const legacyParentCategories = [
  "Apparel",
  "Shoes",
  "Foods",
  "Accessories",
  "Makeup",
  "Head Wear",
];

export const UNIT_OPTIONS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "g", label: "Grams (g)" },
  { value: "L", label: "Liters (L)" },
  { value: "ml", label: "Milliliters (ml)" },
  { value: "mg", label: "Milligrams (mg)" },
  { value: "packs", label: "Packs" },
  { value: "boxes", label: "Boxes" },
];

/** Same codes as web `Inventory.jsx` categoryCodeMap */
export const categoryCodeMap = {
  Tops: "TOP",
  Bottoms: "BOT",
  Dresses: "DRS",
  Makeup: "MUA",
  Accessories: "MUA",
  Shoes: "SHO",
  "Head Wear": "HDW",
  Foods: "FOD",
};

export const sumAllVariantQuantities = (variantQuantities) => {
  if (!variantQuantities || typeof variantQuantities !== "object") return 0;
  return Object.values(variantQuantities).reduce((sum, perSize) => {
    if (!perSize || typeof perSize !== "object") return sum;
    return (
      sum +
      Object.values(perSize).reduce((s, q) => s + (parseInt(q, 10) || 0), 0)
    );
  }, 0);
};

export function getCustomSubCategories(apiCategoryNames = []) {
  const allKnownDefaultSubs = new Set(Object.values(categoryStructure).flat());
  return apiCategoryNames.filter(
    (name) =>
      name &&
      name !== "All" &&
      name !== "Others" &&
      !parentCategories.includes(name) &&
      !allKnownDefaultSubs.has(name) &&
      !legacyParentCategories.includes(name)
  );
}

export function getSubcategories(parentCat, customSubs, currentSub, currentParent) {
  const defaultSubs = categoryStructure[parentCat] || [];
  const subs = [...defaultSubs, ...customSubs];
  if (
    currentSub &&
    currentSub !== "__add_new__" &&
    !subs.includes(currentSub) &&
    currentParent === parentCat
  ) {
    subs.push(currentSub);
  }
  return [...new Set(subs)];
}

export function getSizeOptions(parentCategory, subCategory, customSizes = []) {
  const category = parentCategory;
  const sub = subCategory || "";
  let sizes = [];
  const parentHasSizes = categoryStructure[category] !== undefined;
  if (!parentHasSizes) {
    sizes = ["Free Size"];
  } else if (category === "Foods") {
    switch (sub) {
      case "Beverages":
        sizes = ["Small", "Medium", "Large", "Extra Large", "Free Size"];
        break;
      case "Snacks":
        sizes = [
          "Small Pack",
          "Medium Pack",
          "Large Pack",
          "Family Pack",
          "Free Size",
        ];
        break;
      case "Meals":
        sizes = ["Regular", "Large", "Family Size", "Free Size"];
        break;
      case "Desserts":
        sizes = ["Small", "Medium", "Large", "Free Size"];
        break;
      case "Ingredients":
        sizes = ["100g", "250g", "500g", "1kg", "Free Size"];
        break;
      default:
        sizes = ["Small", "Medium", "Large", "Free Size"];
    }
  } else if (["Tops", "Bottoms", "Dresses", "Outerwear"].includes(sub)) {
    sizes = ["XS", "S", "M", "L", "XL", "XXL", "Free Size"];
  } else if (category === "Shoes") {
    sizes = ["5", "6", "7", "8", "9", "10", "11", "12"];
  } else if (category === "Accessories" || category === "Makeup") {
    sizes = ["Free Size"];
  } else {
    sizes = ["Free Size"];
  }
  return [...sizes, ...customSizes];
}

export function getColorCode(variant) {
  if (!variant || String(variant).trim() === "") {
    return "XXX";
  }
  const cleaned = String(variant).replace(/\s+/g, "").toUpperCase();
  return cleaned.substring(0, 3).padEnd(3, "X");
}

export function generateSKU(category, subCategory, variant) {
  const base = subCategory || category;
  const categoryCode = categoryCodeMap[base] || "OTH";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomCode = "";
  for (let i = 0; i < 6; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (!variant || String(variant).trim() === "") {
    return `${categoryCode}-${randomCode}`;
  }
  const colorCode = getColorCode(variant);
  return `${categoryCode}-${randomCode}-${colorCode}`;
}

/**
 * Infer parent + sub from API product (handles legacy flat `category`).
 */
export function inferParentSubFromProduct(item) {
  const sub = item?.subCategory || "";
  const cat = item?.category || "";
  if (cat && sub) {
    return { category: cat, subCategory: sub };
  }
  if (!cat && !sub) {
    return { category: "", subCategory: "" };
  }
  const only = cat || sub;
  for (const parent of parentCategories) {
    const subs = categoryStructure[parent] || [];
    if (subs.includes(only)) {
      return { category: parent, subCategory: only };
    }
    if (parent === only && subs.length) {
      return { category: parent, subCategory: subs[0] };
    }
  }
  return { category: "Others", subCategory: only || "Others" };
}

/**
 * Build POST payload like web `confirmAddProduct` (create path only).
 * @param {object} np — same shape as web `newProduct` after modal merge
 * @param {boolean} editingProduct
 */
export function buildCreateProductPayload(np, editingProduct = false) {
  const variantQtySum = sumAllVariantQuantities(np.variantQuantities);
  const sizeQtySum = Object.values(np.sizeQuantities || {}).reduce(
    (sum, qty) => sum + (parseInt(qty, 10) || 0),
    0
  );
  const totalStock =
    variantQtySum > 0
      ? variantQtySum
      : (np.selectedSizes || []).length > 0
        ? sizeQtySum
        : parseInt(np.currentStock, 10) || 0;

  let defaultItemPrice = parseFloat(np.itemPrice) || 0;

  if (
    !defaultItemPrice &&
    np.differentPricesPerSize &&
    np.selectedSizes?.length > 0
  ) {
    const firstSizePrice = np.sizePrices?.[np.selectedSizes[0]];
    if (firstSizePrice) {
      defaultItemPrice = parseFloat(firstSizePrice) || 0;
    }
  }

  if (!defaultItemPrice && np.variantPrices) {
    const firstSizeWithVariantPrices = Object.keys(np.variantPrices)[0];
    if (firstSizeWithVariantPrices) {
      const firstVariantPrice = Object.values(
        np.variantPrices[firstSizeWithVariantPrices]
      )[0];
      if (firstVariantPrice) {
        defaultItemPrice = parseFloat(firstVariantPrice) || 0;
      }
    }
  }

  const payload = {
    ...np,
    itemPrice: defaultItemPrice,
    costPrice: parseFloat(np.costPrice) || 0,
    reorderNumber: parseInt(np.reorderNumber, 10) || 0,
    expirationDate: np.expirationDate || null,
    displayInTerminal: np.displayInTerminal !== false,
  };

  if (!editingProduct) {
    payload.currentStock = totalStock;
    const selected = np.selectedSizes || [];
    const sizesList =
      selected.length > 0
        ? selected
        : Object.keys(np.variantQuantities || {}).length > 0
          ? Object.keys(np.variantQuantities)
          : [];

    if (sizesList.length > 0) {
      const hasVariantQuantities =
        np.variantQuantities &&
        Object.keys(np.variantQuantities).length > 0;

      const hasVariantPrices =
        np.variantPrices && Object.keys(np.variantPrices).length > 0;

      if (np.differentPricesPerSize && Object.keys(np.sizePrices || {}).length > 0) {
        const sizesWithPrices = {};
        sizesList.forEach((size) => {
          const sizePrice = parseFloat(np.sizePrices[size]);

          let variantValue = "";
          if (np.differentVariantsPerSize) {
            if (np.multipleVariantsPerSize?.[size]) {
              variantValue = np.sizeMultiVariants?.[size] || [];
            } else {
              variantValue = np.sizeVariants?.[size] || "";
            }
          } else {
            variantValue = np.variant || "";
          }

          if (hasVariantQuantities && np.variantQuantities[size]) {
            sizesWithPrices[size] = {
              quantity: Object.values(np.variantQuantities[size]).reduce(
                (sum, q) => sum + (parseInt(q, 10) || 0),
                0
              ),
              price: sizePrice || defaultItemPrice || 0,
              variant: variantValue,
              variants: np.variantQuantities[size],
            };

            if (hasVariantPrices && np.variantPrices[size]) {
              sizesWithPrices[size].variantPrices = np.variantPrices[size];
            }
          } else {
            sizesWithPrices[size] = {
              quantity: np.sizeQuantities[size] || 0,
              price: sizePrice || defaultItemPrice || 0,
              variant: variantValue,
            };
          }
        });
        payload.sizes = sizesWithPrices;
      } else {
        const sizesObject = {};

        const hasVariantCostPrices =
          np.variantCostPrices &&
          Object.keys(np.variantCostPrices).length > 0;

        sizesList.forEach((size) => {
          let variantValue = "";
          if (np.differentVariantsPerSize) {
            if (np.multipleVariantsPerSize?.[size]) {
              variantValue = np.sizeMultiVariants?.[size] || [];
            } else {
              variantValue = np.sizeVariants?.[size] || "";
            }
          } else {
            variantValue = np.variant || "";
          }

          const sizePrice = parseFloat(np.sizePrices?.[size]) || 0;
          const sizeCostPrice = parseFloat(np.sizeCostPrices?.[size]) || 0;

          if (hasVariantQuantities && np.variantQuantities[size]) {
            sizesObject[size] = {
              quantity: Object.values(np.variantQuantities[size]).reduce(
                (sum, q) => sum + (parseInt(q, 10) || 0),
                0
              ),
              variant: variantValue,
              variants: np.variantQuantities[size],
            };

            if (hasVariantPrices && np.variantPrices[size]) {
              sizesObject[size].variantPrices = np.variantPrices[size];

              if (hasVariantCostPrices && np.variantCostPrices[size]) {
                sizesObject[size].variantCostPrices = np.variantCostPrices[size];
              }
            } else {
              if (sizePrice > 0) {
                sizesObject[size].price = sizePrice;
              }
              if (sizeCostPrice > 0) {
                sizesObject[size].costPrice = sizeCostPrice;
              }
            }
          } else {
            sizesObject[size] = {
              quantity: np.sizeQuantities[size] || 0,
              variant: variantValue,
            };

            if (sizePrice > 0) {
              sizesObject[size].price = sizePrice;
            }
            if (sizeCostPrice > 0) {
              sizesObject[size].costPrice = sizeCostPrice;
            }
          }
        });
        payload.sizes = sizesObject;
      }
    } else {
      payload.sizes = null;
    }
  }

  return payload;
}

/**
 * PUT payload aligned with web `confirmEditProduct`.
 */
export function buildEditProductPayload(newProduct, editingProduct) {
  const displayInTerminalValue =
    newProduct.displayInTerminal === false ? false : true;

  const payload = {
    ...newProduct,
    itemPrice: parseFloat(newProduct.itemPrice) || 0,
    costPrice: parseFloat(newProduct.costPrice) || 0,
    reorderNumber: parseInt(newProduct.reorderNumber, 10) || 0,
    expirationDate: newProduct.expirationDate || null,
    displayInTerminal: displayInTerminalValue,
  };

  delete payload.currentStock;
  delete payload.selectedSizes;
  delete payload.sizeQuantities;
  delete payload.sizePrices;
  delete payload.differentPricesPerSize;

  if (
    payload.editableSizePrices &&
    Object.keys(payload.editableSizePrices).length > 0
  ) {
    const updatedSizes = { ...editingProduct.sizes };

    Object.entries(payload.editableSizePrices).forEach(([size, sizeData]) => {
      if (updatedSizes[size]) {
        if (sizeData.hasVariants && sizeData.variants) {
          const currentSizeData = updatedSizes[size];
          const currentVariants = currentSizeData.variants || {};
          const currentVariantPrices = currentSizeData.variantPrices || {};
          const currentVariantCostPrices =
            currentSizeData.variantCostPrices || {};

          Object.entries(sizeData.variants).forEach(([variant, variantData]) => {
            const newPrice = parseFloat(variantData.price) || 0;
            const newCostPrice = parseFloat(variantData.costPrice) || 0;

            if (currentVariants[variant] !== undefined) {
              if (typeof currentVariants[variant] === "number") {
                currentVariantPrices[variant] = newPrice;
                currentVariantCostPrices[variant] = newCostPrice;
              } else if (typeof currentVariants[variant] === "object") {
                currentVariants[variant] = {
                  ...currentVariants[variant],
                  price: newPrice,
                  costPrice: newCostPrice,
                };
              }
            }
          });

          updatedSizes[size] = {
            ...currentSizeData,
            variants: currentVariants,
            variantPrices:
              Object.keys(currentVariantPrices).length > 0
                ? currentVariantPrices
                : currentSizeData.variantPrices,
            variantCostPrices:
              Object.keys(currentVariantCostPrices).length > 0
                ? currentVariantCostPrices
                : currentSizeData.variantCostPrices,
          };
        } else {
          updatedSizes[size] = {
            ...updatedSizes[size],
            price: parseFloat(sizeData.price) || 0,
            costPrice: parseFloat(sizeData.costPrice) || 0,
          };
        }
      }
    });

    payload.sizes = updatedSizes;
    delete payload.editableSizePrices;
  } else {
    delete payload.sizes;
  }

  return payload;
}

export function needsConfirmModal(np) {
  const hasAnyVariantPricing = np.selectedSizes?.some(
    (size) => np.differentPricesPerVariant?.[size]
  );
  const hasVariantPrices =
    np.variantPrices &&
    Object.keys(np.variantPrices).length > 0 &&
    Object.values(np.variantPrices).some(
      (sizeVariants) =>
        sizeVariants &&
        Object.values(sizeVariants).some((price) => parseFloat(price) > 0)
    );
  const hasVariantQuantities =
    np.variantQuantities &&
    Object.keys(np.variantQuantities).length > 0 &&
    Object.values(np.variantQuantities).some(
      (sizeVariants) =>
        sizeVariants &&
        typeof sizeVariants === "object" &&
        Object.values(sizeVariants).some((qty) => parseInt(qty, 10) > 0)
    );
  return !!(hasAnyVariantPricing || hasVariantPrices || hasVariantQuantities);
}
