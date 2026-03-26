import { useEffect, useMemo, useState } from "react";
import { FaMinus, FaPlus, FaTimes } from "react-icons/fa";
import { MdCategory, MdShoppingBag } from "react-icons/md";
import { useTheme } from "../../context/ThemeContext";
import { generateDynamicSku } from "../../utils/skuUtils";

const ProductDetailsModal = ({
  isOpen,
  onClose,
  product,
  productQuantity,
  onDecrement,
  onIncrement,
  onAdd,
  onSetQuantity,
  selectedSize,
  onSelectSize,
  selectedVariant,
  onSelectVariant
}) => {
  const { theme } = useTheme();
  const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

  if (!isOpen || !product) return null;


  const getSizeQuantity = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.quantity !== undefined) {
      return sizeData.quantity;
    }
    return typeof sizeData === "number" ? sizeData : 0;
  };


  const getSizePrice = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.price !== undefined) {
      return sizeData.price;
    }
    return null;
  };


  const getSizeVariants = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.variants &&
      typeof sizeData.variants === "object") {
      return sizeData.variants;
    }
    return null;
  };


  const getSizeVariantPrices = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.variantPrices &&
      typeof sizeData.variantPrices === "object") {
      return sizeData.variantPrices;
    }
    return null;
  };


  const getVariantQty = (variantData) => {
    if (typeof variantData === "number") return variantData;
    if (typeof variantData === "object" && variantData !== null) {
      return variantData.quantity || 0;
    }
    return 0;
  };


  const getSimpleVariants = () => {
    if (product.variant && typeof product.variant === "string") {

      const variants = product.variant.
        split(",").
        map((v) => v.trim()).
        filter((v) => v.length > 0);

      if (variants.length > 1) {
        return variants;
      }
    }
    return [];
  };



  const hasSizeVariants = () => {
    if (product.sizes && typeof product.sizes === "object") {
      return Object.values(product.sizes).some((sizeData) => {
        const variants = getSizeVariants(sizeData);

        return variants && typeof variants === "object" && Object.keys(variants).length > 0;
      });
    }
    return false;
  };



  const hasSimpleVariants = () => {

    if (hasSizeVariants()) return false;
    return getSimpleVariants().length > 0;
  };


  const hasVariants = () => {
    return hasSizeVariants() || hasSimpleVariants();
  };



  const getAllVariants = () => {
    const variantSet = new Set();


    if (product.sizes && typeof product.sizes === "object") {
      Object.values(product.sizes).forEach((sizeData) => {
        const variants = getSizeVariants(sizeData);
        if (variants) {

          Object.keys(variants).forEach((variant) => {
            variantSet.add(variant);
          });
        }
      });
    }


    if (variantSet.size > 0) {
      return Array.from(variantSet);
    }


    const simpleVariants = getSimpleVariants();
    if (simpleVariants.length > 0) {
      simpleVariants.forEach((v) => variantSet.add(v));
    }

    return Array.from(variantSet);
  };



  const getAvailableSizesForVariant = (variant) => {
    if (!product.sizes || typeof product.sizes !== "object") return [];


    if (hasSimpleVariants()) {
      return Object.keys(product.sizes);
    }


    return Object.entries(product.sizes).
      filter(([size, sizeData]) => {
        const variants = getSizeVariants(sizeData);

        return variants && variants[variant] !== undefined;
      }).
      map(([size]) => size);
  };


  const getVariantQuantityInSize = (size, variant) => {

    if (hasSimpleVariants()) {
      if (!product.sizes || !product.sizes[size]) return 0;
      const sizeQty = getSizeQuantity(product.sizes[size]);
      const variantCount = getSimpleVariants().length;

      return sizeQty;
    }

    if (!product.sizes || !product.sizes[size]) return 0;
    const variants = getSizeVariants(product.sizes[size]);
    if (variants && variants[variant] !== undefined) {
      return getVariantQty(variants[variant]);
    }
    return 0;
  };


  const getVariantPriceInSize = (size, variant) => {
    if (!product.sizes || !product.sizes[size]) return null;
    const sizeData = product.sizes[size];
    if (!sizeData || typeof sizeData !== "object") return null;

    // Primary: variant price stored under `variants[variant].price`
    if (sizeData.variants && typeof sizeData.variants === "object") {
      const v = sizeData.variants?.[variant];
      if (v && typeof v === "object" && v.price !== undefined) return v.price;
    }

    // Secondary: legacy mapping under `variantPrices[variant]`
    const variantPrices = getSizeVariantPrices(sizeData);
    if (variantPrices && variantPrices[variant] !== undefined) return variantPrices[variant];

    // Fallback: shared size price
    return getSizePrice(sizeData);
  };

  const toFinitePrice = (v) => {
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  const collectVariantPrices = (variantData) => {
    const out = [];
    if (!variantData || typeof variantData !== "object") return out;
    if (Array.isArray(variantData.batches)) {
      variantData.batches.forEach((b) => {
        const n = toFinitePrice(b?.price);
        if (n !== null) out.push(n);
      });
    }
    const top = toFinitePrice(variantData.price);
    if (top !== null) out.push(top);
    return out;
  };


  const getDisplayPrice = () => {
    if (effectiveSelectedSize && selectedVariant && hasVariants()) {
      const variantPrice = getVariantPriceInSize(effectiveSelectedSize, selectedVariant);
      if (variantPrice !== null) {
        return variantPrice;
      }
    }
    if (
      effectiveSelectedSize &&
      product.sizes &&
      typeof product.sizes === "object" &&
      product.sizes[effectiveSelectedSize]) {
      const sizeData = product.sizes[effectiveSelectedSize];
      const sizePrice = getSizePrice(sizeData);
      if (sizePrice !== null) {
        return sizePrice;
      }
    }
    return product.itemPrice || 0;
  };

  const getAllSellingPrices = () => {
    if (!product?.sizes || typeof product.sizes !== "object") return [];
    const prices = [];
    const keys = Object.keys(product.sizes);

    keys.forEach((sizeKey) => {
      const sizeData = product.sizes[sizeKey];
      if (!sizeData || typeof sizeData !== "object") return;

      // If variantPrices exist, prefer them.
      if (sizeData.variantPrices && typeof sizeData.variantPrices === "object") {
        Object.values(sizeData.variantPrices).forEach((p) => {
          const n = parseFloat(p);
          if (Number.isFinite(n)) prices.push(n);
        });
        return;
      }

      // Fallback: if this size has variants, use its shared size price.
      const variants = getSizeVariants(sizeData);
      if (variants && sizeData.price !== undefined) {
        Object.keys(variants).forEach(() => {
          const n = parseFloat(sizeData.price);
          if (Number.isFinite(n)) prices.push(n);
        });
      }
    });

    return prices;
  };

  const getSellingPricesForVariant = (variant) => {
    if (!product?.sizes || typeof product.sizes !== "object") return [];
    const prices = [];
    const keys = Object.keys(product.sizes);

    keys.forEach((sizeKey) => {
      const sizeData = product.sizes[sizeKey];
      if (!sizeData || typeof sizeData !== "object") return;
      if (sizeData.variantPrices && typeof sizeData.variantPrices === "object" && sizeData.variantPrices[variant] !== undefined) {
        const n = parseFloat(sizeData.variantPrices[variant]);
        if (Number.isFinite(n)) prices.push(n);
        return;
      }

      // Fallback: if variant exists under this size but variantPrices isn't set, use size price.
      const variants = getSizeVariants(sizeData);
      if (variants && variants[variant] !== undefined && sizeData.price !== undefined) {
        const n = parseFloat(sizeData.price);
        if (Number.isFinite(n)) prices.push(n);
      }
    });

    return prices;
  };

  // Pricing helpers (match backend storage):
  // backend puts per-variant price under `sizeData.variants[variant].price`.
  // some older products may still have `variantPrices`.
  const getAllSellingPricesStrict = () => {
    if (!product?.sizes || typeof product.sizes !== "object") return [];
    const prices = [];

    Object.keys(product.sizes).forEach((sizeKey) => {
      const sizeData = product.sizes[sizeKey];
      if (!sizeData || typeof sizeData !== "object") return;

      if (sizeData.variants && typeof sizeData.variants === "object") {
        Object.values(sizeData.variants).forEach((v) => {
          prices.push(...collectVariantPrices(v));
        });
        return;
      }

      if (sizeData.variantPrices && typeof sizeData.variantPrices === "object") {
        Object.values(sizeData.variantPrices).forEach((p) => {
          const n = toFinitePrice(p);
          if (n !== null) prices.push(n);
        });
        return;
      }

      const shared = toFinitePrice(sizeData.price);
      if (shared !== null) prices.push(shared);
    });

    return Array.from(new Set(prices));
  };

  const getSellingPricesForVariantStrict = (variant) => {
    if (!product?.sizes || typeof product.sizes !== "object") return [];
    const prices = [];

    Object.keys(product.sizes).forEach((sizeKey) => {
      const sizeData = product.sizes[sizeKey];
      if (!sizeData || typeof sizeData !== "object") return;

      if (sizeData.variants && typeof sizeData.variants === "object" && sizeData.variants?.[variant]) {
        prices.push(...collectVariantPrices(sizeData.variants[variant]));
        return;
      }

      const vp = sizeData.variantPrices;
      if (vp && typeof vp === "object" && vp[variant] !== undefined) {
        const n = toFinitePrice(vp[variant]);
        if (n !== null) prices.push(n);
        return;
      }
    });

    return Array.from(new Set(prices));
  };

  const formatPriceRangeText = (vals) => {
    const nums = (vals || []).map((v) => parseFloat(v)).filter((n) => Number.isFinite(n));
    if (nums.length === 0) return `PHP 0.00`;
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    if (min === max) return `PHP ${min.toFixed(2)}`;
    return `PHP ${min.toFixed(2)} - ${max.toFixed(2)}`;
  };

  const toQty = (v) => {
    const n = typeof v === "number" ? v : parseInt(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getBatchPriceInfoForUI = () => {
    // Returns FIFO "Batch 1" (slot index 0) price when available.
    // We use this to prevent showing a min-max price range.
    if (!productHasVariants) return null;
    if (!selectedVariant || !effectiveSelectedSize) return null;
    if (!product?.sizes || typeof product.sizes !== "object") return null;

    const sizeData = product.sizes[effectiveSelectedSize];
    if (!sizeData || typeof sizeData !== "object") return null;

    const variantData = sizeData?.variants?.[selectedVariant];
    if (variantData && typeof variantData === "object") {
      const batches = Array.isArray(variantData.batches) ? variantData.batches : [];
      if (batches.length > 0) {
        // Prefer batch slot 1 if it has stock.
        if (batches[0] && toQty(batches[0]?.qty) > 0) {
          const price = toFinitePrice(batches[0]?.price);
          if (price !== null) return { price, batchSlotIndex: 0 };
        }

        // Otherwise, use the first in-stock batch.
        const firstInStockIdx = batches.findIndex((b) => toQty(b?.qty) > 0);
        const idx = firstInStockIdx >= 0 ? firstInStockIdx : 0;
        const price = toFinitePrice(batches[idx]?.price);
        if (price !== null) return { price, batchSlotIndex: idx };
      }

      const top = toFinitePrice(variantData.price);
      if (top !== null) return { price: top, batchSlotIndex: null };
    }

    // Some data shapes may store batches directly on the size.
    if (Array.isArray(sizeData.batches)) {
      const batches = sizeData.batches;
      if (batches.length > 0) {
        if (batches[0] && toQty(batches[0]?.qty) > 0) {
          const price = toFinitePrice(batches[0]?.price);
          if (price !== null) return { price, batchSlotIndex: 0 };
        }
        const firstInStockIdx = batches.findIndex((b) => toQty(b?.qty) > 0);
        const idx = firstInStockIdx >= 0 ? firstInStockIdx : 0;
        const price = toFinitePrice(batches[idx]?.price);
        if (price !== null) return { price, batchSlotIndex: idx };
      }
    }

    return null;
  };

  const getSellingPriceText = () => {
    if (!productHasVariants) return `PHP ${Number(product.itemPrice || 0).toFixed(2)}`;

    const batchInfo = getBatchPriceInfoForUI();
    if (batchInfo?.price !== null && batchInfo?.price !== undefined) {
      return `PHP ${Number(batchInfo.price).toFixed(2)}`;
    }

    if (!selectedVariant) {
      const strictAll = getAllSellingPricesStrict();
      if (strictAll.length > 0) return formatPriceRangeText(strictAll);
      return formatPriceRangeText(getAllSellingPrices());
    }

    const strictForVariant = getSellingPricesForVariantStrict(selectedVariant);
    if (strictForVariant.length > 0) {
      const nums = strictForVariant.filter((v) => Number.isFinite(v));
      if (nums.length > 0) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (min === max) return `PHP ${min.toFixed(2)}`;
        return formatPriceRangeText(nums);
      }
    }

  
    if (effectiveSelectedSize) {
      const exact = getVariantPriceInSize(effectiveSelectedSize, selectedVariant);
      if (exact !== null && exact !== undefined) {
        const n = parseFloat(exact);
        if (Number.isFinite(n)) return `PHP ${n.toFixed(2)}`;
      }
    }

    return formatPriceRangeText(getSellingPricesForVariant(selectedVariant));
  };

  const getDisplaySku = () => {
    if (!hasVariants()) return product.sku || "N/A";
    return generateDynamicSku(product.sku, selectedVariant, effectiveSelectedSize);
  };


  const getTotalStock = () => {
    if (product.sizes && typeof product.sizes === "object") {
      return Object.values(product.sizes).reduce(
        (sum, sizeData) => sum + getSizeQuantity(sizeData),
        0
      );
    }
    return product.currentStock || 0;
  };


  const productHasVariants = hasVariants();
  const allVariants = productHasVariants ? getAllVariants() : [];

  const productImages = Array.isArray(product?.productImages) && product.productImages.length > 0
    ? product.productImages
    : (product?.itemImage ? [product.itemImage] : []);

  const [productImgIdx, setProductImgIdx] = useState(0);
  useEffect(() => {
    setProductImgIdx(0);
  }, [product?._id]);

  const sizeKeys = product?.sizes && typeof product.sizes === "object" ? Object.keys(product.sizes) : [];

  const availableSizesForSelectedVariant = selectedVariant ? getAvailableSizesForVariant(selectedVariant) : [];
  const hasRealV2ForSelectedVariant = availableSizesForSelectedVariant.some(
    (s) => s && s !== VARIANT_ONLY_SIZE_KEY
  );


  const effectiveSelectedSize = selectedSize || (!hasRealV2ForSelectedVariant && selectedVariant ? VARIANT_ONLY_SIZE_KEY : "");

  
  useEffect(() => {
    if (!selectedVariant) return;
    if (!onSelectSize) return;
    if (hasRealV2ForSelectedVariant) return;
    if (selectedSize === VARIANT_ONLY_SIZE_KEY) return;
    if (!sizeKeys.includes(VARIANT_ONLY_SIZE_KEY)) return;
    onSelectSize(VARIANT_ONLY_SIZE_KEY);
  }, [selectedVariant, hasRealV2ForSelectedVariant, selectedSize, onSelectSize, sizeKeys]);

  const availableSizes = productHasVariants
    ? selectedVariant
   
      ? (hasRealV2ForSelectedVariant
        ? availableSizesForSelectedVariant.filter((s) => s !== VARIANT_ONLY_SIZE_KEY)
        : []) 
      : []
    : product.sizes && typeof product.sizes === "object"
      ? Object.keys(product.sizes)
      : [];


  const getAvailableStock = () => {
    if (product.sizes && typeof product.sizes === "object" && effectiveSelectedSize) {

      if (hasSizeVariants() && selectedVariant) {
        return getVariantQuantityInSize(effectiveSelectedSize, selectedVariant);
      }

      return getSizeQuantity(product.sizes[effectiveSelectedSize]);
    }
    return product.currentStock || 0;
  };


  const isAddButtonDisabled = () => {

    if (productHasVariants && !selectedVariant) return true;

    if (
      product.sizes &&
      typeof product.sizes === "object" &&
      Object.keys(product.sizes).length > 0) {
      if (!effectiveSelectedSize) return true;


      let sizeStock;
      if (hasSizeVariants() && selectedVariant) {

        sizeStock = getVariantQuantityInSize(effectiveSelectedSize, selectedVariant);
      } else {

        sizeStock = getSizeQuantity(product.sizes[effectiveSelectedSize]);
      }

      if (sizeStock <= 0 || productQuantity > sizeStock) return true;
    } else {
      const totalStock = product.currentStock || 0;
      if (totalStock <= 0 || productQuantity > totalStock) return true;
    }
    return false;
  };


  const isIncrementDisabled = () => {
    const availableStock = getAvailableStock();
    return productQuantity >= availableStock;
  };


  const isDecrementDisabled = () => {
    return productQuantity <= 1;
  };

  const handleAdd = () => {
    onAdd();

  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-sm bg-black/30"
      onClick={onClose}>

      <div
        className={`rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden mx-4 ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        onClick={(e) => e.stopPropagation()}>

        { }
        <div
          className={`px-6 py-4 flex items-center gap-3 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-100"}`}>

          <div className="w-10 h-10 rounded-lg bg-[#AD7F65] flex items-center justify-center">
            <MdShoppingBag className="text-white text-xl" />
          </div>
          <h2
            className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

            Product Details
          </h2>
          <button
            onClick={onClose}
            className={`ml-auto transition ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}>

            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        { }
        <div className="p-6 overflow-hidden" style={{ maxHeight: "calc(100vh - 240px)" }}>
          <div className="flex gap-6 h-full">
            { }
            <div
              className={`relative w-[420px] h-[420px] rounded-xl overflow-hidden flex-shrink-0 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-100"}`}>

              {productImages.length > 0 && productImages[productImgIdx] ? (
                <>
                  <img
                    src={productImages[productImgIdx]}
                    alt={product.itemName}
                    className="w-full h-full object-cover"
                  />

                  {productImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setProductImgIdx((i) => (i - 1 + productImages.length) % productImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductImgIdx((i) => (i + 1) % productImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center">
                        ›
                      </button>

                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                        {productImages.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setProductImgIdx(idx)}
                            className={`w-2 h-2 rounded-full ${idx === productImgIdx ? "bg-white" : "bg-white/40"}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MdCategory className="text-6xl text-gray-400" />
                </div>
              )}
            </div>

            { }
            <div className="flex-1 overflow-y-auto pr-2 min-h-0">
              <p
                className={`text-sm mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                Product Name
              </p>
              <h3
                className={`text-2xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                {product.itemName}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    Category
                  </p>
                  <p
                    className={`font-medium flex items-center gap-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                    <MdShoppingBag className="text-gray-500" />
                    {product.category || "N/A"}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    SKU/Item Code
                  </p>
                  <p
                    className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                    {getDisplaySku()}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    Price
                  </p>
                  <p className="font-bold text-[#09A046] text-lg flex items-center gap-2">
                    {getSellingPriceText()}
                    {(() => {
                      const info = getBatchPriceInfoForUI();
                      if (!info || info.batchSlotIndex !== 0) return null;
                      return (
                        <span className="relative group inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#09A046]/40">
                          <span className="text-[10px] leading-none font-bold">i</span>
                          <span
                            className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 whitespace-nowrap px-2 py-1 rounded-md text-[11px] shadow ${
                              theme === "dark"
                                ? "bg-gray-900 text-gray-200 border border-gray-700"
                                : "bg-white text-gray-800 border border-gray-200"
                            } opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity`}
                          >
                            This is Batch 1 price
                          </span>
                        </span>
                      );
                    })()}
                  </p>
                </div>
                { }
                {!productHasVariants &&
                  <div>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                      Variant
                    </p>
                    <p
                      className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                      {product.variant || "N/A"}
                    </p>
                  </div>
                }
              </div>

              { }
              {productHasVariants && allVariants.length > 0 &&
                <div className="mb-4">
                  <p
                    className={`text-sm font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>

                    Select Variant <span className="text-red-500">*</span>
                  </p>
                  {!selectedVariant &&
                    <p
                      className={`text-xs mb-2 ${theme === "dark" ? "text-yellow-400" : "text-yellow-600"}`}>

                      Please select a variant first
                    </p>
                  }
                  <div className="flex flex-wrap gap-2">
                    {allVariants.map((variant) =>
                      <button
                        key={variant}
                        onClick={() => onSelectVariant(variant)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 bg-transparent ${selectedVariant === variant ?
                          "border-[#09A046] text-[#09A046] border-opacity-100" :
                          theme === "dark" ?
                            "text-gray-300 border-gray-600 hover:border-[#09A046]" :
                            "text-gray-700 border-gray-200 hover:border-[#09A046]"}`
                        }>

                        {variant}
                      </button>
                    )}
                  </div>
                </div>
              }

              { }
              {productHasVariants ?
                selectedVariant && availableSizes.length > 0 ?
                  <div className="mb-4">
                    <p
                      className={`text-sm font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>

                      Select Size <span className="text-red-500">*</span>
                    </p>
                    {!selectedSize &&
                      <p
                        className={`text-xs mb-2 ${theme === "dark" ? "text-yellow-400" : "text-yellow-600"}`}>

                        Please select a size to continue
                      </p>
                    }
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((size) => {
                        const variantStock = getVariantQuantityInSize(size, selectedVariant);
                        const isOutOfStock = variantStock <= 0;
                        return (
                          <button
                            key={size}
                            onClick={() => !isOutOfStock && onSelectSize(size)}
                            disabled={isOutOfStock}
                            className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all border-2 ${selectedSize === size ?
                              "bg-transparent text-[#09A046] border-[#09A046]" :
                              isOutOfStock ?
                                theme === "dark" ?
                                  "bg-transparent text-gray-500 cursor-not-allowed border-gray-700" :
                                  "bg-transparent text-gray-300 cursor-not-allowed border-gray-200" :
                                theme === "dark" ?
                                  "bg-transparent text-gray-300 border-[#4A4037] hover:border-[#09A046]" :
                                  "bg-transparent text-gray-700 border-gray-200 hover:border-[#09A046]"}`
                            }>

                            <span className="font-bold text-sm">{size}</span>
                            <span
                              className={`text-[10px] mt-0.5 ${selectedSize === size ?
                                "text-[#09A046]/80" :
                                isOutOfStock ?
                                  theme === "dark" ?
                                    "text-gray-600" :
                                    "text-gray-300" :
                                  theme === "dark" ?
                                    "text-gray-400" :
                                    "text-gray-500"}`
                              }>

                              {isOutOfStock ? "Out" : `${variantStock} pcs`}
                            </span>
                          </button>);

                      })}
                    </div>
                  </div> :
                  !selectedVariant ?
                    <div className="mb-4">
                      <p
                        className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Size
                      </p>
                      <p
                        className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>

                        Select a variant first
                      </p>
                    </div> :
                    null :
                availableSizes.length > 0 ?
                  <div className="mb-4">
                    <p
                      className={`text-sm font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>

                      Select Size <span className="text-red-500">*</span>
                    </p>
                    {!selectedSize &&
                      <p
                        className={`text-xs mb-2 ${theme === "dark" ? "text-yellow-400" : "text-yellow-600"}`}>

                        Please select a size to continue
                      </p>
                    }
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((size) => {
                        const sizeStock = getSizeQuantity(product.sizes[size]);
                        const isOutOfStock = sizeStock <= 0;
                        return (
                          <button
                            key={size}
                            onClick={() => !isOutOfStock && onSelectSize(size)}
                            disabled={isOutOfStock}
                            className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all border-2 ${selectedSize === size ?
                              "bg-transparent text-[#09A046] border-[#09A046]" :
                              isOutOfStock ?
                                theme === "dark" ?
                                  "bg-transparent text-gray-500 cursor-not-allowed border-gray-700" :
                                  "bg-transparent text-gray-300 cursor-not-allowed border-gray-200" :
                                theme === "dark" ?
                                  "bg-transparent text-gray-300 border-[#4A4037] hover:border-[#09A046]" :
                                  "bg-transparent text-gray-700 border-gray-200 hover:border-[#09A046]"}`
                            }>

                            <span className="font-bold text-sm">{size}</span>
                            <span
                              className={`text-[10px] mt-0.5 ${selectedSize === size ?
                                "text-[#09A046]/80" :
                                isOutOfStock ?
                                  theme === "dark" ?
                                    "text-gray-600" :
                                    "text-gray-300" :
                                  theme === "dark" ?
                                    "text-gray-400" :
                                    "text-gray-500"}`
                              }>

                              {isOutOfStock ? "Out" : `${sizeStock} pcs`}
                            </span>
                          </button>);

                      })}
                    </div>
                  </div> :

                  <div className="mb-4">
                    <p
                      className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                      Size
                    </p>
                    <p
                      className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                      {product.size || "N/A"}
                    </p>
                  </div>
              }

              { }
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    Quantity
                  </p>
                  <div
                    className={`flex items-center gap-2 mt-1 ${productHasVariants && (!selectedVariant || !effectiveSelectedSize) ||
                      !productHasVariants && availableSizes.length > 0 && !effectiveSelectedSize ?
                      "opacity-40 pointer-events-none" :
                      ""}`
                    }>

                    <button
                      onClick={onDecrement}
                      disabled={
                        isDecrementDisabled() ||
                        productHasVariants && (!selectedVariant || !effectiveSelectedSize) ||
                        !productHasVariants && availableSizes.length > 0 && !effectiveSelectedSize
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isDecrementDisabled() ||
                        productHasVariants && (!selectedVariant || !effectiveSelectedSize) ||
                        !productHasVariants && availableSizes.length > 0 && !effectiveSelectedSize ?
                        theme === "dark" ?
                          "bg-gray-700 text-gray-500 cursor-not-allowed" :
                          "bg-gray-200 text-gray-400 cursor-not-allowed" :
                        "bg-transparent text-[#09A046] border-2 border-[#09A046] hover:bg-transparent"}`
                      }>

                      <FaMinus className="text-xs text-[#09A046]" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={productQuantity}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n) && n > 0) onSetQuantity?.(n);
                      }}
                      className={`w-10 text-center font-semibold px-2 py-1 rounded-lg border ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-200 text-gray-800"}`}
                    />
                    <button
                      onClick={onIncrement}
                      disabled={
                        isIncrementDisabled() ||
                        productHasVariants && (!selectedVariant || !effectiveSelectedSize) ||
                        !productHasVariants && availableSizes.length > 0 && !effectiveSelectedSize
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isIncrementDisabled() ||
                        productHasVariants && (!selectedVariant || !effectiveSelectedSize) ||
                        !productHasVariants && availableSizes.length > 0 && !effectiveSelectedSize ?
                        theme === "dark" ?
                          "bg-gray-700 text-gray-500 cursor-not-allowed" :
                          "bg-gray-200 text-gray-400 cursor-not-allowed" :
                        "bg-transparent text-[#09A046] border-2 border-[#09A046] hover:bg-transparent"}`
                      }>

                      <FaPlus className="text-xs text-[#09A046]" />
                    </button>
                  </div>
                </div>
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    Stock
                  </p>
                  {productHasVariants ?
                    selectedVariant && effectiveSelectedSize ?
                      <p
                        className={`font-medium mt-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                        {getVariantQuantityInSize(effectiveSelectedSize, selectedVariant)} pcs
                      </p> :
                      !selectedVariant ?
                        <p
                          className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>

                          Select a variant
                        </p> :

                        <p
                          className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>

                          Select a size
                        </p> :

                    availableSizes.length > 0 ?
                      effectiveSelectedSize ?
                        <p
                          className={`font-medium mt-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                          {getSizeQuantity(product.sizes[effectiveSelectedSize])} pcs
                        </p> :

                        <p
                          className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>

                          Select a size
                        </p> :


                      <p
                        className={`font-medium mt-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                        {getTotalStock()}
                      </p>
                  }
                </div>
              </div>

              { }
              <button
                onClick={handleAdd}
                disabled={isAddButtonDisabled()}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${isAddButtonDisabled() ?
                  "bg-gray-300 cursor-not-allowed" :
                  "bg-green-500 hover:bg-green-600"}`
                }>

                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>);

};

export default ProductDetailsModal;