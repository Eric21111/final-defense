import { FaMinus, FaPlus, FaTimes } from "react-icons/fa";
import { MdCategory, MdShoppingBag } from "react-icons/md";
import { useTheme } from "../../context/ThemeContext";

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

  // Get display price based on selected size
  const getDisplayPrice = () => {
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

  // Get available sizes with stock
  const availableSizes =
    product.sizes && typeof product.sizes === "object"
      ? Object.keys(product.sizes)
      : [];

  // Get available stock for current selection
  const getAvailableStock = () => {
    if (product.sizes && typeof product.sizes === "object" && selectedSize) {
      return getSizeQuantity(product.sizes[selectedSize]);
    }
    return product.currentStock || 0;
  };

  // Check if Add button should be disabled
  const isAddButtonDisabled = () => {
    if (
      product.sizes &&
      typeof product.sizes === "object" &&
      Object.keys(product.sizes).length > 0
    ) {
      if (!selectedSize) return true;
      const sizeStock = getSizeQuantity(product.sizes[selectedSize]);
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
              {product.itemImage && product.itemImage.trim() !== "" ? (
                <img
                  src={product.itemImage}
                  alt={product.itemName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <MdCategory className="text-6xl text-gray-400" />
                </div>
              )}
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
                {product.variant ? ` (${product.variant})` : ""}
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
              </div>

              {/* Size Selection - full width, prominent */}
              {availableSizes.length > 0 ? (
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
                          className={`flex flex-col items-center px-4 py-2 rounded-lg text-xs font-medium transition-all border-2 ${
                            selectedSize === size
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
                            className={`text-[10px] mt-0.5 ${
                              selectedSize === size
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
                    className={`flex items-center gap-2 mt-1 ${availableSizes.length > 0 && !selectedSize ? "opacity-40 pointer-events-none" : ""}`}
                  >
                    <button
                      onClick={onDecrement}
                      disabled={
                        isDecrementDisabled() ||
                        (availableSizes.length > 0 && !selectedSize)
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                        isDecrementDisabled() ||
                        (availableSizes.length > 0 && !selectedSize)
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
                        (availableSizes.length > 0 && !selectedSize)
                      }
                      className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                        isIncrementDisabled() ||
                        (availableSizes.length > 0 && !selectedSize)
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
                  {availableSizes.length > 0 ? (
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
                className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
                  isAddButtonDisabled()
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
