import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import {
  FaBell,
  FaExclamationTriangle,
  FaSearch,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import filterIcon from "../../assets/filter.svg";
import { useAuth } from "../../context/AuthContext";
import { SidebarContext } from "../../context/SidebarContext";
import { useTheme } from "../../context/ThemeContext";

const Header = ({
  pageName,
  subtitle,
  showSearch = false,
  showFilter = false,
  searchValue = "",
  onSearchChange = null,
  userName = "Barbie",
  userRole = "Staff",
  profileBackground = "bg-white",
  showBorder = true,
  className = "",
  hidePageName = false,
  centerProfile = false,
  filterNextToSearch = false,
  profileMinWidth = "300px",
  profilePadding = "px-7",
  profileGap = "gap-4",
  sortOption = "newest",
  onSortChange = null,

  categories = [],
  selectedCategory = "All",
  onCategoryChange = null,

  showTimeframeFilter = false,
  timeframeValue = "Daily",
  onTimeframeChange = null,
  timeframeOptions = ["Daily", "Weekly", "Monthly"],
}) => {
  const { isExpanded: sidebarExpanded } = useContext(SidebarContext) || {
    isExpanded: false,
  };
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [internalSearch, setInternalSearch] = useState(searchValue);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortButtonRef = useRef(null);
  const [dismissedItems, setDismissedItems] = useState(() => {

    try {
      const saved = localStorage.getItem("dismissedLowStockAlerts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });
  const notificationRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("You are back online");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("You are offline. Some features may be unavailable.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);


  const DISMISS_COOLDOWN_MS = 5 * 60 * 60 * 1000;


  const isDismissExpired = (dismissTimestamp) => {
    if (!dismissTimestamp) return true;
    const now = Date.now();
    return now - dismissTimestamp >= DISMISS_COOLDOWN_MS;
  };


  useEffect(() => {
    if (showNotifications && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showNotifications]);


  useEffect(() => {
    const fetchLowStock = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/products/low-stock",
        );
        const data = await response.json();
        if (data.success) {
          const items = data.data || [];
          setLowStockItems(items);


          const currentLowStockIds = new Set(items.map((item) => item._id));
          setDismissedItems((prev) => {
            const updated = { ...prev };
            let changed = false;
            Object.keys(updated).forEach((id) => {

              if (!currentLowStockIds.has(id)) {
                delete updated[id];
                changed = true;
              }

              else if (isDismissExpired(updated[id])) {
                delete updated[id];
                changed = true;
              }
            });
            if (changed) {
              localStorage.setItem(
                "dismissedLowStockAlerts",
                JSON.stringify(updated),
              );
            }
            return changed ? updated : prev;
          });
        }
      } catch (error) {
        console.error("Error fetching low stock items:", error);
      }
    };

    fetchLowStock();

    const interval = setInterval(fetchLowStock, 30000);
    return () => clearInterval(interval);
  }, []);


  const dismissNotification = (e, itemId) => {
    e.stopPropagation();
    setDismissedItems((prev) => {
      const updated = { ...prev, [itemId]: Date.now() };
      localStorage.setItem("dismissedLowStockAlerts", JSON.stringify(updated));
      return updated;
    });
  };


  const visibleLowStockItems = lowStockItems.filter((item) => {
    const dismissTimestamp = dismissedItems[item._id];
    return !dismissTimestamp || isDismissExpired(dismissTimestamp);
  });


  useEffect(() => {
    const handleClickOutside = (event) => {

      const isOutsideDropdown =
        notificationRef.current &&
        !notificationRef.current.contains(event.target);
      const isOutsideButton =
        buttonRef.current && !buttonRef.current.contains(event.target);

      if (isOutsideDropdown && isOutsideButton) {
        setShowNotifications(false);
      }


      if (
        showSortDropdown &&
        sortButtonRef.current &&
        !sortButtonRef.current.contains(event.target)
      ) {
        setShowSortDropdown(false);
      }
    };

    if (showNotifications || showSortDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications, showSortDropdown]);

  useEffect(() => {
    setInternalSearch(searchValue);
  }, [searchValue]);

  const handleSearchChange = (event) => {
    if (onSearchChange) {
      onSearchChange(event);
    } else {
      setInternalSearch(event.target.value);
    }
  };

  const resolvedSearchValue = onSearchChange ? searchValue : internalSearch;
  const fullNameFromUser = (
    currentUser?.name ||
    `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`
  )?.trim();
  const displayName = fullNameFromUser || userName;
  const displayRole = currentUser?.role || userRole;
  const profileImage = currentUser?.profileImage || currentUser?.image || null;
  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    displayName || "User",
  )}&background=AD7F65&color=fff`;
  const profileImageSrc = profileImage || fallbackAvatarUrl;
  return (
    <div
      className={`relative flex items-center justify-between z-[100] ${showBorder ? `mb-6 pb-4 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}` : ""} ${className}`}
    >
      <div className="flex items-center gap-4">
        {showSearch ? (
          <>
            {!hidePageName && (
              <div>
                <h1
                  className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {pageName}
                </h1>
                {subtitle && (
                  <p
                    className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            <div
              className={`relative transition-all duration-300 ease-in-out ${sidebarExpanded ? "w-[480px]" : "w-[700px]"}`}
            >
              <div
                className="absolute left-1 top-1/2 transform -translate-y-1/2 w-10 h-9 flex items-center justify-center text-white rounded-xl"
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
                value={resolvedSearchValue}
                onChange={handleSearchChange}
                className={`w-full h-11 pl-14 pr-4 border rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent transition-colors ${theme === "dark"
                  ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-400"
                  : "bg-white border-gray-300 text-gray-900"
                  }`}
              />
            </div>

            {categories.length > 0 && onCategoryChange && (
              <div className="relative ml-2">
                <select
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className={`h-11 pl-4 pr-8 border rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent transition-colors appearance-none cursor-pointer text-sm font-medium ${theme === "dark"
                    ? "bg-[#2A2724] border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-700"
                    }`}
                  style={{ minWidth: "150px" }}
                >
                  {categories.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name === "All" ? "By Category" : cat.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <svg
                    className={`w-4 h-4 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
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
            )}
            {filterNextToSearch && showFilter && (
              <button
                className={`ml-2 w-12 h-10 rounded-2xl flex items-center justify-center border shadow-[0_8px_16px_rgba(0,0,0,0.12)] hover:shadow-[0_12px_22px_rgba(0,0,0,0.16)] transition-colors ${theme === "dark"
                  ? "bg-[#2A2724] border-gray-600"
                  : "bg-white border-gray-100"
                  }`}
              >
                <img
                  src={filterIcon}
                  alt="Filter"
                  className="w-5 h-5 opacity-90"
                />
              </button>
            )}
          </>
        ) : (
          <>
            {!hidePageName && (
              <div>
                <h1
                  className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {pageName}
                </h1>
                {subtitle && (
                  <p
                    className={`text-sm mt-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            )}
            {/* Timeframe Filter for Dashboard */}
            {showTimeframeFilter && (
              <div
                className="flex gap-2 ml-4"
                role="tablist"
                aria-label="Dashboard timeframe filter"
              >
                {timeframeOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() =>
                      onTimeframeChange && onTimeframeChange(option)
                    }
                    role="tab"
                    aria-selected={timeframeValue === option}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:ring-offset-2 ${timeframeValue === option
                      ? "bg-[#AD7F65] text-white"
                      : theme === "dark"
                        ? "bg-[#2A2724] text-gray-300 hover:bg-[#352F2A]"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {centerProfile && (
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setShowNotifications(!showNotifications)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_26px_rgba(0,0,0,0.16)] relative transition-all`}
                style={theme === "dark" ? { backgroundColor: "#2A2521" } : {}}
              >
                <FaBell
                  className={`text-2xl ${theme === "dark" ? "text-gray-300" : "text-gray-800"}`}
                />
                {visibleLowStockItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                    {visibleLowStockItems.length > 99
                      ? "99+"
                      : visibleLowStockItems.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown for centered profile - Using Portal */}
              {showNotifications &&
                createPortal(
                  <div
                    ref={notificationRef}
                    className={`fixed w-80 rounded-2xl shadow-2xl border overflow-hidden ${theme === "dark"
                      ? "bg-[#2A2724] border-gray-600"
                      : "bg-white border-gray-100"
                      }`}
                    style={{
                      top: dropdownPosition.top,
                      right: dropdownPosition.right,
                      zIndex: 99999,
                    }}
                  >
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === "dark" ? "border-gray-600 text-white" : "border-gray-100 text-gray-800"}`}>
                      <span className="font-semibold">Stock Alerts</span>
                      <button
                        onClick={() => setShowNotifications(false)}
                        className={`rounded-full p-1 transition-colors ${theme === "dark" ? "hover:bg-gray-700 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}`}
                      >
                        <FaTimes className="text-sm" />
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {visibleLowStockItems.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <FaBell className="text-4xl mx-auto mb-2 text-gray-300" />
                          <p>No stock alerts</p>
                        </div>
                      ) : (
                        visibleLowStockItems.map((item) => (
                          <div
                            key={item._id}
                            className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                          >
                            <div
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                              onClick={() => {
                                setShowNotifications(false);
                                navigate("/inventory");
                              }}
                            >
                              <div
                                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.alertType === "out_of_stock"
                                  ? "bg-red-100"
                                  : "bg-orange-100"
                                  }`}
                              >
                                {item.alertType === "out_of_stock" ? (
                                  <FaTimesCircle className="text-red-500" />
                                ) : (
                                  <FaExclamationTriangle className="text-orange-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {item.itemName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  SKU: {item.sku}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p
                                  className={`text-sm font-bold ${item.alertType === "out_of_stock" ? "text-red-600" : "text-orange-500"}`}
                                >
                                  {item.currentStock}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {item.alertType === "out_of_stock"
                                    ? "out of stock"
                                    : "low stock"}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => dismissNotification(e, item._id)}
                              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                              title="Dismiss"
                            >
                              <FaTimes className="text-gray-400 text-xs" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    {visibleLowStockItems.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            navigate("/inventory");
                          }}
                          className="w-full text-center text-sm text-[#76462B] font-medium hover:underline"
                        >
                          View All in Inventory
                        </button>
                      </div>
                    )}
                  </div>,
                  document.body,
                )}
            </div>
            <div
              onClick={() => navigate('/settings')}
              className={`flex items-center cursor-pointer ${profileGap} ${profilePadding} py-2.5 rounded-full border shadow-[0_6px_14px_rgba(0,0,0,0.15)]`}
              style={{
                minWidth: profileMinWidth,
                ...(theme === "dark"
                  ? {
                    background: "rgba(42, 37, 33, 0.9)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid #3A332E",
                  }
                  : {}),
              }}
            >
              <div className="relative">
                <img
                  src={profileImageSrc}
                  alt="User"
                  className={`w-10 h-10 rounded-full ring-2 shadow-sm object-cover ${theme === "dark" ? "ring-gray-600" : "ring-white"}`}
                />
                <div
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${theme === "dark" ? "border-[#2A2521]" : "border-white"} ${isOnline ? "bg-green-500" : "bg-red-500"}`}
                  title={isOnline ? "Online" : "Offline"}
                />
              </div>
              <div>
                <div
                  className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
                >
                  {displayName}
                </div>
                <div
                  className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                >
                  {displayRole}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-5">
        {!centerProfile && showFilter && !filterNextToSearch && (
          <div className="relative" ref={sortButtonRef}>
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_26px_rgba(0,0,0,0.16)] ${sortOption !== "newest"
                ? "border-[#AD7F65] bg-[#AD7F65]/10"
                : theme === "dark"
                  ? "bg-[#2A2724] border-gray-600"
                  : "bg-white border-gray-100"
                }`}
            >
              <img
                src={filterIcon}
                alt="Filter"
                className={`w-5 h-5 ${theme === "dark" ? "opacity-90 invert" : "opacity-90"}`}
              />
            </button>

            {/* Sort Dropdown */}
            {showSortDropdown && (
              <div
                className={`absolute top-full right-0 mt-2 w-48 rounded-xl shadow-2xl border overflow-hidden z-[9999] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600" : "bg-white border-gray-200"}`}
              >
                <div
                  className={`px-3 py-2 border-b ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-gray-50 border-gray-200"}`}
                >
                  <span
                    className={`text-xs font-semibold ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                  >
                    Sort By
                  </span>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => {
                      onSortChange && onSortChange("a-z");
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${sortOption === "a-z"
                      ? "text-[#AD7F65] font-medium bg-[#AD7F65]/5"
                      : theme === "dark"
                        ? "text-gray-300 hover:bg-[#2A2724]"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    Name (A-Z)
                    {sortOption === "a-z" && (
                      <span className="text-[#AD7F65]">✓</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSortChange && onSortChange("z-a");
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${sortOption === "z-a"
                      ? "text-[#AD7F65] font-medium bg-[#AD7F65]/5"
                      : theme === "dark"
                        ? "text-gray-300 hover:bg-[#2A2724]"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    Name (Z-A)
                    {sortOption === "z-a" && (
                      <span className="text-[#AD7F65]">✓</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSortChange && onSortChange("newest");
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${sortOption === "newest"
                      ? "text-[#AD7F65] font-medium bg-[#AD7F65]/5"
                      : theme === "dark"
                        ? "text-gray-300 hover:bg-[#2A2724]"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    Newest First
                    {sortOption === "newest" && (
                      <span className="text-[#AD7F65]">✓</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onSortChange && onSortChange("oldest");
                      setShowSortDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${sortOption === "oldest"
                      ? "text-[#AD7F65] font-medium bg-[#AD7F65]/5"
                      : theme === "dark"
                        ? "text-gray-300 hover:bg-[#2A2724]"
                        : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    Oldest First
                    {sortOption === "oldest" && (
                      <span className="text-[#AD7F65]">✓</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!centerProfile && (
          <div className="relative" ref={notificationRef}>
            <button
              ref={buttonRef}
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-[0_10px_20px_rgba(0,0,0,0.12)] hover:shadow-[0_14px_26px_rgba(0,0,0,0.16)] relative transition-all"
              style={
                theme === "dark"
                  ? { backgroundColor: "#2A2521" }
                  : { backgroundColor: "white" }
              }
            >
              <FaBell
                className={`text-2xl ${theme === "dark" ? "text-gray-300" : "text-gray-800"}`}
              />
              {visibleLowStockItems.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
                  {visibleLowStockItems.length > 99
                    ? "99+"
                    : visibleLowStockItems.length}
                </span>
              )}
            </button>

            {/* Notification Dropdown - Using Portal */}
            {showNotifications &&
              createPortal(
                <div
                  ref={notificationRef}
                  className="fixed w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
                  style={{
                    top: dropdownPosition.top,
                    right: dropdownPosition.right,
                    zIndex: 99999,
                  }}
                >
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${theme === "dark" ? "border-gray-600 text-white" : "border-gray-100 text-gray-800"}`}>
                    <span className="font-semibold">Stock Alerts</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className={`rounded-full p-1 transition-colors ${theme === "dark" ? "hover:bg-gray-700 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"}`}
                    >
                      <FaTimes className="text-sm" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {visibleLowStockItems.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-500">
                        <FaBell className="text-4xl mx-auto mb-2 text-gray-300" />
                        <p>No stock alerts</p>
                      </div>
                    ) : (
                      visibleLowStockItems.map((item) => (
                        <div
                          key={item._id}
                          className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                        >
                          <div
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => {
                              setShowNotifications(false);
                              navigate("/inventory");
                            }}
                          >
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${item.alertType === "out_of_stock"
                                ? "bg-red-100"
                                : "bg-orange-100"
                                }`}
                            >
                              {item.alertType === "out_of_stock" ? (
                                <FaTimesCircle className="text-red-500" />
                              ) : (
                                <FaExclamationTriangle className="text-orange-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {item.itemName}
                              </p>
                              <p className="text-xs text-gray-500">
                                SKU: {item.sku}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p
                                className={`text-sm font-bold ${item.alertType === "out_of_stock" ? "text-red-600" : "text-orange-500"}`}
                              >
                                {item.currentStock}
                              </p>
                              <p className="text-xs text-gray-400">
                                {item.alertType === "out_of_stock"
                                  ? "out of stock"
                                  : "low stock"}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => dismissNotification(e, item._id)}
                            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0"
                            title="Dismiss"
                          >
                            <FaTimes className="text-gray-400 text-xs" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  {visibleLowStockItems.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/inventory");
                        }}
                        className="w-full text-center text-sm text-[#76462B] font-medium hover:underline"
                      >
                        View All in Inventory
                      </button>
                    </div>
                  )}
                </div>,
                document.body,
              )}
          </div>
        )}
        {!centerProfile && (
          <div
            onClick={() => navigate('/settings')}
            className={`flex items-center cursor-pointer ${profileGap} ${profilePadding} py-2.5 rounded-full shadow-[0_6px_14px_rgba(0,0,0,0.15)] ${theme === "dark" ? "border" : ""
              }`}
            style={{
              minWidth: profileMinWidth,
              ...(theme === "dark"
                ? {
                  background: "rgba(42, 37, 33, 0.9)",
                  backdropFilter: "blur(6px)",
                  border: "1px solid #3A332E",
                }
                : {}),
            }}
          >
            <div className="relative">
              <img
                src={profileImageSrc}
                alt="User"
                className={`w-10 h-10 rounded-full ring-2 shadow-sm object-cover ${theme === "dark" ? "ring-gray-600" : "ring-white"}`}
              />
              <div
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${theme === "dark" ? "border-white" : "border-white"} ${isOnline ? "bg-green-500" : "bg-red-500"}`}
                title={isOnline ? "Online" : "Offline"}
              />
            </div>
            <div>
              <div
                className={`text-sm font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}
              >
                {displayName}
              </div>
              <div
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
              >
                {displayRole}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
