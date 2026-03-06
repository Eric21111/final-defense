import { useEffect, useState } from "react";
import {
    FaBox,
    FaCalendar,
    FaSearch,
    FaTag,
    FaTimes,
    FaUsers,
} from "react-icons/fa";
import filterIcon from "../../assets/filter.svg";
import { useTheme } from "../../context/ThemeContext";

const icon20Percent = new URL("../../assets/owner/20.png", import.meta.url)
  .href;
const icon50Percent = new URL("../../assets/owner/50.png", import.meta.url)
  .href;
const iconSenior = new URL("../../assets/owner/Senior&ani.png", import.meta.url)
  .href;

const DiscountModal = ({
  isOpen,
  onClose,
  onSelectDiscount,
  cart = [],
  products = [],
  selectedDiscounts = [],
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState("all"); // 'all', 'today', 'this_week', 'this_month', 'permanent'

  // Helper function to determine icon and colors based on discount data
  const getDiscountIcon = (discount) => {
    const title = discount.title?.toLowerCase() || "";
    const discountValue = discount.discountValue || "";

    if (title.includes("senior")) {
      return {
        icon: iconSenior,
        iconColor: "linear-gradient(135deg, #9B59B6 0%, #E91E63 100%)",
      };
    }

    // Extract numeric value from discountValue
    const match = discountValue.match(/(\d+)/);
    if (match) {
      const value = parseInt(match[1]);
      if (value >= 50) {
        return {
          icon: icon50Percent,
          iconColor: "linear-gradient(135deg, #6B7280 0%, #4B5563 100%)",
        };
      }
    }

    return {
      icon: icon20Percent,
      iconColor: "linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)",
    };
  };

  // Fetch discounts from API
  useEffect(() => {
    if (isOpen) {
      fetchDiscounts();
    }
  }, [isOpen]);

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:5000/api/discounts");
      const data = await response.json();

      if (data.success) {
        // Format discounts with icons and colors, filter only active ones
        const formattedDiscounts = data.data
          .filter((discount) => discount.status === "active")
          .map((discount) => {
            const iconData = getDiscountIcon(discount);
            return {
              ...discount,
              ...iconData,
            };
          });
        setDiscounts(formattedDiscounts);
      }
    } catch (error) {
      console.error("Error fetching discounts:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if discount applies to cart items
  const discountAppliesToCart = (discount) => {
    // Use appliesToType for logic checks (original value: 'all', 'category', 'products')
    // Use appliesTo for display (formatted text: 'All Products', 'Category: Tops', etc.)
    const appliesToType = discount.appliesToType || discount.appliesTo;

    // If cart is empty, only show "all" discounts
    if (!cart || cart.length === 0) {
      return appliesToType === "all";
    }

    // If discount applies to all products, it's always valid
    if (appliesToType === "all") {
      return true;
    }

    // If discount applies to a specific category
    if (appliesToType === "category" && discount.category) {
      // Check if ANY cart item is from the same category as the discount
      const hasMatchingItem = cart.some((item) => {
        // First check if item has category field
        let itemCategory = item.category;

        // If not, try to find it from products array
        if (!itemCategory) {
          const productId = item._id || item.productId || item.id;
          const product = products.find((p) => {
            const pId = p._id || p.id;
            return pId && productId && pId.toString() === productId.toString();
          });
          itemCategory = product?.category;
        }

        // Check if item's category matches the discount category
        return itemCategory === discount.category;
      });

      return hasMatchingItem;
    }

    // If discount applies to specific products
    if (
      appliesToType === "products" &&
      discount.productIds &&
      discount.productIds.length > 0
    ) {
      // Check if ANY cart item is in the discount's product list
      const hasMatchingItem = cart.some((item) => {
        const itemId = item._id || item.productId || item.id;
        return discount.productIds.some((pid) => {
          const pidStr = pid.toString ? pid.toString() : pid;
          const itemIdStr = itemId.toString ? itemId.toString() : itemId;
          return pidStr === itemIdStr;
        });
      });

      return hasMatchingItem;
    }

    return false;
  };

  const filteredDiscounts = discounts.filter((discount) => {
    // First filter by search query
    const matchesSearch =
      discount.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      discount.discountValue.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Filter out already selected discounts
    const alreadySelected = selectedDiscounts.some(
      (d) => d._id === discount._id,
    );
    if (alreadySelected) return false;

    // Filter by date
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (dateFilter === "permanent") {
        if (discount.validFrom !== "Permanent") return false;
      } else {
        if (discount.validFrom === "Permanent") {
          // Permanent discounts are always valid, include them
        } else {
          const from = new Date(discount.validFrom);
          const to = discount.validTo ? new Date(discount.validTo) : null;

          if (dateFilter === "today") {
            const endOfToday = new Date(today);
            endOfToday.setDate(endOfToday.getDate() + 1);
            if (from > endOfToday || (to && to < today)) return false;
          } else if (dateFilter === "this_week") {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(endOfWeek.getDate() + 7);
            if (from > endOfWeek || (to && to < startOfWeek)) return false;
          } else if (dateFilter === "this_month") {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              0,
            );
            if (from > endOfMonth || (to && to < startOfMonth)) return false;
          }
        }
      }
    }

    // Then filter by whether it applies to cart
    return discountAppliesToCart(discount);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4">
      <div
        className={`rounded-2xl w-full max-w-md h-[95vh] flex flex-col shadow-2xl ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
      >
        <div
          className={`px-6 py-4 border-b flex items-center justify-between ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
        >
          <h2
            className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
          >
            Discounts
          </h2>
          <button
            onClick={onClose}
            className={`transition-colors ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        <div
          className={`px-6 py-4 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}
        >
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <div
                className="absolute left-1 top-1/2 transform -translate-y-1/2 w-10 h-9 flex items-center justify-center text-white rounded-lg"
                style={{
                  background:
                    "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)",
                }}
              >
                <FaSearch className="text-sm" />
              </div>
              <input
                type="text"
                placeholder="Search For..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full h-10 pl-14 pr-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "border-gray-300 bg-white text-gray-900"}`}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-sm hover:shadow-md transition-shadow ${
                  dateFilter !== "all"
                    ? "border-[#AD7F65] bg-[#AD7F65]/10"
                    : theme === "dark"
                      ? "bg-[#2A2724] border-gray-600"
                      : "bg-white border-gray-200"
                }`}
              >
                <img
                  src={filterIcon}
                  alt="Filter"
                  className={`w-5 h-5 ${theme === "dark" ? "opacity-90 invert" : "opacity-90"}`}
                />
              </button>
              {showDateFilter && (
                <div
                  className={`absolute top-full right-0 mt-2 w-44 rounded-xl shadow-2xl border overflow-hidden z-50 ${theme === "dark" ? "bg-[#1E1B18] border-gray-600" : "bg-white border-gray-200"}`}
                >
                  <div
                    className={`px-3 py-2 border-b ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-gray-50 border-gray-200"}`}
                  >
                    <span
                      className={`text-xs font-semibold ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                    >
                      Filter by Date
                    </span>
                  </div>
                  <div className="py-1">
                    {[
                      { value: "all", label: "All" },
                      { value: "today", label: "Valid Today" },
                      { value: "this_week", label: "This Week" },
                      { value: "this_month", label: "This Month" },
                      { value: "permanent", label: "Permanent" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setDateFilter(opt.value);
                          setShowDateFilter(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                          dateFilter === opt.value
                            ? "text-[#AD7F65] font-medium bg-[#AD7F65]/5"
                            : theme === "dark"
                              ? "text-gray-300 hover:bg-[#2A2724]"
                              : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {opt.label}
                        {dateFilter === opt.value && (
                          <span className="text-[#AD7F65]">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div
                className={theme === "dark" ? "text-gray-400" : "text-gray-500"}
              >
                Loading discounts...
              </div>
            </div>
          ) : filteredDiscounts.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-12">
              <div
                className={`text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                {cart.length === 0
                  ? "Add items to your cart to see applicable discounts"
                  : searchQuery
                    ? "No discounts match your search"
                    : "No discounts available for items in your cart"}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDiscounts.map((discount) => (
                <div
                  key={discount._id}
                  onClick={() => {
                    onSelectDiscount(discount);
                    onClose();
                  }}
                  className={`rounded-xl overflow-hidden border shadow-md flex items-stretch cursor-pointer hover:shadow-lg transition-shadow min-h-[85px] ${theme === "dark" ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-white"}`}
                >
                  <div
                    className="w-16 flex items-center justify-center shrink-0 rounded-l-xl"
                    style={{ background: discount.iconColor }}
                  >
                    <img
                      src={discount.icon}
                      alt={discount.title}
                      className="w-12 h-12 object-contain"
                    />
                  </div>

                  <div
                    className={`flex-1 p-2 flex flex-col justify-between ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <h3
                          className="text-base font-bold"
                          style={{ color: "#76462B" }}
                        >
                          {discount.title}
                        </h3>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700">
                          {discount.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-1">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px]">
                            <FaTag className="text-yellow-500 text-xs" />
                            <span
                              className={
                                theme === "dark"
                                  ? "text-gray-300"
                                  : "text-gray-600"
                              }
                            >
                              Discount Value:{" "}
                              <span
                                className="font-bold"
                                style={{ color: "#AD7F65" }}
                              >
                                {discount.discountValue}
                              </span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[10px]">
                            <FaCalendar className="text-purple-500 text-xs" />
                            <span
                              className={
                                theme === "dark"
                                  ? "text-gray-300"
                                  : "text-gray-600"
                              }
                            >
                              Valid only from:{" "}
                              <span
                                className="font-bold"
                                style={{ color: "#AD7F65" }}
                              >
                                {discount.validFrom === "Permanent"
                                  ? "Permanent"
                                  : `${discount.validFrom} to ${discount.validTo}`}
                              </span>
                            </span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[10px]">
                            <FaBox className="text-blue-400 text-xs" />
                            <span
                              className={
                                theme === "dark"
                                  ? "text-gray-300"
                                  : "text-gray-600"
                              }
                            >
                              Applies to:{" "}
                              <span
                                className="font-bold"
                                style={{ color: "#AD7F65" }}
                              >
                                {discount.appliesTo}
                              </span>
                            </span>
                          </div>

                          {discount.usage && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <FaUsers className="text-green-500 text-xs" />
                              <span
                                className={
                                  theme === "dark"
                                    ? "text-gray-300"
                                    : "text-gray-600"
                                }
                              >
                                Used:{" "}
                                <span
                                  className="font-bold"
                                  style={{ color: "#AD7F65" }}
                                >
                                  {discount.usage.used}/{discount.usage.total}
                                </span>{" "}
                                times
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {discount.description && (
                      <div
                        className="text-[10px] italic"
                        style={{ color: "#AD7F65" }}
                      >
                        {discount.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DiscountModal;
