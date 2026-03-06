import Header from "@/components/shared/header";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import Svg, { Circle, G } from "react-native-svg";
import { transactionAPI } from "../../services/api";

const SCREEN_WIDTH = Dimensions.get("window").width;

const PIE_COLORS = ["#F4A6C1", "#A7C7E7", "#FAD02E", "#98FB98", "#FFB7B2", "#C3B1E1"];

// Pie chart using react-native-svg
function SimplePieChart({ data }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
  if (total === 0) return null;

  const size = 160;
  const radius = size / 4;
  const strokeWidth = size / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;

  return (
    <View style={{ width: "100%", alignItems: "center", marginVertical: 8 }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {data.map((item, i) => {
            const pct = item.value / total;
            const dashLength = circumference * pct;
            const dashGap = circumference - dashLength;
            const offset = circumference * accumulated;
            accumulated += pct;
            return (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                stroke={PIE_COLORS[i % PIE_COLORS.length]}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${dashLength} ${dashGap}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>
      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 6, justifyContent: "center" }}>
        {data.map((item, i) => {
          const pct = ((item.value / total) * 100).toFixed(0);
          return (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", width: "46%", marginBottom: 6 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                  marginRight: 6,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#333" }} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={{ fontSize: 10, color: "#888" }}>
                  ₱{(item.value || 0).toLocaleString()} · {pct}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function Dashboard() {
  const [timeframe, setTimeframe] = useState("daily");
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [salesFilter, setSalesFilter] = useState("Both");
  const [showSalesFilterMenu, setShowSalesFilterMenu] = useState(false);

  const [metrics, setMetrics] = useState({
    totalSalesToday: 0,
    totalTransactions: 0,
    growthRate: 0,
    lowStockItems: 0,
  });

  const [salesOverTimeData, setSalesOverTimeData] = useState([]);
  const [salesByCategoryData, setSalesByCategoryData] = useState([]);
  const [topSellingProducts, setTopSellingProducts] = useState([]);

  const toastTranslate = useRef(new Animated.Value(-60)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const timeframeApiMap = {
    daily: "daily",
    weekly: "weekly",
    monthly: "monthly",
    yearly: "yearly",
  };

  const fetchAll = async (tf = timeframe, showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const apiTf = timeframeApiMap[tf] || "daily";

      const [statsRes, sotRes, catRes, topRes] = await Promise.allSettled([
        transactionAPI.getDashboardStats(apiTf),
        transactionAPI.getSalesOverTime(apiTf),
        transactionAPI.getSalesByCategory(),
        transactionAPI.getTopSelling({ sort: "most", limit: 10, period: apiTf }),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value?.success) {
        const d = statsRes.value.data;
        setMetrics({
          totalSalesToday: d.totalSalesToday || 0,
          totalTransactions: d.totalTransactions || 0,
          growthRate: d.growthRate || 0,
          lowStockItems: d.lowStockItems || 0,
        });
      }

      if (sotRes.status === "fulfilled" && sotRes.value?.success) {
        const mapped = (sotRes.value.data || []).map((item) => ({
          ...item,
          revenue: item.revenue ?? item.totalSales ?? 0,
        }));
        setSalesOverTimeData(mapped);
      }

      if (catRes.status === "fulfilled" && catRes.value?.success) {
        setSalesByCategoryData(catRes.value.data || []);
      }

      if (topRes.status === "fulfilled" && topRes.value?.success) {
        setTopSellingProducts(topRes.value.data || []);
      }
    } catch (err) {
      console.warn("Dashboard fetch error:", err?.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setSyncMessage("Syncing...");
    setSyncModalVisible(true);
    try {
      await fetchAll(timeframe, false);
      setSyncMessage("Sync complete");
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setRefreshing(false);
      setTimeout(() => setSyncModalVisible(false), 1200);
    }
  };

  useEffect(() => {
    if (syncModalVisible) {
      Animated.parallel([
        Animated.timing(toastTranslate, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(toastTranslate, { toValue: -20, duration: 220, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [syncModalVisible]);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const stored = await AsyncStorage.getItem("currentEmployee");
        if (stored) setCurrentUser(JSON.parse(stored));
        await fetchAll(timeframe);
      };
      load();
    }, [timeframe])
  );

  const welcomeName =
    currentUser?.firstName || currentUser?.name || currentUser?.email?.split("@")[0] || "Owner";

  const formatCurrency = (v) =>
    `₱${(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatCurrencyShort = (v) => {
    if (v >= 1000000) return `₱${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `₱${(v / 1000).toFixed(1)}K`;
    return `₱${v}`;
  };

  const TAB_LABELS = [
    { label: "Today", value: "daily" },
    { label: "Week", value: "weekly" },
    { label: "Month", value: "monthly" },
    { label: "Year", value: "yearly" },
  ];

  // Build chart data for BarChart
  const chartLabels = salesOverTimeData.slice(-7).map((d, i) => {
    if (timeframe === "weekly") return `W${i + 1}`;
    const p = d.period || "";
    const parts = p.split(" ");
    return parts[parts.length - 1] || p;
  });
  const chartRevenue = salesOverTimeData.slice(-7).map((d) => d.revenue || 0);
  const hasChartData = chartRevenue.length > 0 && chartRevenue.some((v) => v > 0);

  const barData = {
    labels: chartLabels.length > 0 ? chartLabels : ["No Data"],
    datasets: [{ data: chartRevenue.length > 0 ? chartRevenue : [0] }],
  };

  const chartConfig = {
    backgroundColor: "#fff",
    backgroundGradientFrom: "#fff",
    backgroundGradientTo: "#fff",
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(136, 132, 216, ${opacity})`,
    labelColor: () => "#6b7280",
    style: { borderRadius: 12 },
    propsForDots: { r: "3", strokeWidth: "2", stroke: "#fff" },
    barPercentage: 0.6,
    fillShadowGradient: "#8884d8",
    fillShadowGradientOpacity: 1,
  };

  const KPI_CARDS = [
    {
      label: "Total Sales",
      desc: "Total revenue from all transactions",
      value: formatCurrencyShort(metrics.totalSalesToday),
      labelColor: "#2563EB",
    },
    {
      label: "Total Transactions",
      desc: "Number of sales made today",
      value: metrics.totalTransactions,
      labelColor: "#7C3AED",
    },
    {
      label: "Average Growth Rate",
      desc: "Sales performance change (%).",
      value: `${metrics.growthRate ? Number(metrics.growthRate).toFixed(1) : "0"}%`,
      labelColor: "#16a34a",
    },
    {
      label: "Low Stock Items",
      desc: "Number of products below stock threshold",
      value: metrics.lowStockItems,
      labelColor: "#DC2626",
    },
  ];

  return (
    <View style={styles.container}>
      <Header />

      {/* Toast */}
      <Animated.View
        pointerEvents={syncModalVisible ? "auto" : "none"}
        style={[
          styles.toastContainer,
          { transform: [{ translateY: toastTranslate }], opacity: toastOpacity },
        ]}
      >
        <View style={styles.toastInner}>
          <Text style={styles.toastText}>{syncMessage}</Text>
          <TouchableOpacity onPress={() => setSyncModalVisible(false)} style={styles.toastClose}>
            <Text style={styles.toastCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <View style={styles.whitecard}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#AD7F65"]} tintColor="#AD7F65" />
          }
        >
          {/* Welcome */}
          <View style={styles.welcomeCard}>
            <Image
              source={
                currentUser?.profileImage || currentUser?.image
                  ? { uri: currentUser.profileImage || currentUser.image }
                  : require("../(tabs)/iconz/default.jpeg")
              }
              style={styles.profileImage}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeText}>Hi, {welcomeName}!</Text>
              <Text style={styles.welcomeSub}>Here's your overview for today</Text>
            </View>
          </View>

          {/* Time Filter Tabs */}
          <View style={styles.tabRow}>
            {TAB_LABELS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.tab, timeframe === t.value && styles.tabActive]}
                onPress={() => setTimeframe(t.value)}
              >
                <Text style={[styles.tabText, timeframe === t.value && styles.tabTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* KPI Cards */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#AD7F65" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.kpiGrid}>
              {/* Row 1 */}
              <View style={styles.kpiRow}>
                {KPI_CARDS.slice(0, 2).map((card, idx) => (
                  <View key={idx} style={styles.kpiCard}>
                    <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{card.value}</Text>
                    <Text style={[styles.kpiLabel, { color: card.labelColor }]}>{card.label}</Text>
                    <Text style={styles.kpiDesc} numberOfLines={2}>{card.desc}</Text>
                  </View>
                ))}
              </View>
              {/* Row 2 */}
              <View style={styles.kpiRow}>
                {KPI_CARDS.slice(2, 4).map((card, idx) => (
                  <View key={idx} style={styles.kpiCard}>
                    <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit>{card.value}</Text>
                    <Text style={[styles.kpiLabel, { color: card.labelColor }]}>{card.label}</Text>
                    <Text style={styles.kpiDesc} numberOfLines={2}>{card.desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Top Selling Products */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Top Selling Products</Text>
            <View style={styles.sortBadge}><Text style={styles.sortBadgeText}>Sort By ▾</Text></View>
          </View>
          <FlatList
            horizontal
            data={topSellingProducts.slice(0, 6)}
            keyExtractor={(item, i) => item.productId || String(i)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8, paddingTop: 4, paddingLeft: 2 }}
            ListEmptyComponent={
              <Text style={{ color: "#aaa", fontSize: 13, paddingVertical: 16 }}>No data available</Text>
            }
            renderItem={({ item, index }) => (
              <View style={styles.topProductCard}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.productImageWrap}>
                  {item.itemImage ? (
                    <Image source={{ uri: item.itemImage }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, { backgroundColor: "#eee", justifyContent: "center", alignItems: "center" }]}>
                      <Text style={{ fontSize: 9, color: "#999" }}>IMG</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.productName} numberOfLines={2}>{item.itemName}</Text>
                <Text style={styles.productSold}>{item.totalQuantitySold} sold</Text>
              </View>
            )}
          />

          {/* Sales Over Time */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <View>
              <Text style={styles.sectionTitle}>Sales Over Time</Text>
              <Text style={styles.sectionSub}>Total sales from all transactions during a specific period.</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            {hasChartData ? (
              <BarChart
                data={barData}
                width={SCREEN_WIDTH - 56}
                height={180}
                chartConfig={chartConfig}
                style={{ borderRadius: 10, marginLeft: -8 }}
                withInnerLines={false}
                withVerticalLines={false}
                showBarTops={false}
                fromZero
                yAxisLabel=""
                yAxisSuffix=""
                formatYLabel={(v) => formatCurrencyShort(Number(v))}
              />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>No sales data for this period</Text>
              </View>
            )}
          </View>

          {/* Sales By Category */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <View>
              <Text style={styles.sectionTitle}>Sales By Category</Text>
              <Text style={styles.sectionSub}>Revenue distribution across product categories</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            {salesByCategoryData.length > 0 ? (
              <SimplePieChart data={salesByCategoryData} />
            ) : (
              <View style={styles.emptyChart}>
                <Text style={styles.emptyChartText}>No category data available</Text>
              </View>
            )}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#53321c" },
  whitecard: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: -10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingTop: 4,
  },
  scroll: { paddingHorizontal: 16 },

  // Toast
  toastContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
    borderRadius: 14,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#53321c",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "500", flex: 1, marginLeft: 8 },
  toastClose: { padding: 4 },
  toastCloseText: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "600" },

  // Welcome
  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 12,
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 14,
    borderWidth: 2,
    borderColor: "#AD7F65",
  },
  welcomeText: { fontSize: 20, fontWeight: "800", color: "#1a1a1a" },
  welcomeSub: { fontSize: 13, color: "#666", marginTop: 2 },

  // Tabs
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: { backgroundColor: "#1f1f1f" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#fff" },

  // Loading
  loadingBox: { padding: 40, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, color: "#666", fontSize: 14 },

  // KPI Grid
  kpiGrid: {
    marginBottom: 20,
  },
  kpiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  kpiCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    flexDirection: "column",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  kpiValue: { fontSize: 26, fontWeight: "800", color: "#1a1a1a", marginBottom: 4, letterSpacing: -0.5 },
  kpiLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  kpiDesc: { fontSize: 9, color: "#9ca3af", lineHeight: 12 },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#1a1a1a" },
  sectionSub: { fontSize: 11, color: "#9ca3af", marginTop: 2, maxWidth: "90%" },
  sortBadge: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sortBadgeText: { fontSize: 12, color: "#6b7280" },

  // Top selling
  topProductCard: {
    width: 100,
    marginRight: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  rankBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#AD7F65",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  rankText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  productImageWrap: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
    backgroundColor: "#e5e7eb",
  },
  productImage: { width: "100%", height: "100%", resizeMode: "cover" },
  productName: { fontSize: 10, fontWeight: "700", color: "#1a1a1a", textAlign: "center", marginBottom: 2 },
  productSold: { fontSize: 10, color: "#AD7F65", fontWeight: "600" },

  // Chart
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  emptyChart: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyChartText: { color: "#9ca3af", fontSize: 13 },

  // Filter dropdown
  filterBtn: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterBtnText: { fontSize: 11, color: "#6b7280" },
  filterMenu: {
    position: "absolute",
    right: 0,
    top: 32,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
    minWidth: 90,
  },
  filterMenuItem: { paddingHorizontal: 14, paddingVertical: 10 },
  filterMenuText: { fontSize: 13, color: "#374151" },

  // Chart section divider (used in Both mode)
  chartDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  chartDividerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
});
