import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import inventoryIcon from "../../assets/icons/invenory.svg";
import logoutIcon from "../../assets/icons/Logout.svg";
import settingsIcon from "../../assets/icons/Settings.svg";
import terminalIcon from "../../assets/icons/terminal.svg";
import transactionIcon from "../../assets/icons/transaction.svg";
import dashboardIcon from "../../assets/owner/dashboard.svg";
import manageIcon from "../../assets/owner/manage.svg";
import reportsIcon from "../../assets/owner/reports.svg";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import LogoutConfirmationModal from "./LogoutConfirmationModal";

import logo from "../../assets/logo.png";

// Tooltip component that renders outside the sidebar using portal
const SidebarTooltip = ({ label, targetRef, show, theme }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (show && targetRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      });
    }
  }, [show, targetRef]);

  if (!show) return null;

  return createPortal(
    <div
      className={`fixed px-3 py-2 rounded-lg text-sm font-medium shadow-lg whitespace-nowrap z-[9999] transform -translate-y-1/2 pointer-events-none ${
        theme === "dark"
          ? "bg-[#2A2724] text-gray-200 border border-[#4A4037]"
          : "bg-white text-gray-700"
      }`}
      style={{
        top: position.top,
        left: position.left,
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
      }}
    >
      {label}
    </div>,
    document.body,
  );
};

