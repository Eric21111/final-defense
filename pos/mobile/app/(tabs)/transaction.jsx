import Header from "@/components/shared/header";
import { useData } from "@/context/DataContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import * as Print from "expo-print";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Function to format date and time
const formatDateTime = (date = new Date()) => {
  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };
  return date.toLocaleString("en-US", options);
};

export default function Transaction() {
  const {
    transactions: cachedTransactions,
    transactionsLoading,
    fetchTransactions: fetchCachedTransactions,
    invalidateCache,
  } = useData();

  const [search, setSearch] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(formatDateTime());
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState("All");

  const TIME_FILTERS = ["All", "Today", "Yesterday", "This Week", "This Month"];

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const isFetching = useRef(false);
  const lastFetchTime = useRef(0);

  // Filter and sort transactions (optimized - single pass)
  // Note: This filters ONLY loaded transactions
  const filteredTransactions = useMemo(() => {
    const searchLower = search?.toLowerCase() || "";

    // Calculate date boundaries for time filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return cachedTransactions
      .filter((t) => {
        // Filter out voided and returns
        if (t.status === "Voided" || (t.paymentMethod === "return" && t.originalTransactionId)) {
          return false;
        }

        // Time filter
        if (timeFilter !== "All") {
          const txDate = new Date(t.checkedOutAt || t.createdAt || t.date || 0);
          if (timeFilter === "Today" && txDate < startOfToday) return false;
          if (timeFilter === "Yesterday" && (txDate < startOfYesterday || txDate >= startOfToday)) return false;
          if (timeFilter === "This Week" && txDate < startOfWeek) return false;
          if (timeFilter === "This Month" && txDate < startOfMonth) return false;
        }

        // If no search, include all non-voided
        if (!search) return true;

        // Search filter
        const receiptNo = (t.receiptNo || t._id || "").toLowerCase();
        const date = (t.checkedOutAt || t.createdAt || t.date || "").toLowerCase();
        const status = (t.status || "").toLowerCase();
        const cashier = (t.performedByName || t.userName || t.user?.name || "").toLowerCase();

        return (
          receiptNo.includes(searchLower) ||
          date.includes(searchLower) ||
          status.includes(searchLower) ||
          cashier.includes(searchLower)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.checkedOutAt || a.createdAt || a.date || 0).getTime();
        const dateB = new Date(b.checkedOutAt || b.createdAt || b.date || 0).getTime();
        return dateB - dateA;
      });
  }, [cachedTransactions, search, timeFilter]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(formatDateTime());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const loadTransactions = useCallback(async (forceRefresh = false, loadMore = false) => {
    if (isFetching.current) return;

    const requestedPage = loadMore ? page + 1 : 1;

    // Debounce if needed, but useRef lock handles most cases
    // if (!forceRefresh && Date.now() - lastFetchTime.current < 500) return;

    try {
      isFetching.current = true;
      if (loadMore) setLoadingMore(true);

      const params = {
        page: requestedPage,
        limit: 20
      };

      if (forceRefresh) {
        invalidateCache('transactions');
      }

      const response = await fetchCachedTransactions(forceRefresh, params);

      if (response && (response.success || response.data)) { // Handle both response structures
        const data = response.data || response;
        // If response has metadata (from backend update)
        if (response.totalPages) {
          setHasMore(requestedPage < response.totalPages);
        } else {
          // Fallback if backend doesn't support pagination metadata yet
          setHasMore(data.length === 20);
        }

        if (loadMore) {
          setPage(p => p + 1);
        } else {
          setPage(1);
        }
      }

      lastFetchTime.current = Date.now();
    } catch (error) {
      console.error("Error loading transactions:", error);
    } finally {
      isFetching.current = false;
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [fetchCachedTransactions, invalidateCache, page]);

  // Initial load
  useFocusEffect(
    useCallback(() => {
      // If we already have data, don't auto-refresh drastically, 
      // but if empty, load page 1.
      if (cachedTransactions.length === 0) {
        loadTransactions(false, false);
      }
    }, [loadTransactions, cachedTransactions.length])
  );

  const onRefresh = () => {
    setRefreshing(true);
    // Reset page to 1
    loadTransactions(true, false);
  };

  const onEndReached = () => {
    if (!loadingMore && hasMore && !search) {
      loadTransactions(false, true);
    }
  };

  // Function to get cashier name from transaction
  const getCashierName = (transaction) => {
    return (
      transaction.performedByName ||
      transaction.userName ||
      transaction.user?.name ||
      "Unknown"
    );
  };

  const handleView = (item) => {
    setSelectedTransaction(item);
    setModalVisible(true);
  };

  const calculateTotals = (transaction) => {
    const items = transaction.items || [];
    const subtotal = items.reduce((sum, item) => {
      const qty = item.quantity || item.qty || 0;
      const price = item.price || item.unitPrice || 0;
      return sum + qty * price;
    }, 0);
    const discount = transaction.discountAmount || transaction.discount || 0;
    const total =
      transaction.totalAmount || transaction.total || subtotal - discount;
    return { subtotal, discount, total };
  };

  const handlePrint = async () => {
    if (!selectedTransaction) return;

    const items = selectedTransaction.items || [];
    const totals = calculateTotals(selectedTransaction);

    let htmlContent = `
      <div style="width:220px; font-family: monospace; padding:10px;">
        <h2 style="text-align:center; margin:0; font-size: 18px;">CREATE YOUR STYLE</h2>
        <p style="text-align:center; margin:2px 0; font-size: 10px;">KM 7 Pasonanca, Zamboanga City</p>
        <p style="text-align:center; margin:0;">Cashier: ${getCashierName(selectedTransaction)}</p>
        <p style="text-align:center; margin:0;">Date & Time: ${new Date(
      selectedTransaction.checkedOutAt ||
      selectedTransaction.createdAt ||
      selectedTransaction.date,
    ).toLocaleString()}</p>
        <p style="text-align:center; margin:0;">Receipt No: ${selectedTransaction.receiptNo || selectedTransaction._id}</p>
        <p style="text-align:center; margin:0;">Status: ${selectedTransaction.status
      }</p>
        <hr style="border:1px dashed #000;"/>
        <table style="width:100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align:left;">Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${items
        .map((item) => {
          const name = item.name || item.productName || "Unknown";
          const qty = item.quantity || item.qty || 0;
          const price = item.price || item.unitPrice || 0;
          return `<tr>
                    <td>${name}</td>
                    <td style="text-align:center;">${qty}</td>
                    <td style="text-align:right;">₱${price.toFixed(2)}</td>
                  </tr>`;
        })
        .join("")}
          </tbody>
        </table>
        <hr style="border:1px dashed #000;"/>
        <p style="text-align:right; margin:0;">Subtotal: ₱${totals.subtotal.toFixed(
          2,
        )}</p>
        <p style="text-align:right; margin:0;">Discount: ₱${totals.discount.toFixed(
          2,
        )}</p>
        <p style="text-align:right; font-weight:bold; margin:0;">Total: ₱${totals.total.toFixed(
          2,
        )}</p>
        <hr style="border:1px dashed #000;"/>
        <p style="text-align:center; font-style:italic; margin:0;">This is not an official receipt</p>
        <p style="text-align:center; margin-top:10px;">Thank you for your purchase!</p>
      </div>
    `;

    try {
      await Print.printAsync({ html: htmlContent });
    } catch (error) {
      alert("Print Error: " + error.message);
    }
  };

  const renderItem = ({ item }) => {
    const status = item.status || "Completed";
    const statusColor =
      status === "Completed" || status === "Paid"
        ? "#09A046"
        : status === "Returned"
          ? "#FF8C00"
          : "#C80000";

    const totals = calculateTotals(item);
    const receiptNo = item.receiptNo || item._id || "N/A";
    const date = new Date(
      item.checkedOutAt || item.createdAt || item.date || Date.now(),
    ).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const items = item.items || [];

    return (
      <TouchableOpacity style={styles.logItem} onPress={() => handleView(item)}>
        <View style={styles.logHeader}>
          <Text style={styles.transactionId}>{receiptNo}</Text>
          <Text style={styles.date}>{getCashierName(item)}</Text>
        </View>

        <View style={styles.logDetails}>
          {items.length > 0 && (
            <Text style={styles.items}>
              {items
                .map((d, idx) => {
                  const name =
                    d.itemName || d.name || d.productName || "Unknown";
                  const qty = d.quantity || d.qty || 0;
                  return `${qty}x ${name}`;
                })
                .join(", ")}
            </Text>
          )}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusColor}20` },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor }]}>
              {status}
            </Text>
          </View>
        </View>

        <View style={styles.logFooter}>
          <Text style={styles.total}>₱{totals.total.toFixed(2)}</Text>
          <Text style={styles.transactionDate}>{date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      <View style={styles.whitecard}>
        <SafeAreaView style={{ flex: 1, width: "100%" }}>
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={20}
              color="#AD7F65"
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Search loaded transactions..."
              placeholderTextColor="#B8A69B"
              style={styles.searchBox}
              value={search}
              onChangeText={setSearch}
              selectionColor="#AD7F65"
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={18} color="#B8A69B" />
              </TouchableOpacity>
            )}
          </View>

          {/* Time Filter Pills */}
          <View style={styles.filterRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15 }}>
              {TIME_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, timeFilter === f && styles.filterPillActive]}
                  onPress={() => setTimeFilter(f)}
                >
                  <Text style={[styles.filterPillText, timeFilter === f && styles.filterPillTextActive]}>
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.listWrapper}>
            {(transactionsLoading && cachedTransactions.length === 0) ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#AD7F65" />
                <Text style={styles.loadingText}>Loading transactions...</Text>
              </View>
            ) : (
              <FlashList
                data={filteredTransactions}
                renderItem={renderItem}
                keyExtractor={(item) =>
                  item._id || item.id || Math.random().toString()
                }
                estimatedItemSize={150}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={["#AD7F65"]}
                    tintColor="#AD7F65"
                  />
                }
                ListFooterComponent={() =>
                  loadingMore ? (
                    <View style={{ padding: 10 }}>
                      <ActivityIndicator size="small" color="#AD7F65" />
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                      {search ? "— No matching transactions found —" : "— No transactions yet —"}
                    </Text>
                  </View>
                }
                contentContainerStyle={styles.listContent}
              />
            )}
          </View>
        </SafeAreaView>
      </View>

      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {selectedTransaction && (
              <>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => setModalVisible(false)}
                  >
                    <Ionicons name="close-circle" size={28} color="#AD7F65" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.receiptHeader}>CREATE YOUR STYLE</Text>
                <Text style={styles.locationText}>
                  KM 7 Pasonanca, Zamboanga City
                </Text>
                <Text style={styles.receiptDate}>
                  {new Date(
                    selectedTransaction.checkedOutAt ||
                    selectedTransaction.createdAt ||
                    selectedTransaction.date,
                  ).toLocaleString()}
                </Text>
                <Text style={styles.receiptStatus}>
                  Status: {selectedTransaction.status}
                </Text>
                <Text style={styles.cashierLabel}>
                  Receipt No:{" "}
                  {selectedTransaction.receiptNo || selectedTransaction._id}
                </Text>
                <Text style={styles.cashierLabel}>
                  Cashier: {getCashierName(selectedTransaction)}
                </Text>

                <ScrollView style={{ marginVertical: 10, maxHeight: 250 }}>
                  {(selectedTransaction.items || []).map((item, i) => {
                    const name =
                      item.itemName ||
                      item.name ||
                      item.productName ||
                      "Unknown";
                    const qty = item.quantity || item.qty || 0;
                    const price = item.price || item.unitPrice || 0;
                    return (
                      <View key={i} style={styles.receiptRow}>
                        <Text style={styles.receiptItem}>{name}</Text>
                        <Text style={styles.receiptQty}>{qty}</Text>
                        <Text style={styles.receiptPrice}>
                          ₱{price.toFixed(2)}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>

                <View style={styles.receiptTotals}>
                  {(() => {
                    const totals = calculateTotals(selectedTransaction);
                    return (
                      <>
                        <Text>Subtotal: ₱{totals.subtotal.toFixed(2)}</Text>
                        <Text>Discount: ₱{totals.discount.toFixed(2)}</Text>
                        <Text style={{ fontWeight: "bold" }}>
                          Total: ₱{totals.total.toFixed(2)}
                        </Text>
                      </>
                    );
                  })()}
                </View>

                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>
                    This is not an official receipt
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  whitecard: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: -10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingTop: 2,
    pointerEvents: "box-none",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: 15,
    marginBottom: 10,
    height: 40,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 4,
    fontSize: 18,
  },
  searchBox: {
    flex: 1,
    height: 35,
    color: "#333",
    fontSize: 13,
    paddingVertical: 0,
    marginLeft: 4,
  },
  clearButton: {
    padding: 4,
  },
  listWrapper: {
    flex: 1,
    padding: 10,
  },
  listContent: {
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    paddingBottom: 20, // Add padding at bottom
  },
  logItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  transactionId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  date: {
    fontSize: 12,
    color: "#7f8c8d",
  },
  logDetails: {
    marginBottom: 10,
  },
  items: {
    fontSize: 14,
    color: "#34495e",
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  logFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  total: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2c3e50",
    letterSpacing: 0.3,
  },
  transactionDate: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    width: "85%",
    borderRadius: 15,
    padding: 20,
    paddingTop: 50,
    elevation: 10,
    alignItems: "center",
  },
  buttonRow: {
    flexDirection: "column",
    position: "absolute",
    top: 10,
    right: 10,
    gap: 8,
    alignItems: "center",
  },
  iconButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  receiptHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000000",
    textAlign: "center",
    marginBottom: 10,
  },
  receiptDate: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
  },
  receiptStatus: {
    fontSize: 14,
    color: "#333",
    fontWeight: "bold",
    marginBottom: 5,
  },
  cashierLabel: {
    fontSize: 12,
    color: "#333",
    marginBottom: 10,
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
    width: "100%",
  },
  receiptItem: {
    flex: 2,
    fontSize: 14,
  },
  receiptQty: {
    width: 30,
    textAlign: "center",
    fontSize: 14,
  },
  receiptPrice: {
    width: 60,
    textAlign: "right",
    fontSize: 14,
  },
  receiptTotals: {
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    width: "100%",
    marginTop: 10,
    paddingTop: 5,
    marginBottom: 10,
  },
  receiptFooter: {
    marginTop: 10,
  },
  receiptFooterText: {
    fontSize: 12,
    color: "#95a5a6",
    textAlign: "center",
    fontStyle: "italic",
  },
  printButton: {
    backgroundColor: "#AD7F65",
    paddingVertical: 15,
    paddingHorizontal: 60,
    borderRadius: 8,
    marginTop: 15,
    width: "95%",
    alignSelf: "center",
  },
  printButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  disabledButton: {
    backgroundColor: "#95a5a6",
    opacity: 0.7,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#95a5a6",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: "#666",
    fontSize: 14,
  },
  locationText: {
    textAlign: "center",
    fontSize: 12,
    color: "#555",
    marginBottom: 5
  },

  // Time filter pills
  filterRow: {
    marginBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
  },
  filterPillActive: {
    backgroundColor: "#1f1f1f",
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
  },
  filterPillTextActive: {
    color: "#fff",
  }
});
