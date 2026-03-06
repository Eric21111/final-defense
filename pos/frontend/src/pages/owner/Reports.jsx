import { format } from "date-fns";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  FaArrowDown,
  FaArrowUp,
  FaCalendarAlt,
  FaClipboardList,
  FaCubes,
  FaHandHoldingUsd,
  FaMoneyBillWave,
  FaShoppingBag,
  FaTruck,
} from "react-icons/fa";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { utils, writeFile } from "xlsx";
import exportIcon from "../../assets/inventory-icons/export.svg";
import Header from "../../components/shared/header";
import { useTheme } from "../../context/ThemeContext";

const Reports = () => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState("inventory");
  const [timePeriod, setTimePeriod] = useState("Day"); // Global time period filter: Day, Week, Month, Year
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [inventoryMetrics, setInventoryMetrics] = useState({
    inventoryValue: 0,
    costOfGoodsSold: 0,
    grossProfitMargin: 0,
    totalItems: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  });
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stockMovements, setStockMovements] = useState([]);
  const [lowStockFilter, setLowStockFilter] = useState("all");
  const [stockInData, setStockInData] = useState([]);
  const [damagedData, setDamagedData] = useState([]);
  const [brandPartnersStats, setBrandPartnersStats] = useState([]);

  // New inventory analytics state
  const [inventoryAnalytics, setInventoryAnalytics] = useState({
    kpis: {
      totalSales: 0,
      totalTransactions: 0,
      totalUnitsSold: 0,
      cogs: 0,
      totalProfit: 0,
      profitMargin: 0,
      inventoryValue: 0,
      costValue: 0,
      totalStockUnits: 0,
    },
    stats: {
      totalItems: 0,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      stockInCount: 0,
      stockOutCount: 0,
      pullOutCount: 0,
    },
    inventoryChartData: [],
    profitChartData: [],
    damagedExpired: {
      items: [],
      summary: { damaged: 0, expired: 0, lost: 0, total: 0 },
    },
  });
  const [inventoryLoading, setInventoryLoading] = useState(false);

  useEffect(() => {
    fetchInventoryMetrics();
    fetchInventoryAnalytics(timePeriod);
  }, []);

  // Refetch data when time period changes or custom dates change
  useEffect(() => {
    if (timePeriod === "Custom" && (!startDate || !endDate)) {
      return;
    }
    fetchInventoryAnalytics(timePeriod);
  }, [timePeriod, startDate, endDate]);

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const fetchInventoryMetrics = async () => {
    try {
      // Fetch products for inventory metrics
      const response = await fetch("http://localhost:5000/api/products");
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const products = data.data;
        const totalItems = products.length;
        // Use currentStock and reorderNumber fields from product model
        const inStock = products.filter(
          (p) => (p.currentStock || 0) > (p.reorderNumber || 10),
        ).length;
        const lowStock = products.filter(
          (p) =>
            (p.currentStock || 0) > 0 &&
            (p.currentStock || 0) <= (p.reorderNumber || 10),
        ).length;
        const outOfStock = products.filter(
          (p) => (p.currentStock || 0) === 0,
        ).length;
        // Use itemPrice field from product model (not sellingPrice)
        const inventoryValue = products.reduce(
          (sum, p) => sum + (p.itemPrice || 0) * (p.currentStock || 0),
          0,
        );
        const costOfGoodsSold = products.reduce(
          (sum, p) =>
            sum +
            (p.costPrice || (p.itemPrice || 0) * 0.6) * (p.currentStock || 0),
          0,
        );

        setInventoryMetrics({
          inventoryValue,
          costOfGoodsSold,
          grossProfitMargin:
            inventoryValue > 0
              ? (
                ((inventoryValue - costOfGoodsSold) / inventoryValue) *
                100
              ).toFixed(0)
              : 0,
          totalItems,
          inStock,
          lowStock,
          outOfStock,
        });

        // Get low stock and out of stock items - use itemName and reorderNumber fields
        const lowStockProducts = products
          .filter((p) => (p.currentStock || 0) <= (p.reorderNumber || 10))
          .slice(0, 5)
          .map((p) => ({
            name: p.itemName || p.name || "Unknown",
            stock: p.currentStock || 0,
            reorderLevel: p.reorderNumber || 10,
            status: (p.currentStock || 0) === 0 ? "Out of Stock" : "Low Stock",
          }));
        setLowStockItems(lowStockProducts);
      }

      // Fetch stock movements
      const movementsResponse = await fetch(
        "http://localhost:5000/api/stock-movements?limit=50",
      );
      const movementsData = await movementsResponse.json();
      if (movementsData.success && Array.isArray(movementsData.data)) {
        setStockMovements(movementsData.data.slice(0, 5));

        // Process stock movements for charts
        const movements = movementsData.data;

        // Group by week for Stock-In/Restock chart
        const stockInByWeek = {};
        const damagedByWeek = {};

        movements.forEach((m) => {
          const date = new Date(m.createdAt);
          const weekNum = Math.ceil(date.getDate() / 7);
          const weekKey = `Week ${weekNum}`;

          if (m.type === "Stock-In" || m.reason === "Restock") {
            stockInByWeek[weekKey] =
              (stockInByWeek[weekKey] || 0) + Math.abs(m.quantity);
          }
          if (m.type === "Pull-Out" || m.reason === "Damaged") {
            damagedByWeek[weekKey] =
              (damagedByWeek[weekKey] || 0) + Math.abs(m.quantity);
          }
        });

        setStockInData(
          Object.entries(stockInByWeek)
            .map(([name, value]) => ({ name, value }))
            .slice(0, 4),
        );
        setDamagedData(
          Object.entries(damagedByWeek)
            .map(([name, value]) => ({ name, value }))
            .slice(0, 4),
        );
      }

      // Fetch brand partners data from products
      const brandStats = {};
      if (data.success && Array.isArray(data.data)) {
        data.data.forEach((product) => {
          const brand = product.brandName || "Unknown";
          if (!brandStats[brand]) {
            brandStats[brand] = { name: brand, skuCount: 0, sales: 0 };
          }
          brandStats[brand].skuCount += 1;
          // Use itemPrice field
          brandStats[brand].sales +=
            (product.itemPrice || 0) * (product.totalSold || 0);
        });
        setBrandPartnersStats(Object.values(brandStats).slice(0, 4));
      }
    } catch (error) {
      console.error("Error fetching inventory metrics:", error);
    }
  };

  const fetchInventoryAnalytics = async (period = "Day") => {
    try {
      setInventoryLoading(true);
      const timeMap = {
        Day: "daily",
        Week: "weekly",
        Month: "monthly",
        Year: "yearly",
        Custom: "custom",
      };
      const apiTimeframe = timeMap[period] || "daily";

      let url = `http://localhost:5000/api/reports/inventory-analytics?timeframe=${apiTimeframe}`;
      if (period === "Custom" && startDate && endDate) {
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setInventoryAnalytics(data.data);
      }
    } catch (error) {
      console.error("Error fetching inventory analytics:", error);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleExport = () => {
    const wb = utils.book_new();

    // 1. Inventory Analytics Sheet
    const invData = [
      ["Metric", "Value"],
      ["Total Sales", inventoryAnalytics.kpis.totalSales],
      ["COGS", inventoryAnalytics.kpis.cogs],
      ["Total Profit", inventoryAnalytics.kpis.totalProfit],
      ["Inventory Value", inventoryAnalytics.kpis.inventoryValue],
      ["Total Items", inventoryAnalytics.stats.totalItems],
      ["Stock-Ins", inventoryAnalytics.stats.stockInCount],
      ["Stock-Outs", inventoryAnalytics.stats.stockOutCount],
      ["Pull-Outs", inventoryAnalytics.stats.pullOutCount],
    ];
    const invWs = utils.aoa_to_sheet(invData);
    utils.book_append_sheet(wb, invWs, "Inventory Analytics");

    // 5. Profit Analysis Chart Data
    if (inventoryAnalytics.profitChartData.length > 0) {
      const profitWs = utils.json_to_sheet(
        inventoryAnalytics.profitChartData.map((item) => ({
          Period: item.period,
          Revenue: item.revenue,
          COGS: item.cogs,
          Profit: item.profit,
        })),
      );
      utils.book_append_sheet(wb, profitWs, "Profit Analysis");
    }

    // 6. Inventory Movement Chart Data
    if (inventoryAnalytics.inventoryChartData.length > 0) {
      const moveChartWs = utils.json_to_sheet(
        inventoryAnalytics.inventoryChartData.map((item) => ({
          Period: item.period,
          "Stock-In": item.stockIn,
          "Stock-Out": item.stockOut,
          "Pull-Out": item.pullOut,
        })),
      );
      utils.book_append_sheet(wb, moveChartWs, "Inventory Movements");
    }

    // 7. Damaged & Expired Items
    if (inventoryAnalytics.damagedExpired.items.length > 0) {
      const damagedWs = utils.json_to_sheet(
        inventoryAnalytics.damagedExpired.items.map((item) => ({
          "Item Name": item.itemName,
          SKU: item.sku,
          Category: item.category,
          Type: item.type,
          Quantity: item.quantity,
          Date: new Date(item.date).toLocaleDateString(),
          "Handled By": item.handledBy,
          Notes: item.notes,
        })),
      );
      utils.book_append_sheet(wb, damagedWs, "Damaged & Expired");
    }

    // Generate filename
    const dateStr = new Date().toISOString().split("T")[0];
    writeFile(wb, `Reports_Export_${dateStr}.xlsx`);
  };

  return (
    <div
      className={`p-8 min-h-screen ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
    >
      <Header pageName="Analytics" profileBackground="" showBorder={false} />

      {/* Tab Navigation */}
      <div className="flex items-start gap-3 mb-6 mt-6 w-full">
        {/* Time Period Filter - Dashboard Style */}
        <div className="flex items-center gap-3">
          <div
            className={`rounded-lg shadow-sm p-1 flex space-x-1 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
          >
            {["Day", "Week", "Month", "Year"].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTimePeriod(t);
                  setDateRange([null, null]); // Reset custom range when switching back to presets
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timePeriod === t
                    ? "bg-[#AD7F65] text-white shadow-sm"
                    : theme === "dark"
                      ? "text-gray-400 hover:bg-[#3A3734]"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => {
                if (timePeriod !== "Custom") {
                  setShowDatePicker(true);
                }
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${timePeriod === "Custom"
                  ? "bg-[#AD7F65] text-white shadow-sm"
                  : theme === "dark"
                    ? "text-gray-400 hover:bg-[#3A3734] hidden"
                    : "text-gray-500 hover:bg-gray-100 hidden"
                }`}
            >
              Custom
            </button>
          </div>

          {/* Date Picker */}
          <div className="relative z-50">
            <DatePicker
              selected={startDate}
              onChange={(update) => {
                setDateRange(update);
                if (update[0]) {
                  setTimePeriod("Custom");
                }
              }}
              startDate={startDate}
              endDate={endDate}
              selectsRange
              popperClassName="z-50"
              customInput={
                <button
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border transition-colors ${theme === "dark" ? "bg-[#2A2724] border-gray-600 hover:bg-[#3A3734]" : "bg-white border-gray-100 hover:bg-gray-50"}`}
                >
                  <FaCalendarAlt
                    className={`${timePeriod === "Custom" ? "text-[#AD7F65]" : theme === "dark" ? "text-gray-400" : "text-gray-400"}`}
                  />
                  <span
                    className={`text-sm font-medium ${timePeriod === "Custom" ? "text-[#AD7F65]" : theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                  >
                    {(() => {
                      // If custom date range is selected, show it
                      if (timePeriod === "Custom" && startDate && endDate) {
                        return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
                      }

                      // Otherwise show current period
                      const now = new Date();
                      const options = {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      };
                      if (timePeriod === "Day") {
                        return now.toLocaleDateString("en-US", options);
                      } else if (timePeriod === "Week") {
                        const start = new Date(now);
                        start.setDate(now.getDate() - 7);
                        return `${start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${now.toLocaleDateString("en-US", options)}`;
                      } else if (timePeriod === "Month") {
                        return `${now.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
                      } else if (timePeriod === "Year") {
                        return `${now.getFullYear()}`;
                      }
                      return now.toLocaleDateString("en-US", options);
                    })()}
                  </span>
                </button>
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* <button className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <img src={filterIcon} alt="Filter" className="w-5 h-5 opacity-90" />
          </button>
          <button className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <img src={printIcon} alt="Print" className="w-5 h-5 object-contain" />
          </button> */}
          <button
            onClick={handleExport}
            className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-sm hover:shadow-md transition-shadow ${theme === "dark" ? "bg-[#2A2724] border-gray-700 hover:bg-[#3A3734]" : "bg-white border-gray-200"}`}
            title="Export to Excel"
          >
            <img
              src={exportIcon}
              alt="Export"
              className="w-5 h-5 object-contain"
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === "inventory" && (
          <div className="space-y-6">
            {/* Row 1: 4 KPI Cards */}
            <div className="grid grid-cols-4 gap-4">
              {/* Total Sales */}
              <div
                className={`rounded-xl shadow-md px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl"
                  style={{
                    background:
                      "linear-gradient(to bottom, #60A5FA, #3B82F6, #1D4ED8)",
                  }}
                ></div>
                <div className="flex items-center justify-between pl-2">
                  <div>
                    <p
                      className={`text-xs font-medium mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Total Sales
                    </p>
                    <p className="text-2xl font-bold text-blue-500">
                      {inventoryLoading
                        ? "..."
                        : formatCurrency(inventoryAnalytics.kpis.totalSales)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        <span className="font-semibold text-blue-400">
                          {inventoryAnalytics.kpis.totalTransactions}
                        </span>{" "}
                        transactions
                      </span>
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        <span className="font-semibold text-blue-400">
                          {inventoryAnalytics.kpis.totalUnitsSold}
                        </span>{" "}
                        units sold
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-100 rounded-full p-3">
                    <FaShoppingBag className="text-blue-500 w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* COGS */}
              <div
                className={`rounded-xl shadow-md px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl"
                  style={{
                    background:
                      "linear-gradient(to bottom, #F87171, #EF4444, #DC2626)",
                  }}
                ></div>
                <div className="flex items-center justify-between pl-2">
                  <div>
                    <p
                      className={`text-xs font-medium mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Cost of Goods Sold
                    </p>
                    <p className="text-2xl font-bold text-red-500">
                      {inventoryLoading
                        ? "..."
                        : formatCurrency(inventoryAnalytics.kpis.cogs)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        <span className="font-semibold text-red-400">
                          {inventoryAnalytics.kpis.totalUnitsSold}
                        </span>{" "}
                        units
                      </span>
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        Avg:{" "}
                        <span className="font-semibold text-red-400">
                          {inventoryAnalytics.kpis.totalUnitsSold > 0
                            ? formatCurrency(
                              inventoryAnalytics.kpis.cogs /
                              inventoryAnalytics.kpis.totalUnitsSold,
                            )
                            : "₱0.00"}
                        </span>
                        /unit
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-100 rounded-full p-3">
                    <FaHandHoldingUsd className="text-red-500 w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Total Profit */}
              <div
                className={`rounded-xl shadow-md px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl"
                  style={{
                    background:
                      "linear-gradient(to bottom, #34D399, #10B981, #059669)",
                  }}
                ></div>
                <div className="flex items-center justify-between pl-2">
                  <div>
                    <p
                      className={`text-xs font-medium mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Total Profit
                    </p>
                    <p className="text-2xl font-bold text-green-500">
                      {inventoryLoading
                        ? "..."
                        : formatCurrency(inventoryAnalytics.kpis.totalProfit)}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span
                        className={`text-[11px] px-1.5 py-0.5 rounded ${inventoryAnalytics.kpis.profitMargin >= 0 ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}
                      >
                        {inventoryAnalytics.kpis.profitMargin >= 0 ? "▲" : "▼"}{" "}
                        {Math.abs(inventoryAnalytics.kpis.profitMargin).toFixed(
                          1,
                        )}
                        % margin
                      </span>
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        Revenue − COGS
                      </span>
                    </div>
                  </div>
                  <div className="bg-green-100 rounded-full p-3">
                    <FaMoneyBillWave className="text-green-500 w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Inventory Value */}
              <div
                className={`rounded-xl shadow-md px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 rounded-l-xl"
                  style={{
                    background:
                      "linear-gradient(to bottom, #A78BFA, #8B5CF6, #7C3AED)",
                  }}
                ></div>
                <div className="flex items-center justify-between pl-2">
                  <div>
                    <p
                      className={`text-xs font-medium mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Inventory Value
                    </p>
                    <p className="text-2xl font-bold text-purple-500">
                      {inventoryLoading
                        ? "..."
                        : formatCurrency(
                          inventoryAnalytics.kpis.inventoryValue,
                        )}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        <span className="font-semibold text-purple-400">
                          {inventoryAnalytics.kpis.totalStockUnits.toLocaleString()}
                        </span>{" "}
                        units in stock
                      </span>
                      <span
                        className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                      >
                        Cost:{" "}
                        <span className="font-semibold text-purple-400">
                          {formatCurrency(inventoryAnalytics.kpis.costValue)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="bg-purple-100 rounded-full p-3">
                    <FaCubes className="text-purple-500 w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Stat Cards (left) + Inventory Analysis Chart (right) */}
            <div className="grid grid-cols-4 gap-4">
              {/* Left: Stat Cards - Vertical Stack */}
              <div className="flex flex-col gap-3">
                {/* Total Items */}
                <div
                  className={`rounded-xl shadow-sm relative overflow-hidden p-4 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
                  <div className="flex items-center justify-between pl-2">
                    <div>
                      <p className="text-3xl font-bold text-blue-500">
                        {inventoryAnalytics.stats.totalItems}
                      </p>
                      <p className="text-xs text-blue-500 font-medium mt-0.5">
                        Total Items
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-full p-3">
                      <FaClipboardList className="text-blue-400 w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Stock-Ins */}
                <div
                  className={`rounded-xl shadow-sm relative overflow-hidden p-4 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-green-500"></div>
                  <div className="flex items-center justify-between pl-2">
                    <div>
                      <p className="text-3xl font-bold text-green-500">
                        {inventoryAnalytics.stats.stockInCount}
                      </p>
                      <p className="text-xs text-green-500 font-medium mt-0.5">
                        Stock-ins
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-full p-3">
                      <FaArrowDown className="text-green-400 w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Stock-Outs */}
                <div
                  className={`rounded-xl shadow-sm relative overflow-hidden p-4 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500"></div>
                  <div className="flex items-center justify-between pl-2">
                    <div>
                      <p className="text-3xl font-bold text-amber-500">
                        {inventoryAnalytics.stats.stockOutCount}
                      </p>
                      <p className="text-xs text-amber-500 font-medium mt-0.5">
                        Stock-outs
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-full p-3">
                      <FaArrowUp className="text-amber-400 w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Pull-Outs */}
                <div
                  className={`rounded-xl shadow-sm relative overflow-hidden p-4 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
                  <div className="flex items-center justify-between pl-2">
                    <div>
                      <p className="text-3xl font-bold text-red-500">
                        {inventoryAnalytics.stats.pullOutCount}
                      </p>
                      <p className="text-xs text-red-500 font-medium mt-0.5">
                        Pull-Outs
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-full p-3">
                      <FaTruck className="text-red-400 w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Inventory Analysis Chart */}
              <div
                className={`col-span-3 rounded-2xl shadow-md p-5 flex flex-col ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div className="mb-3">
                  <h3
                    className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}
                  >
                    Inventory Analysis
                  </h3>
                  <p
                    className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Stock-In vs Stock-Out vs Pull-Out movement comparison
                  </p>
                </div>
                <div className="flex-1 min-h-0">
                  {inventoryAnalytics.inventoryChartData.length === 0 ? (
                    <div
                      className={`w-full h-full flex items-center justify-center rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
                    >
                      <p className="text-gray-400 text-sm">
                        No movement data available
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={inventoryAnalytics.inventoryChartData}
                        barCategoryGap="20%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke={theme === "dark" ? "#374151" : "#f0f0f0"}
                        />
                        <XAxis
                          dataKey="period"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fill: theme === "dark" ? "#9CA3AF" : "#6b7280",
                          }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fill: theme === "dark" ? "#9CA3AF" : "#6b7280",
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              theme === "dark" ? "#1F2937" : "white",
                            border:
                              theme === "dark" ? "1px solid #374151" : "none",
                            borderRadius: "12px",
                            boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)",
                            color: theme === "dark" ? "#F3F4F6" : "#000",
                          }}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            paddingTop: "10px",
                            fontSize: "11px",
                          }}
                        />
                        <Bar
                          dataKey="stockIn"
                          name="Stock-In"
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                          barSize={18}
                        />
                        <Bar
                          dataKey="stockOut"
                          name="Stock-Out"
                          fill="#F59E0B"
                          radius={[4, 4, 0, 0]}
                          barSize={18}
                        />
                        <Bar
                          dataKey="pullOut"
                          name="Pull-Out"
                          fill="#EF4444"
                          radius={[4, 4, 0, 0]}
                          barSize={18}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Profit Analysis Chart */}
            <div className="grid grid-cols-4 gap-4">
              <div
                className={`col-start-2 col-span-3 rounded-2xl shadow-md p-5 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div className="mb-3">
                  <h3
                    className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}
                  >
                    Profit Analysis
                  </h3>
                  <p
                    className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                  >
                    Revenue, Cost of Goods Sold, and Profit breakdown over time
                  </p>
                </div>
                <div className="h-[260px]">
                  {inventoryAnalytics.profitChartData.length === 0 ? (
                    <div
                      className={`w-full h-full flex items-center justify-center rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
                    >
                      <p className="text-gray-400 text-sm">
                        No profit data available
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={inventoryAnalytics.profitChartData}
                        barCategoryGap="15%"
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke={theme === "dark" ? "#374151" : "#f0f0f0"}
                        />
                        <XAxis
                          dataKey="period"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fill: theme === "dark" ? "#9CA3AF" : "#6b7280",
                          }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fontSize: 11,
                            fill: theme === "dark" ? "#9CA3AF" : "#6b7280",
                          }}
                          tickFormatter={(val) =>
                            `₱${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                          }
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor:
                              theme === "dark" ? "#1F2937" : "white",
                            border:
                              theme === "dark" ? "1px solid #374151" : "none",
                            borderRadius: "12px",
                            boxShadow: "0 4px 12px rgb(0 0 0 / 0.1)",
                            color: theme === "dark" ? "#F3F4F6" : "#000",
                          }}
                          formatter={(value) => [
                            `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                            "",
                          ]}
                        />
                        <Legend
                          iconType="circle"
                          wrapperStyle={{
                            paddingTop: "10px",
                            fontSize: "11px",
                          }}
                        />
                        <Bar
                          dataKey="revenue"
                          name="Revenue"
                          fill="#3B82F6"
                          radius={[4, 4, 0, 0]}
                          barSize={24}
                        />
                        <Bar
                          dataKey="cogs"
                          name="COGS"
                          fill="#EF4444"
                          radius={[4, 4, 0, 0]}
                          barSize={24}
                        />
                        <Bar
                          dataKey="profit"
                          name="Profit"
                          fill="#10B981"
                          radius={[4, 4, 0, 0]}
                          barSize={24}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Row 4: Damaged & Expired Stock Table */}
            <div className="grid grid-cols-4 gap-4">
              <div
                className={`col-start-2 col-span-3 rounded-2xl shadow-md p-5 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3
                      className={`text-base font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}
                    >
                      Damaged & Expired Stock
                    </h3>
                    <p
                      className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Items pulled out due to damage, expiration, or loss
                    </p>
                  </div>
                  {/* Summary badges */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme === "dark" ? "bg-[#1E1B18]" : "bg-red-50"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      <span
                        className={`${theme === "dark" ? "text-gray-300" : "text-red-700"}`}
                      >
                        Damaged:{" "}
                        {inventoryAnalytics.damagedExpired.summary.damaged}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme === "dark" ? "bg-[#1E1B18]" : "bg-amber-50"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span
                        className={`${theme === "dark" ? "text-gray-300" : "text-amber-700"}`}
                      >
                        Expired:{" "}
                        {inventoryAnalytics.damagedExpired.summary.expired}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
                    >
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                      <span
                        className={`${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Lost: {inventoryAnalytics.damagedExpired.summary.lost}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr
                        className={`border-b ${theme === "dark" ? "text-gray-400 border-gray-700" : "text-gray-500 border-gray-200"}`}
                      >
                        <th className="text-left py-2.5 font-medium">
                          Item Name
                        </th>
                        <th className="text-left py-2.5 font-medium">SKU</th>
                        <th className="text-left py-2.5 font-medium">
                          Category
                        </th>
                        <th className="text-center py-2.5 font-medium">Type</th>
                        <th className="text-center py-2.5 font-medium">Qty</th>
                        <th className="text-center py-2.5 font-medium">Date</th>
                        <th className="text-left py-2.5 font-medium">
                          Handled By
                        </th>
                        <th className="text-left py-2.5 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryAnalytics.damagedExpired.items.length === 0 ? (
                        <tr>
                          <td
                            colSpan="8"
                            className="text-center py-8 text-gray-400"
                          >
                            No damaged, expired, or lost items for this period
                          </td>
                        </tr>
                      ) : (
                        inventoryAnalytics.damagedExpired.items.map(
                          (item, index) => (
                            <tr
                              key={index}
                              className={`${theme === "dark" ? "border-gray-700/50 hover:bg-[#3A3734]" : "border-gray-50 hover:bg-gray-50"} ${index < inventoryAnalytics.damagedExpired.items.length - 1 ? "border-b" : ""}`}
                            >
                              <td
                                className={`py-2.5 font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}
                              >
                                {item.itemName}
                              </td>
                              <td
                                className={`py-2.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                              >
                                {item.sku}
                              </td>
                              <td
                                className={`py-2.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                              >
                                {item.category}
                              </td>
                              <td className="py-2.5 text-center">
                                <span
                                  className={`px-2 py-1 rounded-full text-[10px] font-medium ${item.type === "Damaged"
                                      ? "bg-red-100 text-red-600"
                                      : item.type === "Expired"
                                        ? "bg-amber-100 text-amber-600"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                >
                                  {item.type}
                                </span>
                              </td>
                              <td
                                className={`py-2.5 text-center font-medium ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}
                              >
                                {item.quantity}
                              </td>
                              <td
                                className={`py-2.5 text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                              >
                                {new Date(item.date).toLocaleDateString()}
                              </td>
                              <td
                                className={`py-2.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                              >
                                {item.handledBy}
                              </td>
                              <td
                                className={`py-2.5 ${theme === "dark" ? "text-gray-400" : "text-gray-500"} max-w-[150px] truncate`}
                              >
                                {item.notes || "-"}
                              </td>
                            </tr>
                          ),
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
