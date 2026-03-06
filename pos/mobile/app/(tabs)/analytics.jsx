import Header from "@/components/shared/header";
import { useData } from "@/context/DataContext";
import { useFocusEffect } from "@react-navigation/native";
import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  useCallback,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import Animated, {
  FadeIn,
  Layout
} from "react-native-reanimated";
import * as XLSX from "xlsx";
import {
  stockAPI,
  stockMovementAPI,
  transactionAPI
} from "../../services/api";

global.Buffer = Buffer;

export default function Analytics() {
  const {
    transactions: cachedTransactions,
    products: cachedProducts,
    fetchTransactions,
    fetchProducts,
    invalidateCache,
    inventoryStats,
    calculateDashboardStats,
  } = useData();

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartType, setChartType] = useState("daily");
  const [initialLoad, setInitialLoad] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const analyticsCalculated = useRef(false);

  // Real-time data states
  const [dashboardStats, setDashboardStats] = useState({
    totalSalesToday: 0,
    totalTransactions: 0,
    averageTransactionValue: 0,
    salesGrowthRate: 0,
    previousPeriodSales: 0,
    previousPeriodTransactions: 0,
    profit: 0,
    cogs: 0,
  });

  const [chartData, setChartData] = useState({
    daily: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [{ data: [0] }],
    },
    monthly: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [{ data: [0] }],
    },
    yearly: { labels: ["2023", "2024", "2025"], datasets: [{ data: [0] }] },
  });

  const [topProducts, setTopProducts] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stockInData, setStockInData] = useState([0]);
  const [stockOutData, setStockOutData] = useState([0]);
  const [stockChartLabels, setStockChartLabels] = useState([
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
    "Sun",
  ]);

  // Memoize chart configurations to prevent unnecessary re-renders
  const commonChartConfig = useMemo(() => ({
    backgroundColor: "#fff",
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: { borderRadius: 16 },
    propsForDots: { r: "4", strokeWidth: "2", stroke: "#fff" },
  }), []);

  const salesChartConfig = useMemo(() => ({
    ...commonChartConfig,
    color: (opacity = 1) => `rgba(173, 127, 101, ${opacity})`,
  }), [commonChartConfig]);

  const stockInChartConfig = useMemo(() => ({
    ...commonChartConfig,
    color: (opacity = 1) => `rgba(16, 185, 129, 1)`, // Green #10B981 (Solid)
    barPercentage: 0.6,
    fillShadowGradient: "#10B981",
    fillShadowGradientFrom: "#10B981",
    fillShadowGradientTo: "#10B981",
    fillShadowGradientOpacity: 1,
    propsForBackgroundLines: {
      strokeWidth: 0.5,
      stroke: "#e0e0e0",
    },
    propsForLabels: { fontSize: 10 },
  }), [commonChartConfig]);

  const stockOutChartConfig = useMemo(() => ({
    ...commonChartConfig,
    color: (opacity = 1) => `rgba(239, 68, 68, 1)`, // Red #EF4444 (Solid)
    barPercentage: 0.6,
    fillShadowGradient: "#EF4444",
    fillShadowGradientFrom: "#EF4444",
    fillShadowGradientTo: "#EF4444",
    fillShadowGradientOpacity: 1,
    propsForBackgroundLines: {
      strokeWidth: 0.5,
      stroke: "#e0e0e0",
    },
    propsForLabels: { fontSize: 10 },
  }), [commonChartConfig]);

  const screenWidth = useMemo(() => Dimensions.get("window").width - 64, []);


  // Fetch all analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchDashboardStats(chartType), // Use current chartType
        fetchSalesOverTime(),
        fetchLowStockItems(),
        fetchStockMovements(chartType),
        fetchTopProducts(),
        calculateDashboardStats(true), // Fetch inventory stats from DataContext
      ]);
    } catch (error) {
      console.warn("Failed to fetch analytics:", error?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch top selling products
  const fetchTopProducts = async () => {
    try {
      const response = await transactionAPI.getTopSelling({
        limit: 5,
        period: chartType,
      });
      if (response?.success && response.data) {
        // Map backend data to component format
        const mappedProducts = response.data.map((product) => ({
          item: product.itemName || "Unknown",
          quantity: product.totalQuantitySold || 0,
          total: product.totalQuantitySold || 0, // Using quantity as total for now based on UI
          image: product.itemImage
            ? { uri: product.itemImage }
            : require("./iconz/profile3.png"),
        }));
        setTopProducts(mappedProducts);
      }
    } catch (error) {
      console.warn("Failed to fetch top products:", error?.message);
    }
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async (
    timeframe = "daily",
    showLoader = true,
  ) => {
    try {
      if (showLoader) setLoading(true);
      const response = await transactionAPI.getDashboardStats(timeframe);

      if (response?.success && response.data) {
        const {
          totalSalesToday,
          totalTransactions,
          growthRate,
          lowStockItems,
          totalSalesPrevious,
          profit,
        } = response.data;
        // totalSalesToday in response is actually totalSales for the period requested

        const avgValue =
          totalTransactions > 0 ? totalSalesToday / totalTransactions : 0;

        // COGS = Total Sales - Profit
        const cogs = (totalSalesToday || 0) - (profit || 0);

        setDashboardStats({
          totalSalesToday: totalSalesToday || 0,
          totalTransactions: totalTransactions || 0,
          averageTransactionValue: avgValue,
          salesGrowthRate: growthRate || 0,
          previousPeriodSales: totalSalesPrevious || 0,
          previousPeriodTransactions: 0,
          profit: profit || 0,
          cogs: cogs > 0 ? cogs : 0,
        });
      }
    } catch (error) {
      console.warn("Failed to fetch dashboard stats:", error?.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const [salesData, setSalesData] = useState({
    labels: ["Loading..."],
    datasets: [{ data: [0] }],
  });

  const preparedSalesData = useMemo(() => ({
    labels: salesData.labels.length > 0 ? salesData.labels : ["No Data"],
    datasets: [
      {
        data: salesData.datasets[0].data.length > 0
          ? salesData.datasets[0].data
          : [0],
      },
    ],
  }), [salesData]);

  // Fetch sales over time for charts
  const fetchSalesOverTime = async () => {
    try {
      const response = await transactionAPI.getSalesOverTime(chartType);

      if (response && response.success && response.data) {
        const labels = response.data.map((item) => item.period);
        const data = response.data.map(
          (item) => item.revenue || item.totalSales || 0,
        );

        if (labels.length === 0) {
          setSalesData({
            labels: ["No Data"],
            datasets: [{ data: [0] }],
          });
        } else {
          setSalesData({
            labels,
            datasets: [{ data }],
          });
        }
      }
    } catch (error) {
      console.warn("Failed to fetch sales over time:", error?.message);
    }
  };

  // Fetch low stock items
  const fetchLowStockItems = async () => {
    try {
      // OPTIMIZATION: Use dedicated endpoint instead of fetching all products
      const response = await stockAPI.getLowStock();
      if (response?.success && response.data) {
        const items = response.data.map((p, idx) => ({
          id: p._id || p.sku || idx,
          name: p.itemName || "Unknown Product",
          stocks: p.currentStock || 0,
          status: p.alertType === 'out_of_stock' || (p.currentStock || 0) === 0 ? "Out of Stock" : "Low Stock",
        }));

        setLowStockItems(items);
      }
    } catch (error) {
      console.warn("Failed to fetch low stock items:", error?.message);
    }
  };

  // Fetch stock movements for charts
  const fetchStockMovements = async (timeframe = "daily") => {
    try {
      const response = await stockMovementAPI.getStockStatsOverTime(timeframe);
      if (response?.success && response.data) {
        const { stockIn, pullOut, labels } = response.data;

        // We might want to update labels for these charts specifically if they differ from default
        // But for now, let's just update the data
        // The backend returns 7 days of data. The current chart expects 6?
        // Let's adjust the chart to show 7 days or slice the data.
        // The current chart hardcodes labels ["Mon", "Tue", ...].
        // We should probably update the labels in the chart component too,
        // but for now let's just map the data.

        // The backend returns 7 days, ending today.
        // Let's take the last 7 days.

        setStockInData(stockIn);
        setStockOutData(pullOut);

        // Also update labels if possible, but the state for labels is local to the chart config in the render function
        // We need a state for stock chart labels
        setStockChartLabels(labels);
      }
    } catch (error) {
      console.warn("Failed to fetch stock movements:", error?.message);
    }
  };

  // Fetch dashboard stats (loading spinner) on focus only
  useFocusEffect(
    useCallback(() => {
      const loadStats = async () => {
        // We removed the heavy "fetchTransactions" and "fetchProducts" calls here
        // as they are not needed for the analytics view (which uses specific endpoints now)
        await fetchAnalyticsData();
        analyticsCalculated.current = true;
        setInitialLoad(false);
      };
      loadStats();
    }, []),
  );

  // Cache stats per filter to avoid re-fetching when switching back
  const statsCache = useRef({});

  // Fetch chart data AND stats when chartType changes (no global spinner)
  // Also fetch top products when chartType changes
  useFocusEffect(
    useCallback(() => {
      const updateForFilter = async () => {
        // If we have cached data for this filter, show it instantly (no skeleton)
        if (statsCache.current[chartType]) {
          setDashboardStats(statsCache.current[chartType]);
          setStatsLoading(false);
        } else {
          setStatsLoading(true);
        }

        // Fetch fresh data in background
        await Promise.all([
          fetchSalesOverTime(),
          fetchDashboardStats(chartType, false),
          fetchStockMovements(chartType),
          fetchTopProducts(),
        ]);

        // Cache the updated stats for this filter
        setDashboardStats(prev => {
          statsCache.current[chartType] = prev;
          return prev;
        });

        setStatsLoading(false);
      };
      updateForFilter();
    }, [chartType]),
  );

  // Pull to refresh - force fetch new data
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    invalidateCache("all");
    statsCache.current = {}; // Clear stats cache on refresh
    analyticsCalculated.current = false;
    await Promise.all([fetchTransactions(true), fetchProducts(true)]);
    // Re-fetch everything with current chartType
    await Promise.all([
      fetchDashboardStats(chartType),
      fetchSalesOverTime(),
      fetchLowStockItems(),
      fetchStockMovements(chartType),
      fetchTopProducts(),
    ]);
    setRefreshing(false);
  }, [invalidateCache, fetchTransactions, fetchProducts, chartType]);

  // Toggle expand for low stock table
  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const visibleData = useMemo(() => expanded ? lowStockItems : lowStockItems.slice(0, 3), [expanded, lowStockItems]);


  // Format currency
  const formatCurrency = (value) => {
    return `₱${(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Format currency short (e.g. ₱25.4K, ₱150K, ₱1.2M)
  const formatCurrencyShort = (v) => {
    const n = Number(v) || 0;
    if (n === 0) return "₱0";
    if (n >= 1000000) {
      const m = n / 1000000;
      return `₱${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
    }
    if (n >= 1000) {
      const k = n / 1000;
      return `₱${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`;
    }
    return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
  };

  // Get period label text for descriptions
  const getPeriodLabel = () => {
    switch (chartType) {
      case "daily": return "today";
      case "weekly": return "this week";
      case "monthly": return "this month";
      case "yearly": return "this year";
      default: return "today";
    }
  };

  const TAB_LABELS = [
    { label: "Today", value: "daily" },
    { label: "Week", value: "weekly" },
    { label: "Month", value: "monthly" },
    { label: "Year", value: "yearly" },
  ];

  // Format percentage
  const formatPercentage = (value) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${(value || 0).toFixed(1)}%`;
  };

  // Calculate comparison text
  const getComparisonText = (current, previous) => {
    if (previous === 0 || !previous) return "";
    const change = ((current - previous) / previous) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(0)}% vs last period`;
  };

  const handleExportExcel = async () => {
    try {
      const sales = salesData.datasets[0].data.map((val, i) => ({
        Period: salesData.labels[i] || `Period ${i + 1}`,
        Sales: val,
      }));

      const lowStock = lowStockItems.map((item) => ({
        Product: item.name,
        Stock: item.stocks,
        Status: item.status,
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(sales),
        "Sales Data",
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(lowStock),
        "Low Stock",
      );

      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const fileUri = FileSystem.cacheDirectory + "Analytics_Report.xlsx";

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(fileUri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Export Analytics Report",
        UTI: "com.microsoft.excel.xlsx",
      });

      Alert.alert("Success", "Analytics report exported!");
    } catch (error) {
      console.error("Export Error:", error);
      Alert.alert("Error", "Failed to export Excel: " + error.message);
    }
  };

  const handlePrint = async () => {
    try {
      const html = `
        <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2 style="text-align:center;">Create Your Style Analytics Report</h2>
            
            <h3>Dashboard Summary</h3>
            <table border="1" style="width:100%;border-collapse:collapse;">
              <tr><td>Total Sales Today</td><td>${formatCurrency(dashboardStats.totalSalesToday)}</td></tr>
              <tr><td>Total Transactions</td><td>${dashboardStats.totalTransactions}</td></tr>
              <tr><td>Average Transaction</td><td>${formatCurrency(dashboardStats.averageTransactionValue)}</td></tr>
              <tr><td>Growth Rate</td><td>${formatPercentage(dashboardStats.salesGrowthRate)}</td></tr>
            </table>

            <h3 style="margin-top:25px;">Sales Over Time (${chartType})</h3>
            <table border="1" style="width:100%;border-collapse:collapse;">
              <tr><th>Period</th><th>Sales</th></tr>
              ${salesData.labels
          .map(
            (label, i) =>
              `<tr><td>${label}</td><td>${formatCurrency(salesData.datasets[0].data[i])}</td></tr>`,
          )
          .join("")}
            </table>

            <h3 style="margin-top:25px;">Low Stock Items</h3>
            <table border="1" style="width:100%;border-collapse:collapse;">
              <tr><th>Product</th><th>Stock</th><th>Status</th></tr>
              ${lowStockItems
          .map(
            (item) =>
              `<tr><td>${item.name}</td><td>${item.stocks}</td><td>${item.status}</td></tr>`,
          )
          .join("")}
            </table>

            <p style="text-align:center;margin-top:30px;">Generated on ${new Date().toLocaleString()}</p>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (error) {
      console.error("Print Error:", error);
      Alert.alert("Error", "Failed to print report: " + error.message);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <Header />
        <View style={[styles.whitecard, styles.loadingContainer]}>
          <ActivityIndicator size="large" color="#AD7F65" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.whitecard}>
        <ScrollView
          style={styles.main}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#AD7F65"]}
            />
          }
        >
          {/* TIME FILTER TABS */}
          <View style={styles.filterRow}>
            <View style={styles.tabRow}>
              {TAB_LABELS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.filterTab, chartType === t.value && styles.filterTabActive]}
                  onPress={() => setChartType(t.value)}
                >
                  <Text style={[styles.filterTabText, chartType === t.value && styles.filterTabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterIconBtn} onPress={handleExportExcel}>
                <Image
                  source={require("./iconz/print.png")}
                  style={{ width: 19, height: 19 }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* DASHBOARD STATS */}
          {statsLoading ? (
            <View style={styles.statsLoadingContainer}>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.statCardSkeleton]}>
                  <View style={styles.skeletonValue} />
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonDesc} />
                </View>
                <View style={[styles.statCard, styles.statCardSkeleton]}>
                  <View style={styles.skeletonValue} />
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonDesc} />
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, styles.statCardSkeleton]}>
                  <View style={styles.skeletonValue} />
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonDesc} />
                </View>
                <View style={[styles.statCard, styles.statCardSkeleton]}>
                  <View style={styles.skeletonValue} />
                  <View style={styles.skeletonLabel} />
                  <View style={styles.skeletonDesc} />
                </View>
              </View>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(350)} layout={Layout}>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {formatCurrencyShort(dashboardStats.totalSalesToday)}
                  </Text>
                  <Text style={[styles.statLabel, { color: "#2563EB" }]}>Total Sales</Text>
                  <Text style={styles.statLabel1}>
                    Total revenue {getPeriodLabel()}
                  </Text>
                  <Text style={styles.statLabel2}>
                    {getComparisonText(
                      dashboardStats.totalSalesToday,
                      dashboardStats.previousPeriodSales,
                    )}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {formatCurrencyShort(dashboardStats.profit)}
                  </Text>
                  <Text style={[styles.statLabel, { color: "#16a34a" }]}>Total Profit</Text>
                  <Text style={styles.statLabel1}>
                    Total earnings {getPeriodLabel()}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {formatCurrencyShort(dashboardStats.cogs)}
                  </Text>
                  <Text style={[styles.statLabel, { color: "#D97706" }]}>Cost of Goods Sold</Text>
                  <Text style={styles.statLabel1}>
                    Cost of items sold {getPeriodLabel()}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text
                    style={styles.statValue}
                  >
                    {formatCurrencyShort(inventoryStats.inventoryValue || 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: "#DC2626" }]}>Inventory Value</Text>
                  <Text style={styles.statLabel1}>
                    Total value of products in inventory
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}



          <View style={[styles.chartContainer, { marginBottom: 24 }]}>
            <Text style={[styles.chartTitle, { marginBottom: 16 }]}>
              Stock In
            </Text>
            <BarChart
              data={{
                labels: stockChartLabels,
                datasets: [{ data: stockInData }],
              }}
              width={screenWidth} // Responsive width
              height={220}
              yAxisLabel=""
              chartConfig={stockInChartConfig}
              style={{ marginTop: 8, marginBottom: 8, paddingRight: 0 }}
              fromZero
              showBarTops={false}
              showValuesOnTopOfBars={true}
            />
          </View>

          <View style={[styles.chartContainer, { marginBottom: 24 }]}>
            <Text style={[styles.chartTitle, { marginBottom: 16 }]}>
              Pull Outs
            </Text>
            <BarChart
              data={{
                labels: stockChartLabels,
                datasets: [{ data: stockOutData }],
              }}
              width={screenWidth} // Responsive width
              height={220}
              yAxisLabel=""
              chartConfig={stockOutChartConfig}
              style={{ marginTop: 8, marginBottom: 8, paddingRight: 0 }}
              fromZero
              showBarTops={false}
              showValuesOnTopOfBars={true}
            />
          </View>

          {/* Products Performance */}
          <View style={[styles.chartContainer, { height: 190 }]}>
            <Text style={styles.chartTitle}>Products Performance</Text>
            {topProducts.length === 0 ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#888", fontSize: 14 }}>
                  No products sold yet.
                </Text>
              </View>
            ) : (
              <FlatList
                data={topProducts}
                keyExtractor={(item, index) => item.item + index}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 10 }}
                renderItem={({ item }) => (
                  <View style={styles.carouselCard}>
                    <Image source={item.image} style={styles.carouselImage} />
                    <Text style={styles.carouselLabel}>{item.item}</Text>
                    <Text style={styles.carouselLabel}>Sold: {item.total}</Text>
                  </View>
                )}
              />
            )}
          </View>

          {/* Low & Out-of-Stock Items */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>
                  Low & Out-of-Stock Items
                </Text>
                <Text style={styles.sectionSubtitle}>
                  Inventory items that need attention
                </Text>
              </View>
              <TouchableOpacity
                onPress={toggleExpand}
                style={styles.viewMoreButton}
                activeOpacity={0.7}
              >
                <Text style={styles.viewMoreText}>
                  {expanded ? "Show Less" : "View All"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text
                  style={[styles.headerText, { flex: 3, textAlign: "left" }]}
                >
                  Product
                </Text>
                <Text
                  style={[styles.headerText, { flex: 1, textAlign: "center" }]}
                >
                  Stocks
                </Text>
                <Text
                  style={[styles.headerText, { flex: 1.5, textAlign: "right" }]}
                >
                  Status
                </Text>
              </View>

              <View style={styles.tableBody}>
                {visibleData.length === 0 ? (
                  <View style={styles.emptyStateContainer}>
                    <Text style={styles.emptyStateText}>
                      ✓ All items are well stocked
                    </Text>
                    <Text style={styles.emptyStateSubtext}>
                      No items need attention at this time
                    </Text>
                  </View>
                ) : (
                  visibleData.map((item, index) => (
                    <View
                      key={item.id.toString()}
                      style={[
                        styles.tableRow,
                        index % 2 === 0 && styles.evenRow,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rowText,
                          { flex: 3, textAlign: "left", fontWeight: "500" },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.rowText,
                          { flex: 1, textAlign: "center" },
                        ]}
                      >
                        {item.stocks}
                      </Text>
                      <View style={[styles.statusCell, { flex: 1.5 }]}>
                        <Text
                          style={[
                            styles.statusText,
                            item.status === "Out of Stock"
                              ? styles.statusTextCritical
                              : styles.statusTextLow,
                          ]}
                        >
                          {item.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  sectionContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 30,
    padding: 16,
    width: "100%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#888",
  },
  viewMoreButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: "#f5f5f5",
  },
  viewMoreText: {
    color: "#666",
    fontSize: 13,
    fontWeight: "500",
  },
  tableContainer: {
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableBody: {
    backgroundColor: "#fff",
    width: "100%",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f5",
    width: "100%",
  },
  evenRow: {
    backgroundColor: "#fcfcfc",
  },
  rowText: {
    fontSize: 14,
    color: "#444",
  },
  statusCell: {
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
    width: "100%",
    paddingRight: 8,
  },
  statusTextLow: {
    color: "#E6A23C",
  },
  statusTextCritical: {
    color: "#F56C6C",
  },
  container: {
    flex: 1,
    backgroundColor: "#53321c",
  },
  main: {
    width: "100%",
    paddingHorizontal: 16,
  },
  whitecard: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: -10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 3,
    flex: 1,
    marginRight: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: "#1f1f1f",
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  filterActions: {
    flexDirection: "row",
    gap: 8,
  },
  filterIconBtn: {
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 10,
  },
  statsLoadingContainer: {
    marginBottom: 4,
  },
  statCardSkeleton: {
    justifyContent: "center",
    minHeight: 100,
  },
  skeletonValue: {
    width: "60%",
    height: 22,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
    marginBottom: 8,
  },
  skeletonLabel: {
    width: "50%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
    marginBottom: 6,
  },
  skeletonDesc: {
    width: "80%",
    height: 8,
    borderRadius: 3,
    backgroundColor: "#f3f4f6",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1a1a1a",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  statValuePositive: {
    color: "#09A046",
  },
  statValueNegative: {
    color: "#F56C6C",
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "700",
    fontStyle: "italic",
    marginBottom: 6,
  },
  statLabel1: {
    fontSize: 9,
    color: "#9ca3af",
    lineHeight: 12,
  },
  statLabel2: {
    fontSize: 10,
    color: "#09A046",
    marginTop: 4,
    fontWeight: "500",
  },
  chartContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
    paddingHorizontal: 2,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#53321c",
  },
  chart: {
    borderRadius: 16,
  },
  buttonContainer: {
    flexDirection: "row",
  },
  chartButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginLeft: 6,
    backgroundColor: "#e4d7ce",
  },
  activeButton: {
    backgroundColor: "#AD7F65",
  },
  buttonText: {
    fontSize: 13,
    color: "#53321c",
    fontWeight: "600",
  },
  activeButtonText: {
    color: "#fff",
  },
  carouselCard: {
    width: 110,
    height: 130,
    borderRadius: 8,
    backgroundColor: "#fafafa",
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
    elevation: 1,
  },
  carouselImage: {
    width: 85,
    height: 75,
    borderRadius: 6,
    resizeMode: "cover",
  },
  carouselLabel: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 6,
    textAlign: "center",
    color: "#333",
  },
  emptyStateContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#09A046",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
  },
});
