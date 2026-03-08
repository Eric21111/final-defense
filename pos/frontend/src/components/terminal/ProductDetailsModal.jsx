import { FaMinus, FaPlus, FaTimes } from "react-icons/fa";
import { MdCategory, MdShoppingBag } from "react-icons/md";
import { useTheme } from "../../context/ThemeContext";
import { API_BASE_URL } from "../../config/api";

const ProductDetailsModal = ({
  isOpen,
  onClose,
  product,
  productQuantity,
  onDecrement,
  onIncrement,
  onAdd,
  selectedSize,
  onSelectSize,
  selectedVariant,
  onSelectVariant,
}) => {
  const { theme } = useTheme();

  if (!isOpen || !product) return null;

  // Helper function to get quantity from size data
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

  // Helper function to get price from size data
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

  // Helper function to get variants from size data
  const getSizeVariants = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.variants &&
      typeof sizeData.variants === "object"
    ) {
      return sizeData.variants;
    }
    return null;
  };

  // Helper function to get variant prices from size data
  const getSizeVariantPrices = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.variantPrices &&
      typeof sizeData.variantPrices === "object"
    ) {
      return sizeData.variantPrices;
    }
    return null;
  };

  // Helper to get variant quantity (handles both number and object formats)
  const getVariantQty = (variantData) => {
    if (typeof variantData === "number") return variantData;
    if (typeof variantData === "object" && variantData !== null) {
      return variantData.quantity || 0;
    }
    return 0;
  };

  // Parse simple variant field (comma-separated string like "#1, #2, #3")
  const getSimpleVariants = () => {
    if (product.variant && typeof product.variant === "string") {
      // Split by comma and clean up
      const variants = product.variant
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
      // Only return if there are multiple variants
      if (variants.length > 1) {
        return variants;
      }
    }
    return [];
  };

  // Check if product has variants (variants stored per size)
  // Returns true if any size has a variants object, regardless of stock
  const hasSizeVariants = () => {
    if (product.sizes && typeof product.sizes === "object") {
      return Object.values(product.sizes).some((sizeData) => {
        const variants = getSizeVariants(sizeData);
        // Check if variants exist (regardless of stock quantity)
        return variants && typeof variants === "object" && Object.keys(variants).length > 0;
      });
    }
    return false;
  };

  // Check if product has simple variants (from variant field, not sizes.variants)
  // BUT only if there are NO size-based variants (size-based takes priority)
  const hasSimpleVariants = () => {
    // If product has size-based variants, don't use simple variants
    if (hasSizeVariants()) return false;
    return getSimpleVariants().length > 0;
  };

  // Combined check for any type of variants
  const hasVariants = () => {
    return hasSizeVariants() || hasSimpleVariants();
  };

  // Get all unique variants from all sizes OR from simple variant field
  // Returns ALL variants including those with 0 stock (they will be shown as disabled)
  const getAllVariants = () => {
    const variantSet = new Set();

    // FIRST check for size-based variants (these have actual stock tracking)
    if (product.sizes && typeof product.sizes === "object") {
      Object.values(product.sizes).forEach((sizeData) => {
        const variants = getSizeVariants(sizeData);
        if (variants) {
          // Add ALL variants regardless of stock quantity
          Object.keys(variants).forEach((variant) => {
            variantSet.add(variant);
          });
        }
      });
    }

    // If we found size-based variants, return them
    if (variantSet.size > 0) {
      return Array.from(variantSet);
    }

    // Otherwise fall back to simple variants from product.variant field
    const simpleVariants = getSimpleVariants();
    if (simpleVariants.length > 0) {
      simpleVariants.forEach((v) => variantSet.add(v));
    }

    return Array.from(variantSet);
  };

  // Get all sizes for a specific variant (for size-based variants)
  // Returns ALL sizes including those with 0 stock (they will be shown as disabled)
  const getAvailableSizesForVariant = (variant) => {
    if (!product.sizes || typeof product.sizes !== "object") return [];

    // For simple variants, return all sizes
    if (hasSimpleVariants()) {
      return Object.keys(product.sizes);
    }

    // For size-based variants, return all sizes that have this variant defined
    return Object.entries(product.sizes)
      .filter(([size, sizeData]) => {
        const variants = getSizeVariants(sizeData);
        // Include size if this variant exists (regardless of stock quantity)
        return variants && variants[variant] !== undefined;
      })
      .map(([size]) => size);
  };

  // Get quantity for a specific variant in a specific size
  const getVariantQuantityInSize = (size, variant) => {
    // For simple variants, return size quantity divided by number of variants (approximate)
    if (hasSimpleVariants()) {
      if (!product.sizes || !product.sizes[size]) return 0;
      const sizeQty = getSizeQuantity(product.sizes[size]);
      const variantCount = getSimpleVariants().length;
      // For simple variants, we don't track per-variant stock, so show size stock
      return sizeQty;
    }

    if (!product.sizes || !product.sizes[size]) return 0;
    const variants = getSizeVariants(product.sizes[size]);
    if (variants && variants[variant] !== undefined) {
      return getVariantQty(variants[variant]);
    }
    return 0;
  };

  // Get price for a specific variant in a specific size
  const getVariantPriceInSize = (size, variant) => {
    if (!product.sizes || !product.sizes[size]) return null;
    const variantPrices = getSizeVariantPrices(product.sizes[size]);
    if (variantPrices && variantPrices[variant] !== undefined) {
      return variantPrices[variant];
    }
    // Fallback to size price
    return getSizePrice(product.sizes[size]);
  };

  // Get display price based on selected size and variant
  const getDisplayPrice = () => {
    if (selectedSize && selectedVariant && hasVariants()) {
      const variantPrice = getVariantPriceInSize(selectedSize, selectedVariant);
      if (variantPrice !== null) {
        return variantPrice;
      }
    }
    if (
      selectedSize &&
      product.sizes &&
      typeof product.sizes === "object" &&
      product.sizes[selectedSize]
    ) {
      const sizeData = product.sizes[selectedSize];
      const sizePrice = getSizePrice(sizeData);
      if (sizePrice !== null) {
        return sizePrice;
      }
    }
    return product.itemPrice || 0;
  };

  // Get total stock
  const getTotalStock = () => {
    if (product.sizes && typeof product.sizes === "object") {
      return Object.values(product.sizes).reduce(
        (sum, sizeData) => sum + getSizeQuantity(sizeData),
        0,
      );
    }
    return product.currentStock || 0;
  };

  // Determine available sizes based on whether product has variants
  const productHasVariants = hasVariants();
  const allVariants = productHasVariants ? getAllVariants() : [];

  // Get available sizes - if has variants, only show sizes that have stock for selected variant
  const availableSizes = productHasVariants
    ? (selectedVariant ? getAvailableSizesForVariant(selectedVariant) : [])
    : (product.sizes && typeof product.sizes === "object"
      ? Object.keys(product.sizes)
      : []);

  // Get available stock for current selection
  const getAvailableStock = () => {
    if (product.sizes && typeof product.sizes === "object" && selectedSize) {
      // If product has size-based variants, get stock for specific variant
      if (hasSizeVariants() && selectedVariant) {
        return getVariantQuantityInSize(selectedSize, selectedVariant);
      }
      // For simple variants or no variants, use size stock
      return getSizeQuantity(product.sizes[selectedSize]);
    }
    return product.currentStock || 0;
  };

  // Check if Add button should be disabled
  const isAddButtonDisabled = () => {
    // If product has variants, must select variant first
    if (productHasVariants && !selectedVariant) return true;

    if (
      product.sizes &&
      typeof product.sizes === "object" &&
      Object.keys(product.sizes).length > 0
    ) {
      if (!selectedSize) return true;

      // Get stock based on variant selection
      let sizeStock;
      if (hasSizeVariants() && selectedVariant) {
        // For size-based variants, get specific variant stock
        sizeStock = getVariantQuantityInSize(selectedSize, selectedVariant);
      } else {
        // For simple variants or no variants, use size stock
        sizeStock = getSizeQuantity(product.sizes[selectedSize]);
      }

      if (sizeStock <= 0 || productQuantity > sizeStock) return true;
    } else {
      const totalStock = product.currentStock || 0;
      if (totalStock <= 0 || productQuantity > totalStock) return true;
    }
    return false;
  };

  // Check if increment button should be disabled
  const isIncrementDisabled = () => {
    const availableStock = getAvailableStock();
    return productQuantity >= availableStock;
  };

  // Check if decrement button should be disabled
  const isDecrementDisabled = () => {
    return productQuantity <= 1;
  };

  const handleAdd = () => {
    onAdd();
    // Note: onAdd (addToCartFromExpanded) already handles closing the modal
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-sm bg-black/30"
      onClick={onClose}
    >
      <div
        className={`rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden mx-4 ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center gap-3 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-100"}`}
        >
          <div className="w-10 h-10 rounded-lg bg-[#AD7F65] flex items-center justify-center">
            <MdShoppingBag className="text-white text-xl" />
          </div>
          <h2
            className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}
          >
            Product Details
          </h2>
          <button
            onClick={onClose}
            className={`ml-auto transition ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="flex gap-6">
            {/* Product Image */}
            <div
              className={`w-64 h-64 rounded-xl overflow-hidden flex-shrink-0 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-100"}`}
            >
              <div className="relative w-full h-full">
                <img
                  src={`${API_BASE_URL}/api/products/${product._id}/image`}
                  alt={product.itemName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = 'flex';
                    }
                  }}
                  onLoad={(e) => {
                    if (e.target.nextElementSibling) {
                      e.target.nextElementSibling.style.display = 'none';
                    }
                  }}
                />
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-[#352F2A] text-gray-400 dark:text-gray-500"
                  style={{ display: 'none' }}
                >
                  <MdCategory className="text-6xl" />
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="flex-1">
              <p
                className={`text-sm mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                Product Name
              </p>
              <h3
                className={`text-2xl font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-800"}`}
              >
                {product.itemName}
              </h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Category
                  </p>
                  <p
                    className={`font-medium flex items-center gap-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                  >
                    <MdShoppingBag className="text-gray-500" />
                    {product.category || "N/A"}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    SKU/Item Code
                  </p>
                  <p
                    className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                  >
                    {product.sku || "N/A"}
                  </p>
                </div>
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Price
                  </p>
                  <p className="font-bold text-[#AD7F65] text-lg">
                    PHP {getDisplayPrice().toFixed(2)}
                  </p>
                </div>
                {/* Show static variant only if product doesn't have variants per size */}
                {!productHasVariants && (
                  <div>
                    <p
                      className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Variant
                    </p>
                    <p
                      className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                    >
                      {product.variant || "N/A"}
                    </p>
                  </div>
                )}
              </div>

              {/* Variant Selection - show first if product has variants per size */}
              {productHasVariants && allVariants.length > 0 && (
                <div className="mb-4">
                  <p
                    className={`text-sm font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                  >
                    Select Variant <span className="text-red-500">*</span>
                  </p>
                  {!selectedVariant && (
                    <p
                      className={`text-xs mb-2 ${theme === "dark" ? "text-yellow-400" : "text-yellow-600"}`}
                    >
                      Please select a variant first
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {allVariants.map((variant) => (
                      <button
                        key={variant}
                        onClick={() => onSelectVariant(variant)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${selectedVariant === variant
                          ? "bg-[#AD7F65] text-white border-[#AD7F65]"
                          : theme === "dark"
                            ? "bg-[#2A2724] text-gray-300 hover:bg-gray-600 border-[#4A4037] hover:border-[#AD7F65]"
                            : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200 hover:border-[#AD7F65]"
                          }`}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selection - show after variant is selected (if product has variants) */}
              {productHasVariants ? (
                selectedVariant && availableSizes.length > 0 ? (
                  <div className="mb-4">
                    <p
                      className={`text-sm font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                    >
                      Select Size <span className="text-red-500">*</span>
                    </p>
                    {!selectedSize && (
                      <p
                        className={`text-xs mb-2 ${theme === "dark" ? "text-yellow-400" : "text-yellow-600"}`}
                      >
                        Please select a size to continue
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((size) => {
                        const variantStock = getVariantQuantityInSize(size, selectedVariant);
                        const isOutOfStock = variantStock <= 0;
                        return (
                          <button
                            key={size}
                            onClick={() => !isOutOfStock && onSelectSize(size)}
                            disabled={isOutOfStock}
                            className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all border-2 ${selectedSize === size
                              ? "bg-[#AD7F65] text-white border-[#AD7F65]"
                              : isOutOfStock
                                ? theme === "dark"
                                  ? "bg-gray-700 text-gray-500 cursor-not-allowed border-gray-700"
                                  : "bg-gray-100 text-gray-300 cursor-not-allowed border-gray-100"
                                : theme === "dark"
                                  ? "bg-[#2A2724] text-gray-300 hover:bg-gray-600 border-[#4A4037] hover:border-[#AD7F65]"
                                  : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200 hover:border-[#AD7F65]"
                              }`}
                          >
                            <span className="font-bold text-sm">{size}</span>
                            <span
                              className={`text-[10px] mt-0.5 ${selectedSize === size
                                ? "text-white/80"
                                : isOutOfStock
                                  ? theme === "dark"
                                    ? "text-gray-600"
                                    : "text-gray-300"
                                  : theme === "dark"
                                    ? "text-gray-400"
                                    : "text-gray-500"
                                }`}
                            >
                              {isOutOfStock ? "Out" : `${variantStock} pcs`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : !selectedVariant ? (
                  <div className="mb-4">
                    <p
                      className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Size
                    </p>
                    <p
                      className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                    >
                      Select a variant first
                    </p>
                  </div>
                ) : null
              ) : availableSizes.length > 0 ? (
                <div className="mb-4">
                  <p
                    className={`text-sm font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                  >
                    Select Size <span className="text-red-500">*</span>
                  </p>
                  {!selectedSize && (
                    <p
                      className={`text-xs mb-2 ${theme === "dark" ? "text-yellow-400" : "text-yellow-600"}`}
                    >
                      Please select a size to continue
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => {
                      const sizeStock = getSizeQuantity(product.sizes[size]);
                      const isOutOfStock = sizeStock <= 0;
                      return (
                        <button
                          key={size}
                          onClick={() => !isOutOfStock && onSelectSize(size)}
                          disabled={isOutOfStock}
                          className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all border-2 ${selectedSize === size
                            ? "bg-[#AD7F65] text-white border-[#AD7F65]"
                            : isOutOfStock
                              ? theme === "dark"
                                ? "bg-gray-700 text-gray-500 cursor-not-allowed border-gray-700"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed border-gray-100"
                              : theme === "dark"
                                ? "bg-[#2A2724] text-gray-300 hover:bg-gray-600 border-[#4A4037] hover:border-[#AD7F65]"
                                : "bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200 hover:border-[#AD7F65]"
                            }`}
                        >
                          <span className="font-bold text-sm">{size}</span>
                          <span
                            className={`text-[10px] mt-0.5 ${selectedSize === size
                              ? "text-white/80"
                              : isOutOfStock
                                ? theme === "dark"
                                  ? "text-gray-600"
                                  : "text-gray-300"
                                : theme === "dark"
                                  ? "text-gray-400"
                                  : "text-gray-500"
                              }`}
                          >
                            {isOutOfStock ? "Out" : `${sizeStock} pcs`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Size
                  </p>
                  <p
                    className={`font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                  >
                    {product.size || "N/A"}
                  </p>
                </div>
              )}

              {/* Quantity + Stock row */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Quantity
                  </p>
                  <div
                    className={`flex items-center gap-2 mt-1 ${(productHasVariants && (!selectedVariant || !selectedSize)) ||
                      (!productHasVariants && availableSizes.length > 0 && !selectedSize)
                      ? "opacity-40 pointer-events-none"
                      : ""
                      }`}
                  >
                    <button
                      onClick={onDecrement}
                      disabled={
                        isDecrementDisabled() ||
                        (productHasVariants && (!selectedVariant || !selectedSize)) ||
                        (!productHasVariants && availableSizes.length > 0 && !selectedSize)
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isDecrementDisabled() ||
                        (productHasVariants && (!selectedVariant || !selectedSize)) ||
                        (!productHasVariants && availableSizes.length > 0 && !selectedSize)
                        ? theme === "dark"
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#AD7F65] text-white hover:bg-[#8B5F45]"
                        }`}
                    >
                      <FaMinus className="text-xs" />
                    </button>
                    <span
                      className={`w-8 text-center font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}
                    >
                      {productQuantity}
                    </span>
                    <button
                      onClick={onIncrement}
                      disabled={
                        isIncrementDisabled() ||
                        (productHasVariants && (!selectedVariant || !selectedSize)) ||
                        (!productHasVariants && availableSizes.length > 0 && !selectedSize)
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isIncrementDisabled() ||
                        (productHasVariants && (!selectedVariant || !selectedSize)) ||
                        (!productHasVariants && availableSizes.length > 0 && !selectedSize)
                        ? theme === "dark"
                          ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        : "bg-[#AD7F65] text-white hover:bg-[#8B5F45]"
                        }`}
                    >
                      <FaPlus className="text-xs" />
                    </button>
                  </div>
                </div>
                <div>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Stock
                  </p>
                  {productHasVariants ? (
                    selectedVariant && selectedSize ? (
                      <p
                        className={`font-medium mt-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                      >
                        {getVariantQuantityInSize(selectedSize, selectedVariant)} pcs
                      </p>
                    ) : !selectedVariant ? (
                      <p
                        className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                      >
                        Select a variant
                      </p>
                    ) : (
                      <p
                        className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                      >
                        Select a size
                      </p>
                    )
                  ) : availableSizes.length > 0 ? (
                    selectedSize ? (
                      <p
                        className={`font-medium mt-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                      >
                        {getSizeQuantity(product.sizes[selectedSize])} pcs
                      </p>
                    ) : (
                      <p
                        className={`text-sm mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                      >
                        Select a size
                      </p>
                    )
                  ) : (
                    <p
                      className={`font-medium mt-1 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                    >
                      {getTotalStock()}
                    </p>
                  )}
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAdd}
                disabled={isAddButtonDisabled()}
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${isAddButtonDisabled()
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600"
                  }`}
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsModal;
