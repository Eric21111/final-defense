import { useTheme } from "../../context/ThemeContext";

const ViewProductModal = ({
  showViewModal,
  setShowViewModal,
  viewingProduct,
  formatDate,
}) => {
  const { theme } = useTheme();

  if (!showViewModal || !viewingProduct) return null;

  // Calculate total stock
  const totalStock =
    viewingProduct.sizes &&
    typeof viewingProduct.sizes === "object" &&
    Object.keys(viewingProduct.sizes).length > 0
      ? Object.values(viewingProduct.sizes).reduce((sum, sizeData) => {
          const qty =
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined
              ? sizeData.quantity
              : typeof sizeData === "number"
                ? sizeData
                : 0;
          return sum + qty;
        }, 0)
      : viewingProduct.currentStock || 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm bg-opacity-30"
      onClick={() => setShowViewModal(false)}
    >
      <div
        className={`rounded-2xl w-full max-w-4xl relative overflow-hidden ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex justify-between items-center px-6 py-4 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === "dark" ? "bg-[#AD7F65]" : "bg-[#AD7F65]"}`}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2
              className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
            >
              Product Details
            </h2>
          </div>
          <button
            onClick={() => setShowViewModal(false)}
            className={`text-2xl ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Product Image */}
            <div
              className={`flex items-center justify-center rounded-xl p-6 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}
            >
              {viewingProduct.itemImage &&
              viewingProduct.itemImage.trim() !== "" ? (
                <img
                  src={viewingProduct.itemImage}
                  alt={viewingProduct.itemName}
                  className="max-w-full max-h-[400px] object-contain rounded-lg"
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

            {/* Right: Product Details */}
            <div className="space-y-4">
              {/* Product Name */}
              <div>
                <h3
                  className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                >
                  Product Name
                </h3>
                <p
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {viewingProduct.itemName}
                </p>
              </div>

              {/* Category and Selling Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Category
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                  >
                    {viewingProduct.category}
                  </p>
                </div>
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Selling Price
                  </h3>
                  <p
                    className={`text-sm font-semibold ${theme === "dark" ? "text-green-400" : "text-green-600"}`}
                  >
                    {(() => {
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

                      if (
                        viewingProduct.sizes &&
                        typeof viewingProduct.sizes === "object"
                      ) {
                        const prices = [];
                        Object.values(viewingProduct.sizes).forEach(
                          (sizeData) => {
                            const price = getSizePrice(sizeData);
                            if (price !== null) {
                              prices.push(price);
                            }
                          },
                        );

                        if (prices.length > 0) {
                          const minPrice = Math.min(...prices);
                          const maxPrice = Math.max(...prices);
                          if (minPrice !== maxPrice) {
                            return `₱${minPrice.toFixed(2)} - ₱${maxPrice.toFixed(2)}`;
                          }
                          return `₱${minPrice.toFixed(2)}`;
                        }
                      }
                      return `₱${viewingProduct.itemPrice?.toFixed(2) || "0.00"}`;
                    })()}
                  </p>
                </div>
              </div>

              {/* SKU and Cost Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    SKU/Item Code
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                  >
                    {viewingProduct.sku}
                  </p>
                </div>
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Cost Price
                  </h3>
                  <p
                    className={`text-sm font-semibold ${theme === "dark" ? "text-red-400" : "text-red-600"}`}
                  >
                    ₱{viewingProduct.costPrice?.toFixed(2) || "0.00"}
                  </p>
                </div>
              </div>

              {/* Variant and Brand Partner */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Variant
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                  >
                    {viewingProduct.variant || "N/A"}
                  </p>
                </div>
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Brand Partner
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}
                  >
                    {viewingProduct.brandName || "N/A"}
                  </p>
                </div>
              </div>

              {/* Stock */}
              <div>
                <h3
                  className={`text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                >
                  Stock
                </h3>
                {viewingProduct.sizes &&
                typeof viewingProduct.sizes === "object" &&
                Object.keys(viewingProduct.sizes).length > 0 ? (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {Object.entries(viewingProduct.sizes).map(
                        ([size, sizeData]) => {
                          const stock =
                            typeof sizeData === "object" &&
                            sizeData !== null &&
                            sizeData.quantity !== undefined
                              ? sizeData.quantity
                              : typeof sizeData === "number"
                                ? sizeData
                                : 0;
                          const price =
                            typeof sizeData === "object" &&
                            sizeData !== null &&
                            sizeData.price !== undefined
                              ? sizeData.price
                              : null;
                          return (
                            <div
                              key={size}
                              className={`flex flex-col items-center px-3 py-2 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}
                            >
                              <span
                                className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                              >
                                {size}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  stock === 0
                                    ? "bg-red-100 text-red-700"
                                    : stock <=
                                        (viewingProduct.reorderNumber || 10)
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-green-100 text-green-700"
                                }`}
                              >
                                {stock}
                              </span>
                              {price !== null && (
                                <span className="text-[10px] text-gray-500 mt-1">
                                  ₱{parseFloat(price).toFixed(2)}
                                </span>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                    <p
                      className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                    >
                      Total: {totalStock}
                    </p>
                  </div>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    {totalStock}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProductModal;
