import { useEffect, useRef } from "react";
import { MdCategory } from "react-icons/md";
import { useTheme } from "../../context/ThemeContext";
import { API_BASE_URL } from "../../config/api";

const ProductTable = ({
  loading,
  filteredProducts,
  handleEditProduct,
  handleDeleteProduct,
  handleViewProduct,
  handleStockUpdate,
  selectedProductIds = [],
  onToggleSelect,
  onToggleSelectAll,
  showSelection = false,
  allVisibleSelected = false,
  someVisibleSelected = false,
}) => {
  const { theme } = useTheme();
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

  const selectAllRef = useRef(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        showSelection && !allVisibleSelected && someVisibleSelected;
    }
  }, [showSelection, allVisibleSelected, someVisibleSelected]);

  // Function to get price range for products with sizes
  const getPriceRange = (product) => {
    // If product has sizes with different prices, calculate range
    if (product.sizes && typeof product.sizes === "object") {
      const prices = [];

      Object.values(product.sizes).forEach((sizeData) => {
        const price = getSizePrice(sizeData);
        if (price !== null) {
          prices.push(price);
        }
      });

      // If we have size-specific prices
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        // If prices are different, return range
        if (minPrice !== maxPrice) {
          return { min: minPrice, max: maxPrice, isRange: true };
        }
        // If all prices are same, return single price
        return { min: minPrice, max: maxPrice, isRange: false };
      }
    }

    // Default: use product's itemPrice
    return {
      min: product.itemPrice || 0,
      max: product.itemPrice || 0,
      isRange: false,
    };
  };
  return (
    <div
      className={`rounded-lg shadow ${theme === "dark" ? "bg-[#2A2724] border border-[#4A4037]" : "bg-white"}`}
    >
      <div className="overflow-x-auto p-6">
        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No products found. Click "Add New Item" to add your first product.
          </div>
        ) : (
          <table
            className="w-full relative border-separate"
            style={{ borderSpacing: "0" }}
          >
            <thead
              className={`border-b ${theme === "dark" ? "border-[#4A4037]" : "border-gray-200"}`}
            >
              <tr
                className={`text-left text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
              >
                {showSelection && (
                  <th className="pb-3 pr-4 w-10">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]"
                      onChange={onToggleSelectAll}
                      checked={showSelection ? allVisibleSelected : false}
                    />
                  </th>
                )}
                <th className="pb-3 pr-4">Item Image</th>
                <th className="pb-3 px-4">SKU</th>
                <th className="pb-3 px-4">Item Name</th>
                <th className="pb-3 px-4">Category</th>
                <th className="pb-3 px-4">Brand</th>
                <th className="pb-3 px-4">Item Price</th>
                <th className="pb-3 px-4 text-center">Current Stock</th>
                <th className="pb-3 px-4 text-center">Terminal</th>
                <th className="pb-3 pl-4">Actions</th>
              </tr>
            </thead>
            <tbody className="relative">
              {filteredProducts.map((product) => (
                <tr
                  key={product._id}
                  className={`border-b transition-colors cursor-pointer ${theme === "dark"
                      ? "border-[#4A4037] hover:bg-[#352F2A] text-gray-300"
                      : "border-gray-100 hover:bg-gray-50 text-gray-800"
                    }`}
                  onClick={() => handleViewProduct(product)}
                >
                  {showSelection && (
                    <td
                      className="py-3 pr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]"
                        checked={selectedProductIds.includes(product._id)}
                        onChange={() =>
                          onToggleSelect && onToggleSelect(product._id)
                        }
                      />
                    </td>
                  )}
                  <td className="py-3 pr-4">
                    <div className="relative w-12 h-12">
                      <img
                        src={`${API_BASE_URL}/api/products/${product._id}/image`}
                        alt={product.itemName}
                        className="w-12 h-12 object-cover rounded"
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
                        className={`absolute inset-0 w-12 h-12 rounded flex items-center justify-center ${theme === "dark" ? "bg-[#352F2A] text-gray-500" : "bg-gray-200 text-gray-400"}`}
                        style={{ display: 'none' }}
                      >
                        <MdCategory />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">{product.sku}</td>
                  <td className="py-3 px-4">{product.itemName}</td>
                  <td className="py-3 px-4">{product.category}</td>
                  <td className="py-3 px-4">{product.brandName || "-"}</td>
                  <td className="py-3 px-4">
                    {(() => {
                      const priceRange = getPriceRange(product);
                      return priceRange.isRange
                        ? `PHP ${priceRange.min.toFixed(2)} - ${priceRange.max.toFixed(2)}`
                        : `PHP ${priceRange.min.toFixed(2)}`;
                    })()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {(() => {
                      const totalStock =
                        product.sizes &&
                          typeof product.sizes === "object" &&
                          Object.keys(product.sizes).length > 0
                          ? Object.values(product.sizes).reduce(
                            (sum, sd) => sum + getSizeQuantity(sd),
                            0,
                          )
                          : product.currentStock || 0;
                      return (
                        <span
                          className={`px-2 py-1 rounded font-semibold ${totalStock === 0
                              ? "bg-red-100 text-red-700"
                              : totalStock <= (product.reorderNumber || 10)
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700"
                            }`}
                        >
                          {totalStock}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium ${product.displayInTerminal !== false
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                        }`}
                    >
                      {product.terminalStatus ||
                        (product.displayInTerminal !== false
                          ? "shown"
                          : "not shown")}
                    </span>
                  </td>
                  <td
                    className="py-3 pl-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      {/* Stock In Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStockUpdate(product, "in");
                        }}
                        className={`p-2 rounded-lg transition-colors group relative ${theme === "dark" ? "hover:bg-[#352F2A]" : "hover:bg-green-50"}`}
                        title="Stock In"
                      >
                        <div className="relative w-6 h-6 flex items-center justify-center">
                          <svg
                            className={`w-6 h-6 ${theme === "dark" ? "text-gray-400 group-hover:text-green-500" : "text-gray-600 group-hover:text-green-600"}`}
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
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center border border-white">
                            <span className="text-white text-[8px] font-bold leading-none">
                              +
                            </span>
                          </span>
                        </div>
                      </button>

                      {/* Stock Out Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStockUpdate(product, "out");
                        }}
                        className={`p-2 rounded-lg transition-colors group relative ${theme === "dark" ? "hover:bg-[#352F2A]" : "hover:bg-red-50"}`}
                        title="Stock Out"
                      >
                        <div className="relative w-6 h-6 flex items-center justify-center">
                          <svg
                            className={`w-6 h-6 ${theme === "dark" ? "text-gray-400 group-hover:text-red-500" : "text-gray-600 group-hover:text-red-600"}`}
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
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center border border-white">
                            <span className="text-white text-[8px] font-bold leading-none">
                              -
                            </span>
                          </span>
                        </div>
                      </button>

                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditProduct(product);
                        }}
                        className={`p-2 rounded-lg transition-colors group ${theme === "dark" ? "hover:bg-[#352F2A]" : "hover:bg-blue-50"}`}
                        title="Update"
                      >
                        <svg
                          className="w-6 h-6 text-blue-500 group-hover:text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProductTable;
