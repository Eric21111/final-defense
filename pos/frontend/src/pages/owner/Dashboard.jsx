import { format } from "date-fns";
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  FaCalendarAlt,
  FaChartLine,
  FaExclamationTriangle,
  FaHandshake,
  FaShoppingBag
} from
  "react-icons/fa";
import { useNavigate } from "react-router-dom";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from
  "recharts";
import TopSellingModal from "../../components/owner/TopSellingModal";
import Header from "../../components/shared/header";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { API_ENDPOINTS } from "../../config/api";

const formatCompactPeso = (n) => {
  const abs = Math.abs(Number(n) || 0);
  if (abs === 0) return "₱0";
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `₱${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1000) {
    const v = abs / 1000;
    return `₱${v >= 10 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `₱${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
};

const growthVsLastPeriod = (current, previous, rate) => {
  const cur = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (cur === 0 && prev === 0) {
    return { text: "— vs last period", tone: "neutral" };
  }
  const r = Number(rate) || 0;
  const sign = r > 0 ? "+" : "";
  const tone = r > 0 ? "up" : r < 0 ? "down" : "neutral";
  return { text: `${sign}${r}% vs last period`, tone };
};

const growthToneClass = (tone, dark) => {
  if (tone === "up") return "text-green-600 dark:text-green-400";
  if (tone === "down") return "text-red-600 dark:text-red-400";
  return dark ? "text-gray-400" : "text-gray-500";
};

const Dashboard = () => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const userName = currentUser?.name || "Erika";

  const [timeframe, setTimeframe] = useState("Daily");
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [metrics, setMetrics] = useState({
    totalSalesToday: 0,
    totalTransactions: 0,
    profit: 0,
    lowStockItems: 0,
    growthRate: 0,
    totalSalesPrevious: 0,
    totalTransactionsPrevious: 0,
    transactionGrowthRate: 0
  });
  const [salesOverTimeData, setSalesOverTimeData] = useState([]);
  const [salesByCategoryData, setSalesByCategoryData] = useState([]);
  const [topSellingProducts, setTopSellingProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [loading, setLoading] = useState(true);


  const [salesFilter, setSalesFilter] = useState("Both");
  const [topSellingSort, setTopSellingSort] = useState("most");
  const [lowStockFilter, setLowStockFilter] = useState("All");


  const [showSalesFilter, setShowSalesFilter] = useState(false);
  const [showTopSellingFilter, setShowTopSellingFilter] = useState(false);
  const [showLowStockFilter, setShowLowStockFilter] = useState(false);
  const [showTopSellingModal, setShowTopSellingModal] = useState(false);


  const COLORS = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff8042",
    "#0088FE",
    "#00C49F"];


  const PIE_COLORS = ["#F4A6C1", "#A7C7E7", "#FAD02E", "#98FB98", "#FFB7B2"];

  useEffect(() => {
    if (timeframe === "Custom" && (!startDate || !endDate)) return;

    const fetchCoreData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchDashboardStats(),
          fetchSalesOverTime(),
          fetchSalesByCategory(),
          fetchActiveEmployees()]
        );
      } catch (error) {
        console.error("Error fetching core dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCoreData();
  }, [timeframe, startDate, endDate]);

  useEffect(() => {
    if (timeframe === "Custom" && (!startDate || !endDate)) return;
    fetchTopSellingProducts();
  }, [timeframe, topSellingSort, startDate, endDate]);

  useEffect(() => {
    fetchLowStockProducts();
  }, [lowStockFilter]);

  const getQueryParams = () => {
    let params = `?timeframe=${timeframe}`;
    if (timeframe === "Custom" && startDate && endDate) {
      params += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    }
    return params;
  };

  const fetchDashboardStats = async () => {
    try {
      const timeMap = {
        Day: "daily",
        Week: "weekly",
        Month: "monthly",
        Year: "yearly",
        Custom: "custom"
      };
      const apiTimeframe = timeMap[timeframe] || "daily";

      let url = `${API_ENDPOINTS.transactionsDashboardStats}?timeframe=${apiTimeframe}`;
      if (timeframe === "Custom" && startDate && endDate) {
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchSalesOverTime = async () => {
    try {
      const timeMap = {
        Day: "daily",
        Week: "weekly",
        Month: "monthly",
        Year: "yearly",
        Custom: "custom"
      };
      const apiTimeframe = timeMap[timeframe] || "daily";

      let url = `${API_ENDPOINTS.transactionsSalesOverTime}?timeframe=${apiTimeframe}`;
      if (timeframe === "Custom" && startDate && endDate) {
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        const mappedData = data.data.map((item) => ({
          ...item,
          revenue: item.revenue ?? item.totalSales ?? 0
        }));
        setSalesOverTimeData(mappedData);
      }
    } catch (error) {
      console.error("Error fetching sales over time:", error);
    }
  };

  const fetchSalesByCategory = async () => {
    try {
      let url = API_ENDPOINTS.transactionsSalesByCategory;
      if (timeframe === "Custom" && startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setSalesByCategoryData(data.data);
      }
    } catch (error) {
      console.error("Error fetching sales by category:", error);
    }
  };

  const fetchTopSellingProducts = async () => {
    try {
      const timeMap = {
        Day: "daily",
        Week: "weekly",
        Month: "monthly",
        Year: "yearly",
        Custom: "custom"
      };
      const apiTimeframe = timeMap[timeframe] || "daily";

      let url = `${API_ENDPOINTS.transactionsTopSelling}?sort=${topSellingSort}&limit=10&period=${apiTimeframe}`;
      if (timeframe === "Custom" && startDate && endDate) {
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setTopSellingProducts(data.data);
      }
    } catch (error) {
      console.error("Error fetching top selling:", error);
    }
  };

  const fetchLowStockProducts = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.productsLowStock);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {

        const mappedProducts = data.data.map((p) => ({
          ...p,
          calculatedStock: p.currentStock || 0
        }));

        const lowStock = mappedProducts.
          filter((p) => {
            const isOutOfStock = p.alertType === 'out_of_stock' || p.calculatedStock === 0;
            const isLowStock = p.alertType === 'low_stock' && p.calculatedStock > 0;

            if (lowStockFilter === "Out of Stock") return isOutOfStock;
            if (lowStockFilter === "Low Stock") return isLowStock;
            return true;
          }).
          slice(0, 5);

        setLowStockProducts(lowStock);
      }
    } catch (error) {
      console.error("Error fetching low stock:", error);
    }
  };

  const fetchActiveEmployees = async () => {
    try {
      const response = await fetch(`${API_ENDPOINTS.employeesOnline}`);
      const data = await response.json();
      if (data.success) {
        const timestamp = new Date().getTime();
        const onlineEmployees = data.data.map(emp => ({
          ...emp,
          image: `http://localhost:5000/api/employees/${emp._id}/image?t=${timestamp}`
        }));
        setActiveEmployees(onlineEmployees);
      }
    } catch (error) {
      console.error("Error fetching online employees:", error);
    }
  };

  const formatCurrency = (val) => `₱${val.toLocaleString()}`;

  const salesGrowth = growthVsLastPeriod(
    metrics.totalSalesToday,
    metrics.totalSalesPrevious,
    metrics.growthRate
  );
  const txGrowth = growthVsLastPeriod(
    metrics.totalTransactions,
    metrics.totalTransactionsPrevious,
    metrics.transactionGrowthRate
  );
  const isDark = theme === "dark";

  const renderDateRange = () => {
    if (timeframe === "Custom" && startDate && endDate) {
      return `${format(startDate, "MMM d, yyyy")} - ${format(endDate, "MMM d, yyyy")}`;
    }

    const now = new Date();
    const options = { day: "numeric", month: "short", year: "numeric" };
    if (timeframe === "Daily" || timeframe === "Day") {
      return now.toLocaleDateString("en-US", options);
    } else if (timeframe === "Weekly" || timeframe === "Week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      return `${start.toLocaleDateString("en-US", { day: "numeric", month: "short" })} - ${now.toLocaleDateString("en-US", options)}`;
    }
    return `${now.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  };

  return (
    <div
      className={`min-h-screen pb-10 ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}>

      { }
      <Header
        pageName={`Welcome, ${userName}!`}
        subtitle={`Here's your overview for ${timeframe === "Custom" ? "custom range" : timeframe.toLowerCase()}`}
        showTimeframeFilter={false}
        showBorder={false}
        userName={userName}
        userRole="Owner"
        className="px-6 pt-8 pb-4 [&_h1]:text-4xl" />


      <div className="px-6 pb-4 w-full space-y-6">
        { }
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
          { }
          <div className="flex items-center">
            <style>{`
              @keyframes downloadPulse {
                0%, 100% { box-shadow: 0 0 0 0 rgba(173, 127, 101, 0.4); }
                50% { box-shadow: 0 0 0 10px rgba(173, 127, 101, 0); }
              }
              @keyframes downloadShimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
              }
              .download-app-btn {
                animation: downloadPulse 2s ease-in-out infinite;
                background-image: linear-gradient(90deg, #AD7F65 0%, #c9a48e 50%, #AD7F65 100%);
                background-size: 200% auto;
              }
              .download-app-btn:hover {
                animation: downloadShimmer 1.5s linear infinite;
                transform: scale(1.05);
              }
            `}</style>
            <a
              href="https://expo.dev/accounts/consolve_studio/projects/cysmob/builds/8d3dee4b-1027-4234-9594-5ce70c445df7"
              target="_blank"
              rel="noopener noreferrer"
              className="download-app-btn px-5 py-2.5 text-sm font-bold rounded-lg shadow-md transition-all flex items-center gap-2 text-white">

              📱 Click here to download the app
            </a>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
            { }
            <div
              className={`rounded-lg shadow-sm p-1 flex space-x-1 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>

              {["Day", "Week", "Month", "Year"].map((t) =>
                <button
                  key={t}
                  onClick={() => {
                    setTimeframe(t);
                    setDateRange([null, null]);
                  }}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${timeframe === t ?
                    "bg-[#AD7F65] text-white shadow-sm" :
                    theme === "dark" ?
                      "text-gray-400 hover:bg-[#3A3734]" :
                      "text-gray-500 hover:bg-gray-100"}`
                  }>

                  {t}
                </button>
              )}
              <button
                onClick={() => {
                  if (timeframe !== "Custom") {
                    setShowDatePicker(true);
                  }
                }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${timeframe === "Custom" ?
                  "bg-[#AD7F65] text-white shadow-sm" :
                  theme === "dark" ?
                    "text-gray-400 hover:bg-[#3A3734] hidden" :
                    "text-gray-500 hover:bg-gray-100 hidden"}`
                }>

                Custom
              </button>
            </div>

            { }
            <div className="relative z-50">
              <DatePicker
                selected={startDate}
                onChange={(update) => {
                  setDateRange(update);
                  if (update[0]) {
                    setTimeframe("Custom");
                  }
                }}
                startDate={startDate}
                endDate={endDate}
                selectsRange
                popperClassName="z-50"
                customInput={
                  <button
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-sm border transition-colors cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-600 hover:bg-[#3A3734]" : "bg-white border-gray-100 hover:bg-gray-50"}`}>

                    <FaCalendarAlt
                      className={`${timeframe === "Custom" ? "text-[#AD7F65]" : theme === "dark" ? "text-gray-400" : "text-gray-400"}`} />

                    <span
                      className={`text-sm font-medium ${timeframe === "Custom" ? "text-[#AD7F65]" : theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>

                      {renderDateRange()}
                    </span>
                  </button>
                } />

            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="lg:col-span-2 flex flex-col gap-6 h-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:auto-rows-fr">
              {/* Total Sales */}
              <div className={`rounded-xl border shadow-sm relative overflow-hidden hover:shadow-md transition-shadow min-h-[192px] ${isDark ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>
                <div className="absolute top-0 left-0 w-3 h-full rounded-l-xl" style={{ backgroundImage: "linear-gradient(180deg, #93C5FD 0%, #2563EB 100%)" }} />
                <div className="relative flex flex-col items-center text-center pt-6 pb-5 px-4 pl-6 min-h-[192px]">
                  <div className={`p-2.5 rounded-full mb-3 ${isDark ? "bg-blue-500/15" : "bg-blue-50"}`}>
                    <FaShoppingBag className="text-blue-500 text-base" />
                  </div>
                  <p className={`text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    {formatCompactPeso(metrics.totalSalesToday)}
                  </p>
                  <p className={`text-sm font-extrabold mt-2.5 ${isDark ? "text-blue-400" : "text-blue-600"}`}>Total Sales</p>
                  <p className={`text-[10px] font-semibold mt-auto pt-4 ${growthToneClass(salesGrowth.tone, isDark)}`}>{salesGrowth.text}</p>
                </div>
              </div>

              {/* Total Transactions */}
              <div className={`rounded-xl border shadow-sm relative overflow-hidden hover:shadow-md transition-shadow min-h-[192px] ${isDark ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>
                <div className="absolute top-0 left-0 w-3 h-full rounded-l-xl" style={{ backgroundImage: "linear-gradient(180deg, #C4B5FD 0%, #7C3AED 100%)" }} />
                <div className="relative flex flex-col items-center text-center pt-6 pb-5 px-4 pl-6 min-h-[192px]">
                  <div className={`p-2.5 rounded-full mb-3 ${isDark ? "bg-purple-500/15" : "bg-purple-50"}`}>
                    <FaHandshake className="text-purple-500 text-base" />
                  </div>
                  <p className={`text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    {(metrics.totalTransactions ?? 0).toLocaleString("en-US")}
                  </p>
                  <p className={`text-sm font-extrabold mt-2.5 ${isDark ? "text-purple-400" : "text-purple-700"}`}>Total Transactions</p>
                  <p className={`text-[10px] font-semibold mt-auto pt-4 ${growthToneClass(txGrowth.tone, isDark)}`}>{txGrowth.text}</p>
                </div>
              </div>

              {/* Sales growth % (same as first card trend) */}
              <div className={`rounded-xl border shadow-sm relative overflow-hidden hover:shadow-md transition-shadow min-h-[192px] ${isDark ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>
                <div className="absolute top-0 left-0 w-3 h-full rounded-l-xl" style={{ backgroundImage: "linear-gradient(180deg, #86EFAC 0%, #16A34A 100%)" }} />
                <div className="relative flex flex-col items-center text-center pt-6 pb-5 px-4 pl-6 min-h-[192px]">
                  <div className={`p-2.5 rounded-full mb-3 ${isDark ? "bg-green-500/15" : "bg-green-50"}`}>
                    <FaChartLine className="text-green-500 text-base" />
                  </div>
                  <p className={`flex items-baseline justify-center gap-0.5 font-black leading-none ${isDark ? "text-white" : "text-gray-900"}`}>
                    <span className="text-3xl sm:text-4xl tabular-nums tracking-tight">{metrics.growthRate}</span>
                    <span className={`text-2xl font-bold ${isDark ? "text-gray-400" : "text-gray-600"}`}>%</span>
                  </p>
                  <p className={`text-sm font-extrabold mt-2.5 ${isDark ? "text-green-400" : "text-green-700"}`}>Average Growth Rate</p>
                  <p className={`text-[10px] font-semibold mt-auto pt-4 ${growthToneClass(salesGrowth.tone, isDark)}`}>{salesGrowth.text}</p>
                </div>
              </div>

              {/* Low stock */}
              <div className={`rounded-xl border shadow-sm relative overflow-hidden hover:shadow-md transition-shadow min-h-[192px] ${isDark ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>
                <div className="absolute top-0 left-0 w-3 h-full rounded-l-xl" style={{ backgroundImage: "linear-gradient(180deg, #FCA5A5 0%, #DC2626 100%)" }} />
                <div className="relative flex flex-col items-center text-center pt-6 pb-5 px-4 pl-6 min-h-[192px]">
                  <div className={`p-2.5 rounded-full mb-3 ${isDark ? "bg-red-500/15" : "bg-red-50"}`}>
                    <FaExclamationTriangle className="text-red-500 text-base" />
                  </div>
                  <p className={`text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                    {(metrics.lowStockItems ?? 0).toLocaleString("en-US")}
                  </p>
                  <p className={`text-sm font-extrabold mt-2.5 ${isDark ? "text-red-400" : "text-red-600"}`}>Low Stock Items</p>
                  <p className={`text-[10px] font-semibold mt-auto pt-4 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Below reorder level</p>
                </div>
              </div>
            </div>


            <div
              className={`p-6 rounded-xl shadow-sm border flex-1 flex flex-col ${theme === "dark" ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>

              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2
                    className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                    Sales Over Time and Growth
                  </h2>
                  <p
                    className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    Total sales and growth from all sales during a specific
                    period.
                  </p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowSalesFilter(!showSalesFilter)}
                      className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-600 flex items-center gap-1 cursor-pointer">

                      Filter by: {salesFilter}{" "}
                      <span className="text-[10px]">▼</span>
                    </button>
                    {showSalesFilter &&
                      <div
                        className={`absolute right-0 mt-1 w-24 border rounded-lg shadow-lg z-10 py-1 ${theme === "dark" ? "bg-[#1E1B18] border-gray-700" : "bg-white border-gray-100"}`}>

                        {["Sales", "Growth", "Both"].map((option) =>
                          <button
                            key={option}
                            onClick={() => {
                              setSalesFilter(option);
                              setShowSalesFilter(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-opacity-10 cursor-pointer ${theme === "dark" ? "text-gray-300 hover:bg-gray-500" : "text-gray-700 hover:bg-gray-50"}`}>

                            {option}
                          </button>
                        )}
                      </div>
                    }
                  </div>
                </div>
              </div>
              <div className="h-[300px] min-h-[300px] w-full">
                {salesOverTimeData && salesOverTimeData.length > 0 ?
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={salesOverTimeData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f0f0f0" />

                      <XAxis
                        dataKey="period"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        dy={10} />

                      { }
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        domain={[0, "auto"]}
                        tickFormatter={(val) =>
                          `₱${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`
                        } />

                      { }
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        tickFormatter={(val) => `${val}%`} />

                      <Tooltip
                        contentStyle={{
                          borderRadius: "12px",
                          border: "none",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
                        }}
                        formatter={(value, name) => {
                          if (name === "Revenue")
                            return [`₱${value.toLocaleString()}`, name];
                          if (name === "Growth") return [`${value}%`, name];
                          return [value, name];
                        }} />

                      <Legend
                        iconType="circle"
                        wrapperStyle={{ paddingTop: "20px" }} />


                      { }

                      { }
                      {salesFilter === "Sales" &&
                        <>
                          <Bar
                            yAxisId="left"
                            dataKey="revenue"
                            barSize={30}
                            fill="#8884d8"
                            radius={[4, 4, 0, 0]}
                            name="Revenue" />

                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="target"
                            stroke="#FB923C"
                            strokeDasharray="5 5"
                            name="Target"
                            dot={false}
                            strokeWidth={2} />

                        </>
                      }

                      { }
                      {salesFilter === "Growth" &&
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="growth"
                          fill="#D7D7D7"
                          stroke="#D7D7D7"
                          name="Growth"
                          strokeWidth={3}
                          fillOpacity={0.6} />

                      }

                      { }
                      {salesFilter === "Both" &&
                        <>
                          <Bar
                            yAxisId="left"
                            dataKey="revenue"
                            barSize={30}
                            fill="#8884d8"
                            radius={[4, 4, 0, 0]}
                            name="Revenue" />

                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="target"
                            stroke="#FB923C"
                            strokeDasharray="5 5"
                            name="Target"
                            dot={false}
                            strokeWidth={2} />

                          <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="growth"
                            fill="#D7D7D7"
                            stroke="#D7D7D7"
                            name="Growth"
                            strokeWidth={3}
                            fillOpacity={0.6} />

                        </>
                      }
                    </ComposedChart>
                  </ResponsiveContainer> :
                  <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                    <FaChartLine className="text-4xl mb-3 opacity-20" />
                    <p className="text-sm">
                      No sales data available for this period
                    </p>
                  </div>
                }
              </div>
            </div>
          </div>

          { }
          <div className="flex flex-col gap-6">

            <div
              className={`p-6 rounded-xl shadow-sm border ${theme === "dark" ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>

              <div className="mb-4">
                <h2
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  Active Employees
                </h2>
              </div>

              <div className="space-y-4">
                {activeEmployees.length > 0 ? (
                  activeEmployees.map((employee, index) => (
                    <div key={employee._id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                            {employee.image ? (
                              <img src={employee.image} alt={employee.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                            ) : (
                              employee.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                            {employee.name}
                          </p>
                          <p className="text-[10px] text-gray-500">{employee.role}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 whitespace-nowrap">
                          {employee.lastLogin ? `Online since ${new Date(employee.lastLogin).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}` : "Online"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-sm text-gray-400 py-4">No active employees</div>
                )}

                <div className="pt-2 text-right mt-auto">
                  <button
                    onClick={() => navigate("/owner/manage-employees")}
                    className="text-xs text-gray-500 hover:text-[#AD7F65] flex items-center justify-end gap-1 ml-auto cursor-pointer">
                    More {">"}
                  </button>
                </div>
              </div>
            </div>


            <div
              className={`p-6 rounded-xl shadow-sm border flex-grow ${theme === "dark" ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>

              <div className="mb-4">
                <h2
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                  Sales By Category
                </h2>
                <p
                  className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                  Revenue distribution across product categories
                </p>
              </div>
              <div className="h-[300px] w-full flex flex-col items-center justify-center">
                {salesByCategoryData && salesByCategoryData.length > 0 ?
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={salesByCategoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value">

                          {salesByCategoryData.map((entry, index) =>
                            <Cell
                              key={`cell-${index}`}
                              fill={PIE_COLORS[index % PIE_COLORS.length]} />

                          )}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2 w-full px-4">
                      {salesByCategoryData.slice(0, 4).map((item, index) =>
                        <div key={index} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                PIE_COLORS[index % PIE_COLORS.length]
                            }}>
                          </div>
                          <div className="flex flex-col">
                            <span
                              className={`text-xs font-bold ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                              {item.name}
                            </span>
                            <span
                              className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>

                              ₱{item.value.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </> :

                  <div className="h-full w-full flex flex-col items-center justify-center text-gray-400">
                    <FaShoppingBag className="text-4xl mb-3 opacity-20" />
                    <p className="text-sm">No category data available</p>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          <div
            className={`p-6 rounded-xl shadow-sm border ${theme === "dark" ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  Top Selling Products
                </h2>
                <p
                  className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  Top Performing items this {timeframe.toLowerCase()}
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowTopSellingFilter(!showTopSellingFilter)}
                  className="text-xs text-gray-500 border rounded-md px-2 py-1 flex items-center gap-1 cursor-pointer">
                  {topSellingSort === "most" ? "Best Selling" : "Least Selling"}{" "}
                  <span className="text-[10px]">▼</span>
                </button>
                {showTopSellingFilter &&
                  <div
                    className={`absolute right-0 mt-1 w-32 border rounded-lg shadow-lg z-10 py-1 ${theme === "dark" ? "bg-[#1E1B18] border-gray-700" : "bg-white border-gray-100"}`}>
                    <button
                      onClick={() => {
                        setTopSellingSort("most");
                        setShowTopSellingFilter(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-opacity-10 cursor-pointer ${theme === "dark" ? "text-gray-300 hover:bg-gray-500" : "text-gray-700 hover:bg-gray-50"}`}>
                      Best Selling
                    </button>
                    <button
                      onClick={() => {
                        setTopSellingSort("least");
                        setShowTopSellingFilter(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-opacity-10 cursor-pointer ${theme === "dark" ? "text-gray-300 hover:bg-gray-500" : "text-gray-700 hover:bg-gray-50"}`}>
                      Least Selling
                    </button>
                  </div>
                }
              </div>
            </div>

            <div className="space-y-4">
              {topSellingProducts.slice(0, 3).map((product, index) =>
                <div
                  key={product.productId}
                  className={`flex items-center justify-between group cursor-pointer p-2 rounded-lg transition-colors ${theme === "dark" ? "hover:bg-[#3A3734]" : "hover:bg-gray-50"}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#AD7F65] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {index + 1}
                    </div>
                    <div
                      className={`w-12 h-12 rounded-lg overflow-hidden border ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
                      {product.itemImage ?
                        <img
                          src={product.itemImage}
                          alt={product.itemName}
                          className="w-full h-full object-cover" /> :
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">
                          img
                        </div>
                      }
                    </div>
                    <div>
                      <p
                        className={`text-sm font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                        {product.itemName}
                      </p>
                      <p className="text-xs text-[#AD7F65]">
                        {product.totalQuantitySold} Sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">
                      PHP {product.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              <div className="pt-2 text-right">
                <button
                  onClick={() => setShowTopSellingModal(true)}
                  className="text-xs text-gray-500 hover:text-[#AD7F65] flex items-center justify-end gap-1 ml-auto cursor-pointer">
                  More {">"}
                </button>
              </div>
            </div>
          </div>

          <div
            className={`p-6 rounded-xl shadow-sm border ${theme === "dark" ? "bg-[#2A2724] border-[#4A4037]" : "bg-white border-gray-100"}`}>

            <div className="flex justify-between items-center mb-6">
              <div>
                <h2
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  Low & Out-of-Stock Items
                </h2>
                <p
                  className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  Items requiring immediate attention
                </p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowLowStockFilter(!showLowStockFilter)}
                  className="text-xs text-gray-500 border rounded-md px-2 py-1 flex items-center gap-1 cursor-pointer">
                  {lowStockFilter === "All" ? "Filter by" : lowStockFilter}{" "}
                  <span className="text-[10px]">▼</span>
                </button>
                {showLowStockFilter &&
                  <div
                    className={`absolute right-0 mt-1 w-32 border rounded-lg shadow-lg z-10 py-1 ${theme === "dark" ? "bg-[#1E1B18] border-gray-700" : "bg-white border-gray-100"}`}>
                    {["All", "Out of Stock", "Low Stock"].map((opt) =>
                      <button
                        key={opt}
                        onClick={() => {
                          setLowStockFilter(opt);
                          setShowLowStockFilter(false);
                          fetchLowStockProducts();
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-opacity-10 cursor-pointer ${theme === "dark" ? "text-gray-300 hover:bg-gray-500" : "text-gray-700 hover:bg-gray-50"}`}>
                        {opt}
                      </button>
                    )}
                  </div>
                }
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead
                  className={`text-xs uppercase ${theme === "dark" ? "bg-[#1E1B18] text-gray-400" : "bg-gray-50 text-gray-700"}`}>
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Stock</th>
                    <th className="px-4 py-3 text-center rounded-r-lg">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((product) =>
                    <tr
                      key={product._id}
                      className={`transition-colors ${theme === "dark" ? "bg-[#2A2724] hover:bg-[#3A3734]" : "bg-white hover:bg-gray-50"}`}>
                      <td
                        className={`px-4 py-3 font-medium flex items-center gap-3 ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>
                        <div
                          className={`w-10 h-10 rounded-md overflow-hidden border items-center justify-center flex ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
                          {product.itemImage ?
                            <img
                              src={product.itemImage}
                              alt="item"
                              className="w-full h-full object-cover" /> :
                            <span className="text-[10px] text-gray-400">IMG</span>
                          }
                        </div>
                        <div>
                          <div className="text-sm font-bold">{product.itemName}</div>
                          <div className="text-[10px] text-gray-400">{product.sku || "No SKU"}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{product.category}</td>
                      <td className="px-4 py-3 text-center font-bold text-orange-600">
                        {product.calculatedStock}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold ${product.calculatedStock === 0 ?
                            "bg-red-100 text-red-600" :
                            "bg-orange-100 text-orange-600"}`}>
                          {product.calculatedStock === 0 ? "Out of Stock" : "Low Stock"}
                        </span>
                      </td>
                    </tr>
                  )}
                  {lowStockProducts.length === 0 &&
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-8 text-center text-gray-400 italic">
                        No low stock items
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <div className="pt-4 text-right">
                <button
                  onClick={() => navigate("/inventory")}
                  className="text-xs text-gray-500 hover:text-[#AD7F65] flex items-center justify-end gap-1 ml-auto cursor-pointer">
                  More {">"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <TopSellingModal
        isOpen={showTopSellingModal}
        onClose={() => setShowTopSellingModal(false)}
        products={topSellingProducts}
        timeframe={timeframe} />

    </div>
  );
};

export default Dashboard;