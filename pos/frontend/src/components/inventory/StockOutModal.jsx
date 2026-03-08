import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const StockOutModal = ({ isOpen, onClose, product, onConfirm, loading }) => {
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [variantQuantities, setVariantQuantities] = useState({}); // { "S": { "Blue": 5, "White": 3 } }
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Sold");
  const [otherReason, setOtherReason] = useState("");
  const { theme } = useTheme();

  const allSizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"];
  const reasons = [
    "Sold",
    "Damaged",
    "Defective",
    "Returned Item",
    "Lost",
    "Expired",
    "Other",
  ];

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

  // Helper to check if a size has variants
  const getSizeVariants = (size) => {
    if (
      hasSizes &&
      product.sizes[size] &&
      typeof product.sizes[size] === "object" &&
      product.sizes[size].variants
    ) {
      return product.sizes[size].variants;
    }
    return null;
  };

  // Get all unique variants from the product
  const getAllVariants = () => {
    const variantSet = new Set();
    if (hasSizes) {
      Object.values(product.sizes).forEach((sizeData) => {
        if (typeof sizeData === "object" && sizeData?.variants) {
          Object.keys(sizeData.variants).forEach((v) => variantSet.add(v));
        }
      });
    }
    return Array.from(variantSet);
  };

  const hasSizes =
    product.sizes &&
    typeof product.sizes === "object" &&
    Object.keys(product.sizes).length > 0;

  const allVariants = hasSizes ? getAllVariants() : [];
  const hasVariants = allVariants.length > 0;

  const availableSizes = hasSizes
    ? Object.keys(product.sizes).filter(
        (size) => getSizeQuantity(product.sizes[size]) > 0,
      )
    : [];

  // Get current variant quantity for a size
  const getVariantCurrentQty = (size, variant) => {
    const variants = getSizeVariants(size);
    if (variants && variants[variant] !== undefined) {
      // Handle both number format and object format
      if (typeof variants[variant] === "number") {
        return variants[variant];
      }
      return variants[variant].quantity || 0;
    }
    return 0;
  };

  useEffect(() => {
    if (isOpen && product) {
      setSelectedSizes([]);
      setSizeQuantities({});
      setVariantQuantities({});
      setQuantity("");
      setReason("Sold");
      setOtherReason("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, product?._id]);

  if (!isOpen || !product) return null;

  const handleClose = () => {
    setSelectedSizes([]);
    setSizeQuantities({});
    setVariantQuantities({});
    setQuantity("");
    setReason("Sold");
    setOtherReason("");
    onClose();
  };

  const handleSizeToggle = (size) => {
    const isSelected = selectedSizes.includes(size);
    if (isSelected) {
      setSelectedSizes((prev) => prev.filter((s) => s !== size));
      setSizeQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[size];
        return newQuantities;
      });
      setVariantQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[size];
        return newQuantities;
      });
    } else {
      setSelectedSizes((prev) => [...prev, size]);
      setSizeQuantities((prev) => ({
        ...prev,
        [size]: "",
      }));
      // Initialize variant quantities for this size if product has variants
      if (hasVariants) {
        setVariantQuantities((prev) => ({
          ...prev,
          [size]: {},
        }));
      }
    }
  };

  const handleSizeQuantityChange = (size, qty) => {
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: parseInt(qty) || 0,
    }));
  };

  const handleVariantQuantityChange = (size, variant, qty) => {
    setVariantQuantities((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: parseInt(qty) || 0,
      },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate other reason if "Other" is selected
    if (reason === "Other" && !otherReason.trim()) {
      alert("Please specify the reason");
      return;
    }

    const finalReason =
      reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    if (!hasSizes) {
      // Product without sizes - use simple quantity
      const qty = parseInt(quantity) || 0;
      if (qty <= 0) {
        alert("Please enter a valid quantity");
        return;
      }
      if (qty > (product.currentStock || 0)) {
        alert(
          `Cannot remove more than available stock (${product.currentStock || 0})`,
        );
        return;
      }
      onConfirm({
        quantity: qty,
        noSizes: true,
        reason: finalReason,
      });
      return;
    }

    // Product with sizes
    if (selectedSizes.length === 0) {
      alert("Please select at least one size");
      return;
    }

    // Check if product has variants - validate variant quantities
    if (hasVariants) {
      const hasValidVariantQuantities = selectedSizes.some((size) => {
        const sizeVariantQtys = variantQuantities[size] || {};
        return Object.values(sizeVariantQtys).some((qty) => qty > 0);
      });

      if (!hasValidVariantQuantities) {
        alert("Please enter quantities for at least one variant");
        return;
      }

      // Validate variant quantities don't exceed available stock
      const invalidVariants = [];
      selectedSizes.forEach((size) => {
        const sizeVariantQtys = variantQuantities[size] || {};
        Object.entries(sizeVariantQtys).forEach(([variant, qty]) => {
          if (qty > 0) {
            const availableQty = getVariantCurrentQty(size, variant);
            if (qty > availableQty) {
              invalidVariants.push(`${size} - ${variant} (max: ${availableQty})`);
            }
          }
        });
      });

      if (invalidVariants.length > 0) {
        alert(
          `Cannot remove more than available stock for:\n${invalidVariants.join("\n")}`,
        );
        return;
      }

      onConfirm({
        sizes: sizeQuantities,
        variantQuantities: variantQuantities,
        selectedSizes: selectedSizes,
        reason: finalReason,
        hasVariants: true,
      });
      return;
    }

    // Product with sizes but no variants
    const hasValidQuantities = selectedSizes.some((size) => {
      const qty = sizeQuantities[size] || 0;
      return qty > 0;
    });

    if (!hasValidQuantities) {
      alert("Please enter quantities for at least one selected size");
      return;
    }

    // Validate quantities don't exceed available stock
    const invalidSizes = selectedSizes.filter((size) => {
      const requestedQty = sizeQuantities[size] || 0;
      const availableQty =
        product.sizes && product.sizes[size]
          ? getSizeQuantity(product.sizes[size])
          : 0;
      return requestedQty > availableQty;
    });

    if (invalidSizes.length > 0) {
      alert(
        `Cannot remove more than available stock for: ${invalidSizes.join(", ")}`,
      );
      return;
    }

    onConfirm({
      sizes: sizeQuantities,
      selectedSizes: selectedSizes,
      reason: finalReason,
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm pointer-events-none">
      <div
        className={`rounded-2xl w-full max-w-5xl relative pointer-events-auto overflow-hidden ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
                <span className="text-white text-[8px] font-bold leading-none">
                  -
                </span>
              </span>
            </div>
            <h2
              className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Stock Out
            </h2>
          </div>
          <button
            onClick={handleClose}
            className={`text-2xl font-light ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex" style={{ maxHeight: "calc(100vh - 150px)" }}>
            <div
              className={`w-1/2 p-6 flex items-center justify-center ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}
              style={{ minHeight: "500px", maxHeight: "calc(100vh - 150px)" }}
            >
              {product.itemImage && product.itemImage.trim() !== "" ? (
                <img
                  src={product.itemImage}
                  alt={product.itemName}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <svg
                    className="w-24 h-24 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm">No Image Available</p>
                </div>
              )}
            </div>

            <div className="w-1/2 p-6 flex flex-col justify-between overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
              <div className="space-y-6">
                <div>
                  <h3
                    className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                  >
                    {product.itemName}
                    {product.size && !product.sizes && ` (${product.size})`}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      SKU/Item Code
                    </label>
                    <p
                      className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {product.sku || "-"}
                    </p>
                  </div>
                  <div>
                    <label
                      className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Brand Partner{" "}
                      <span className="text-gray-400">(optional)</span>
                    </label>
                    <p
                      className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                    >
                      {product.supplierName || "none"}
                    </p>
                  </div>
                </div>

                {hasSizes ? (
                  <div>
                    <label
                      className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Select sizes to remove stock from
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {availableSizes.map((size) => {
                        const currentQty =
                          product.sizes && product.sizes[size]
                            ? getSizeQuantity(product.sizes[size])
                            : 0;
                        return (
                          <label
                            key={size}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedSizes.includes(size)}
                              onChange={() => handleSizeToggle(size)}
                              className="w-4 h-4 border-gray-300 rounded focus:ring-[#AD7F65] cursor-pointer"
                              style={{
                                accentColor: "#AD7F65",
                              }}
                            />
                            <span
                              className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                            >
                              {size}{" "}
                              <span className="text-xs text-gray-500">
                                ({currentQty})
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div
                      className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}
                    >
                      <label
                        className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                      >
                        {hasVariants ? "Quantity per Variant:" : "Quantity per Size:"}
                      </label>
                      <div className={hasVariants ? "space-y-4" : "grid grid-cols-2 gap-3"}>
                        {selectedSizes.length > 0 ? (
                          selectedSizes.map((size) => {
                            const currentQty =
                              product.sizes && product.sizes[size]
                                ? getSizeQuantity(product.sizes[size])
                                : 0;
                            const sizeVariants = getSizeVariants(size);
                            
                            // If product has variants, show variant inputs
                            if (hasVariants && sizeVariants) {
                              return (
                                <div key={size} className={`p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}>
                                  <label
                                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}
                                  >
                                    {size}{" "}
                                    <span className="text-gray-500 font-normal">
                                      (Current Total: {currentQty})
                                    </span>
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(sizeVariants).map((variant) => {
                                      const currentVariantQty = getVariantCurrentQty(size, variant);
                                      const requestedQty = variantQuantities[size]?.[variant] || 0;
                                      const isOverLimit = requestedQty > currentVariantQty;
                                      return (
                                        <div key={`${size}-${variant}`}>
                                          <label
                                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                                          >
                                            {variant}{" "}
                                            <span className="text-gray-500">
                                              ({currentVariantQty})
                                            </span>
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max={currentVariantQty}
                                            value={variantQuantities[size]?.[variant] || ""}
                                            onChange={(e) =>
                                              handleVariantQuantityChange(
                                                size,
                                                variant,
                                                e.target.value,
                                              )
                                            }
                                            placeholder="0"
                                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"} ${isOverLimit ? "border-red-500" : ""}`}
                                          />
                                          {isOverLimit && (
                                            <p className="text-xs text-red-500 mt-1">
                                              Max: {currentVariantQty}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {Object.keys(variantQuantities[size] || {}).length > 0 && (
                                    <p className={`text-xs mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                                      Removing: {Object.values(variantQuantities[size] || {}).reduce((sum, q) => sum + (parseInt(q) || 0), 0)} units
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            
                            // No variants - show simple quantity input
                            const maxQty = currentQty;
                            return (
                              <div key={size}>
                                <label
                                  className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                                >
                                  {size}{" "}
                                  <span className="text-gray-500">
                                    (Current: {currentQty})
                                  </span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxQty}
                                  value={sizeQuantities[size] || ""}
                                  onChange={(e) =>
                                    handleSizeQuantityChange(
                                      size,
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Enter quantity"
                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                                />
                                {sizeQuantities[size] > maxQty && (
                                  <p className="text-xs text-red-500 mt-1">
                                    Cannot exceed {maxQty}
                                  </p>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-2 text-xs text-gray-400 italic">
                            Select sizes above to add quantities
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label
                      className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                    >
                      Quantity to Remove
                    </label>
                    <p
                      className={`text-xs mb-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                    >
                      Current Stock: {product.currentStock || 0}
                    </p>
                    <input
                      type="number"
                      min="1"
                      max={product.currentStock || 0}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity to remove"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                    />
                    {parseInt(quantity) > (product.currentStock || 0) && (
                      <p className="text-xs text-red-500 mt-1">
                        Cannot exceed current stock ({product.currentStock || 0}
                        )
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Reason
                  </label>
                  <div className="relative">
                    <select
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        if (e.target.value !== "Other") {
                          setOtherReason("");
                        }
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                    >
                      {reasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                  {reason === "Other" && (
                    <input
                      type="text"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Please specify the reason"
                      className={`w-full mt-2 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                    />
                  )}
                </div>
              </div>

              <div
                className={`flex justify-end gap-3 mt-8 pt-6 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
              >
                <button
                  type="button"
                  onClick={handleClose}
                  className={`px-6 py-3 border rounded-lg font-medium transition-colors ${theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
                  }}
                >
                  {loading ? "Removing..." : "Remove Stocks"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockOutModal;