const Sidebar = ({ isExpanded, setIsExpanded }) => {
  const location = useLocation();
  const { theme } = useTheme();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  const [posExpanded, setPosExpanded] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);
  const itemRefs = useRef({});
  const { logout, isOwner, hasPermission } = useAuth();

  // Define all menu items in the correct order
  const allMenuItems = [
    {
      name: "Dashboard",
      icon: dashboardIcon,
      path: "/dashboard",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: true,
      requiredPermission: null, // Owner only, no permission check needed
    },
    {
      name: "POS",
      icon: terminalIcon,
      path: "/terminal",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: false,
      requiredPermission: "posTerminal",
    },
    {
      name: "Inventory",
      icon: inventoryIcon,
      path: "/inventory",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: false,
      requiredPermission: "inventory",
    },
    {
      name: "Transactions",
      icon: transactionIcon,
      path: "/transactions",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: false,
      requiredPermission: "viewTransactions",
    },
    {
      name: "Reports / Analytics",
      icon: reportsIcon,
      path: "/reports",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: false,
      requiredPermission: "generateReports",
    },
    {
      name: "Manage Employees",
      icon: manageIcon,
      path: "/manage-employees",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: true,
      requiredPermission: null, // Owner only
    },
    {
      name: "Settings",
      icon: settingsIcon,
      path: "/settings",
      gradient:
        "linear-gradient(135deg, #C2A68C 0%, #AD7F65 50%, #76462B 100%)",
      ownerOnly: false,
      requiredPermission: null, // Everyone can access settings
    },
  ];

  // Filter menu items based on user role and permissions
  const menuItems = allMenuItems.filter((item) => {
    // Owner has access to everything
    if (isOwner()) {
      return true;
    }

    // If item is owner-only and user is not owner, hide it
    if (item.ownerOnly) {
      return false;
    }

    // If no permission required, show it
    if (!item.requiredPermission) {
      return true;
    }

    // Check if user has the required permission
    return hasPermission(item.requiredPermission);
  });

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    console.log("Logging out...");
    setShowLogoutModal(false);
    logout();
    // Navigation will be handled by the logout redirect in AuthContext
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Check if any inventory sub-route is active
  const isInventoryActive = () => {
    const inventoryPaths = [
      "/inventory",
      "/stock-movement",
      "/brand-partners",
      "/categories",
    ];
    return inventoryPaths.some((path) => location.pathname === path);
  };

  // Check if any POS/Transaction sub-route is active
  const isPosActive = () => {
    const posPaths = ["/terminal", "/discount-management"];
    return posPaths.some((path) => location.pathname === path);
  };

  // Inventory sub-menu items
  const inventorySubItems = [
    { name: "Products", path: "/inventory" },
    { name: "Logs", path: "/stock-movement" },
    { name: "Brand Partners", path: "/brand-partners" },
    { name: "Categories", path: "/categories" },
  ];

  const posSubItems = [
    { name: "Terminal", path: "/terminal" },

    { name: "Discount Management", path: "/discount-management" },
  ];

  // Auto-expand inventory if on any inventory sub-route
  useEffect(() => {
    const inventoryPaths = [
      "/inventory",
      "/stock-movement",
      "/brand-partners",
      "/categories",
    ];
    if (inventoryPaths.some((path) => location.pathname === path)) {
      setInventoryExpanded(true);
    }
  }, [location.pathname]);

  // Auto-expand POS if on any POS sub-route
  useEffect(() => {
    const posPaths = ["/terminal", "/discount-management"];
    if (posPaths.some((path) => location.pathname === path)) {
      setPosExpanded(true);
    }
  }, [location.pathname]);

  return (
    <>
      <div
        className={`fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out z-50 flex flex-col cursor-pointer ${
          isExpanded ? "w-70" : "w-20"
        } ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
        style={{
          borderRadius: "0 30px 30px 0",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.2)",
        }}
        onClick={() => {
          // Toggle sidebar - clicking anywhere expands/collapses it
          setIsExpanded(!isExpanded);
        }}
      >
        <div
          className={`relative flex items-center px-4 py-4 overflow-hidden ${isExpanded ? "" : "justify-center"}`}
          style={{ minHeight: "120px" }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Hamburger Menu Button - on the left side */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className={`p-2 rounded-lg transition-all duration-300 shrink-0 z-10 ${
              theme === "dark" ? "hover:bg-[#352F2A]" : "hover:bg-gray-100"
            }`}
          >
            <div className="flex flex-col justify-center items-center w-6 h-6 shrink-0">
              <span
                className={`block h-0.5 w-5 rounded transition-all duration-300 ${
                  theme === "dark" ? "bg-gray-400" : "bg-gray-600"
                }`}
              ></span>
              <span
                className={`block h-0.5 w-5 rounded transition-all duration-300 my-1 ${
                  theme === "dark" ? "bg-gray-400" : "bg-gray-600"
                }`}
              ></span>
              <span
                className={`block h-0.5 w-5 rounded transition-all duration-300 ${
                  theme === "dark" ? "bg-gray-400" : "bg-gray-600"
                }`}
              ></span>
            </div>
          </button>

          {/* Logo - only shown when expanded, positioned after hamburger */}
          {isExpanded && (
            <div className="flex-1 flex items-center justify-center pointer-events-none">
              <img
                src={logo}
                alt="Create Your Style Logo"
                className="h-20 w-auto object-contain transition-all duration-300"
                style={{
                  filter:
                    "invert(53%) sepia(23%) saturate(828%) hue-rotate(343deg) brightness(92%) contrast(91%)",
                }}
              />
            </div>
          )}
        </div>

        <nav
          className={`flex-1 pb-8 px-2 ${
            isExpanded
              ? "pt-15 overflow-y-auto overflow-x-hidden"
              : "pt-15 overflow-visible"
          }`}
        >
          <div className="space-y-3">
            {menuItems.map((item) => {
              if (item.name === "POS") {
                const posActive = isPosActive();
                const hasPosPermission =
                  isOwner() || hasPermission("posTerminal");

                if (!hasPosPermission) return null;

                return (
                  <div key={item.path} className="space-y-1">
                    {isExpanded ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPosExpanded(!posExpanded);
                        }}
                        className={`w-full flex items-center justify-between rounded-2xl transition-all duration-300 group relative overflow-hidden py-3.5 ${
                          posActive
                            ? "shadow-lg"
                            : theme === "dark"
                              ? "hover:bg-[#352F2A]"
                              : "hover:bg-gray-50"
                        }`}
                        style={
                          posActive
                            ? {
                                background: item.gradient,
                                boxShadow: "0 4px 12px rgba(118, 70, 43, 0.25)",
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center flex-1">
                          <div className="shrink-0 w-7 h-7 flex items-center justify-center ml-4">
                            <img
                              src={item.icon}
                              alt={item.name}
                              className={`w-6 h-6 transition-all duration-300 ${
                                posActive
                                  ? "brightness-0 invert"
                                  : theme === "dark"
                                    ? "brightness-0 invert opacity-90 group-hover:opacity-100"
                                    : "opacity-80 group-hover:opacity-100"
                              }`}
                            />
                          </div>

                          {isExpanded && (
                            <span
                              className={`font-medium transition-all duration-300 whitespace-nowrap ml-4 ${
                                posActive
                                  ? "text-white"
                                  : theme === "dark"
                                    ? "text-gray-200 group-hover:text-[#C2A68C]"
                                    : "text-gray-800 group-hover:text-[#76462B]"
                              }`}
                              style={{
                                fontSize: "16px",
                              }}
                            >
                              {item.name}
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <svg
                            className={`w-5 h-5 mr-4 transition-transform duration-300 ${
                              posExpanded ? "rotate-180" : ""
                            } ${posActive ? "text-white" : theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
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
                        )}

                        {posActive && (
                          <div
                            className="absolute inset-0 rounded-2xl"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.08) 100%)",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </button>
                    ) : (
                      <Link
                        to="/terminal"
                        ref={(el) => (itemRefs.current["pos-terminal"] = el)}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onMouseEnter={() =>
                          !isExpanded && setHoveredItem("pos-terminal")
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`w-full flex items-center justify-between rounded-2xl transition-all duration-300 group relative overflow-hidden py-3.5 ${
                          posActive
                            ? "shadow-lg"
                            : theme === "dark"
                              ? "hover:bg-[#352F2A]"
                              : "hover:bg-gray-50"
                        }`}
                        style={
                          posActive
                            ? {
                                background: item.gradient,
                                boxShadow: "0 4px 12px rgba(118, 70, 43, 0.25)",
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center flex-1">
                          <div className="shrink-0 w-7 h-7 flex items-center justify-center ml-4 relative">
                            <img
                              src={item.icon}
                              alt={item.name}
                              className={`w-6 h-6 transition-all duration-300 ${
                                posActive
                                  ? "brightness-0 invert"
                                  : theme === "dark"
                                    ? "brightness-0 invert opacity-90 group-hover:opacity-100"
                                    : "opacity-80 group-hover:opacity-100"
                              }`}
                            />
                          </div>
                        </div>
                        <SidebarTooltip
                          label={item.name}
                          targetRef={{
                            current: itemRefs.current["pos-terminal"],
                          }}
                          show={hoveredItem === "pos-terminal" && !isExpanded}
                          theme={theme}
                        />
                        {posActive && (
                          <div
                            className="absolute inset-0 rounded-2xl"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.08) 100%)",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </Link>
                    )}

                    {/* Sub-menu items */}
                    {isExpanded && posExpanded && (
                      <div className="ml-4 space-y-1">
                        {posSubItems.map((subItem) => {
                          const subActive = isActive(subItem.path);
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className={`w-full flex items-center rounded-lg transition-all duration-300 group relative overflow-hidden py-2.5 ${
                                subActive
                                  ? theme === "dark"
                                    ? "bg-[#352F2A]"
                                    : "bg-[#F5E6D3]"
                                  : theme === "dark"
                                    ? "hover:bg-[#352F2A]"
                                    : "hover:bg-gray-50"
                              }`}
                            >
                              {subActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8B7355] rounded-r"></div>
                              )}
                              <span
                                className={`font-medium transition-all duration-300 whitespace-nowrap ml-6 ${
                                  subActive
                                    ? theme === "dark"
                                      ? "text-[#C2A68C] font-semibold"
                                      : "text-[#76462B] font-semibold"
                                    : theme === "dark"
                                      ? "text-gray-300 group-hover:text-[#C2A68C]"
                                      : "text-gray-700 group-hover:text-[#76462B]"
                                }`}
                                style={{
                                  fontSize: "15px",
                                }}
                              >
                                {subItem.name}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Special handling for Inventory dropdown
              if (item.name === "Inventory") {
                const inventoryActive = isInventoryActive();
                const hasInventoryPermission =
                  isOwner() || hasPermission("inventory");

                if (!hasInventoryPermission) return null;

                return (
                  <div key={item.path} className="space-y-1">
                    {isExpanded ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInventoryExpanded(!inventoryExpanded);
                        }}
                        className={`w-full flex items-center justify-between rounded-2xl transition-all duration-300 group relative overflow-hidden py-3.5 ${
                          inventoryActive
                            ? "shadow-lg"
                            : theme === "dark"
                              ? "hover:bg-[#352F2A]"
                              : "hover:bg-gray-50"
                        }`}
                        style={
                          inventoryActive
                            ? {
                                background: item.gradient,
                                boxShadow: "0 4px 12px rgba(118, 70, 43, 0.25)",
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center flex-1">
                          <div className="shrink-0 w-7 h-7 flex items-center justify-center ml-4">
                            <img
                              src={item.icon}
                              alt={item.name}
                              className={`w-6 h-6 transition-all duration-300 ${
                                inventoryActive
                                  ? "brightness-0 invert"
                                  : theme === "dark"
                                    ? "brightness-0 invert opacity-90 group-hover:opacity-100"
                                    : "opacity-80 group-hover:opacity-100"
                              }`}
                            />
                          </div>

                          {isExpanded && (
                            <span
                              className={`font-medium transition-all duration-300 whitespace-nowrap ml-4 ${
                                inventoryActive
                                  ? "text-white"
                                  : theme === "dark"
                                    ? "text-gray-200 group-hover:text-[#C2A68C]"
                                    : "text-gray-800 group-hover:text-[#76462B]"
                              }`}
                              style={{
                                fontSize: "16px",
                              }}
                            >
                              {item.name}
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <svg
                            className={`w-5 h-5 mr-4 transition-transform duration-300 ${
                              inventoryExpanded ? "rotate-180" : ""
                            } ${inventoryActive ? "text-white" : theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
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
                        )}

                        {inventoryActive && (
                          <div
                            className="absolute inset-0 rounded-2xl"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.08) 100%)",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </button>
                    ) : (
                      <Link
                        to="/inventory"
                        ref={(el) => (itemRefs.current["inventory"] = el)}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onMouseEnter={() =>
                          !isExpanded && setHoveredItem("inventory")
                        }
                        onMouseLeave={() => setHoveredItem(null)}
                        className={`w-full flex items-center justify-between rounded-2xl transition-all duration-300 group relative overflow-hidden py-3.5 ${
                          inventoryActive
                            ? "shadow-lg"
                            : theme === "dark"
                              ? "hover:bg-[#352F2A]"
                              : "hover:bg-gray-50"
                        }`}
                        style={
                          inventoryActive
                            ? {
                                background: item.gradient,
                                boxShadow: "0 4px 12px rgba(118, 70, 43, 0.25)",
                              }
                            : {}
                        }
                      >
                        <div className="flex items-center flex-1">
                          <div className="shrink-0 w-7 h-7 flex items-center justify-center ml-4 relative">
                            <img
                              src={item.icon}
                              alt={item.name}
                              className={`w-6 h-6 transition-all duration-300 ${
                                inventoryActive
                                  ? "brightness-0 invert"
                                  : theme === "dark"
                                    ? "brightness-0 invert opacity-90 group-hover:opacity-100"
                                    : "opacity-80 group-hover:opacity-100"
                              }`}
                            />
                          </div>
                        </div>
                        <SidebarTooltip
                          label={item.name}
                          targetRef={{ current: itemRefs.current["inventory"] }}
                          show={hoveredItem === "inventory" && !isExpanded}
                          theme={theme}
                        />
                        {inventoryActive && (
                          <div
                            className="absolute inset-0 rounded-2xl"
                            style={{
                              background:
                                "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.08) 100%)",
                              pointerEvents: "none",
                            }}
                          />
                        )}
                      </Link>
                    )}

                    {/* Sub-menu items */}
                    {isExpanded && inventoryExpanded && (
                      <div className="ml-4 space-y-1">
                        {inventorySubItems.map((subItem) => {
                          const subActive = isActive(subItem.path);
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className={`w-full flex items-center rounded-lg transition-all duration-300 group relative overflow-hidden py-2.5 ${
                                subActive
                                  ? theme === "dark"
                                    ? "bg-[#352F2A]"
                                    : "bg-[#F5E6D3]"
                                  : theme === "dark"
                                    ? "hover:bg-[#352F2A]"
                                    : "hover:bg-gray-50"
                              }`}
                            >
                              {subActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8B7355] rounded-r"></div>
                              )}
                              <span
                                className={`font-medium transition-all duration-300 whitespace-nowrap ml-6 ${
                                  subActive
                                    ? theme === "dark"
                                      ? "text-[#C2A68C] font-semibold"
                                      : "text-[#76462B] font-semibold"
                                    : theme === "dark"
                                      ? "text-gray-300 group-hover:text-[#C2A68C]"
                                      : "text-gray-700 group-hover:text-[#76462B]"
                                }`}
                                style={{
                                  fontSize: "15px",
                                }}
                              >
                                {subItem.name}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular menu items (non-Inventory)
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  ref={(el) => (itemRefs.current[item.path] = el)}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseEnter={() => !isExpanded && setHoveredItem(item.path)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`w-full flex items-center rounded-2xl transition-all duration-300 group relative overflow-hidden py-3.5 ${
                    active
                      ? "shadow-lg"
                      : theme === "dark"
                        ? "hover:bg-[#352F2A]"
                        : "hover:bg-gray-50"
                  }`}
                  style={
                    active
                      ? {
                          background: item.gradient,
                          boxShadow: "0 4px 12px rgba(118, 70, 43, 0.25)",
                        }
                      : {}
                  }
                >
                  <div className="shrink-0 w-7 h-7 flex items-center justify-center ml-4 relative">
                    <img
                      src={item.icon}
                      alt={item.name}
                      className={`w-6 h-6 transition-all duration-300 ${
                        active
                          ? "brightness-0 invert"
                          : theme === "dark"
                            ? "brightness-0 invert opacity-90 group-hover:opacity-100"
                            : "opacity-80 group-hover:opacity-100"
                      }`}
                    />
                  </div>

                  <SidebarTooltip
                    label={item.name}
                    targetRef={{ current: itemRefs.current[item.path] }}
                    show={hoveredItem === item.path && !isExpanded}
                    theme={theme}
                  />

                  {isExpanded && (
                    <span
                      className={`font-medium transition-all duration-300 whitespace-nowrap ml-4 ${
                        active
                          ? "text-white"
                          : theme === "dark"
                            ? "text-gray-200 group-hover:text-[#C2A68C]"
                            : "text-gray-800 group-hover:text-[#76462B]"
                      }`}
                      style={{
                        fontSize: "16px",
                      }}
                    >
                      {item.name}
                    </span>
                  )}

                  {active && (
                    <div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.08) 100%)",
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="py-6 px-2">
          <button
            ref={(el) => (itemRefs.current["logout"] = el)}
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            onMouseEnter={() => !isExpanded && setHoveredItem("logout")}
            onMouseLeave={() => setHoveredItem(null)}
            className={`w-full flex items-center rounded-2xl transition-all duration-300 group py-3.5 ${
              theme === "dark" ? "hover:bg-[#352F2A]" : "hover:bg-gray-50"
            }`}
          >
            <div className="shrink-0 w-7 h-7 flex items-center justify-center ml-4 relative">
              <img
                src={logoutIcon}
                alt="Log Out"
                className={`w-6 h-6 transition-all duration-300 ${
                  theme === "dark"
                    ? "brightness-0 invert opacity-90 group-hover:opacity-100"
                    : "opacity-80 group-hover:opacity-100"
                }`}
              />
            </div>
            <SidebarTooltip
              label="Log Out"
              targetRef={{ current: itemRefs.current["logout"] }}
              show={hoveredItem === "logout" && !isExpanded}
              theme={theme}
            />
            {isExpanded && (
              <span
                className={`font-medium transition-all duration-300 whitespace-nowrap ml-4 ${
                  theme === "dark"
                    ? "text-gray-200 group-hover:text-[#C2A68C]"
                    : "text-gray-800 group-hover:text-[#76462B]"
                }`}
                style={{
                  fontSize: "16px",
                }}
              >
                Log Out
              </span>
            )}
          </button>
        </div>
      </div>

      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </>
  );
};

export default memo(Sidebar);
