import AddItem from "@/app/AddItem";
import StockInModal from "@/components/inventory/StockInModal";
import StockOutModal from "@/components/inventory/StockOutModal";

import Header from "@/components/shared/header";
import { useData } from "@/context/DataContext";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    AppState,
    FlatList,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Table View Component
const InventoryTable = ({
  items = [],
  onBack,
  onEditItem,
  onRefresh,
  loading,
  onEndReached,
  loadingMore,
}) => {
  const [menuVisible, setMenuVisible] = useState(null);

  // Stock Modal States
  const [showStockIn, setShowStockIn] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [stockItem, setStockItem] = useState(null);
  const [stockLoading, setStockLoading] = useState(false);

  useEffect(() => {
    // Lock to landscape
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const menuItems = [
    {
      value: "edit",
      icon: "pencil",
      iconColor: "#4a90e2",
      bgColor: "rgba(74, 144, 226, 0.1)",
    },
    {
      value: "stockIn",
      icon: "add-circle",
      iconColor: "#2ecc71",
      bgColor: "rgba(46, 204, 113, 0.1)",
    },
    {
      value: "stockOut",
      icon: "remove-circle",
      iconColor: "#e67e22",
      bgColor: "rgba(230, 126, 34, 0.1)",
    },
    {
      value: "archive",
      icon: "archive",
      iconColor: "#9b59b6",
      bgColor: "rgba(155, 89, 182, 0.1)",
    },
  ];

  const toggleMenu = (itemId) => {
    setMenuVisible(menuVisible === itemId ? null : itemId);
  };

  const handleMenuAction = (action, itemId) => {
    setMenuVisible(null);
    handleAction(action, itemId);
  };

  const renderItem = ({ item = {} }) => {
    const itemId = item._id || item.id || "";
    const sku = item.sku || "N/A";
    const name = item.name || "No Name";
    const brand = item.brand || "N/A";
    const category = item.category || "N/A";
    const price = item.price || 0;
    const stock = item.stock || item.quantity || 0;
    const dateAdded =
      item.dateAdded || item.createdAt
        ? new Date(item.dateAdded || item.createdAt).toLocaleDateString()
        : "N/A";

    const isMenuVisible = menuVisible === itemId;

    return (
      <View style={styles.tableRow}>
        <Text style={[styles.tableCell, { flex: 0.7 }]}>{sku}</Text>
        <Text style={[styles.tableCell, { flex: 1.3 }]}>{name}</Text>
        <Text style={[styles.tableCell, { flex: 0.9 }]}>{brand}</Text>
        <Text style={[styles.tableCell, { flex: 0.9 }]}>{category}</Text>
        <Text style={[styles.tableCell, { flex: 0.7 }]}>
          ₱{typeof price === "number" ? price.toFixed(2) : "0.00"}
        </Text>
        <Text
          style={[
            styles.tableCell,
            { flex: 0.4, color: (stock || 0) < 4 ? "#E74C3C" : "#000" },
          ]}
        >
          {stock}
        </Text>
        <Text style={[styles.tableCell, { flex: 0.7 }]}>{dateAdded}</Text>
        <View style={[styles.tableCell, { flex: 0.8 }]}>
          <View style={styles.actionButtonContainer}>
            <TouchableOpacity
              onPress={() => toggleMenu(itemId)}
              style={styles.menuButton}
            >
              <Ionicons name="ellipsis-vertical" size={20} color="#666" />
            </TouchableOpacity>

            {isMenuVisible && (
              <View style={[styles.menuContainer, { right: 10, top: 30 }]}>
                {menuItems.map((menuItem) => (
                  <TouchableOpacity
                    key={menuItem.value}
                    style={[
                      styles.menuItem,
                      { backgroundColor: menuItem.bgColor },
                    ]}
                    onPress={() => handleMenuAction(menuItem.value, itemId)}
                  >
                    <Ionicons
                      name={menuItem.icon}
                      size={20}
                      color={menuItem.iconColor}
                      style={styles.menuIcon}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const handleAction = async (action, itemId) => {
    const item = items.find((item) => (item._id || item.id) === itemId);

    if (!item) return;

    if (action === "edit") {
      onEditItem(item);
      return;
    }

    if (action === "stockIn") {
      setStockItem(item);
      setShowStockIn(true);
      return;
    }

    if (action === "stockOut") {
      setStockItem(item);
      setShowStockOut(true);
      return;
    }

    if (action === "archive") {
      Alert.alert(
        "Archive Item",
        "Are you sure you want to archive this item?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Archive",
            style: "destructive",
            onPress: async () => {
              try {
                // Archive the item using API
                const { archiveAPI } = require("../../services/api");
                await archiveAPI.archive({
                  productId: item._id || item.id,
                  productName: item.name,
                  reason: "Archived from mobile app",
                });
                Alert.alert("Success", "Item archived successfully");
                // Refresh the table data
                onRefresh();
              } catch (error) {
                Alert.alert(
                  "Error",
                  "Failed to archive item: " + error.message,
                );
              }
            },
          },
        ],
        { cancelable: true },
      );
    }
  };

  const handleStockInConfirm = async (stockData) => {
    if (!stockItem) return;

    try {
      setStockLoading(true);

      const { productAPI } = require("../../services/api");

      // We need to fetch the full product details first to get the sizes structure
      // The item from the list might be normalized/simplified
      const response = await productAPI.getById(stockItem._id || stockItem.id);

      if (!response.success) {
        throw new Error("Failed to fetch product details");
      }

      const fullProduct = response.data;

      // Helper to get quantity from size data
      const getSizeQty = (sizeData) => {
        if (
          typeof sizeData === "object" &&
          sizeData !== null &&
          sizeData.quantity !== undefined
        ) {
          return sizeData.quantity;
        }
        return typeof sizeData === "number" ? sizeData : 0;
      };

      // Helper to get price from size data
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

      // Prepare user info - Fetch actual logged-in user from AsyncStorage
      const storedEmployeeStr = await AsyncStorage.getItem("currentEmployee");
      let handledBy = "Mobile User";
      let handledById = "mobile_user_id";

      if (storedEmployeeStr) {
        try {
          const parsedUser = JSON.parse(storedEmployeeStr);
          handledBy =
            parsedUser.name ||
            `${parsedUser.firstName || ""} ${parsedUser.lastName || ""}`.trim() ||
            "Mobile User";
          handledById = parsedUser._id || parsedUser.id || "mobile_user_id";
        } catch (e) {
          console.error("Failed to parse current employee", e);
        }
      }

      if (stockData.noSizes) {
        // Product without sizes - simple quantity update
        const newStock = (fullProduct.currentStock || 0) + stockData.quantity;

        await productAPI.update(fullProduct._id, {
          currentStock: newStock,
          stockMovementType: "Stock-In",
          stockMovementReason: stockData.reason || "Restock",
          handledBy: handledBy,
          handledById: handledById,
          stockMovementSizeQuantities: null,
        });
      } else {
        // Product with sizes
        const updatedSizes = { ...(fullProduct.sizes || {}) };

        stockData.selectedSizes.forEach((size) => {
          const currentSizeData = updatedSizes[size];
          const currentQty = getSizeQty(currentSizeData);
          const currentPrice = getSizePrice(currentSizeData);
          const addQty = stockData.sizes[size] || 0;
          const newQty = currentQty + addQty;

          // Preserve price structure if it exists
          if (
            currentPrice !== null ||
            (typeof currentSizeData === "object" && currentSizeData !== null)
          ) {
            updatedSizes[size] = {
              quantity: newQty,
              price:
                currentPrice !== null
                  ? currentPrice
                  : fullProduct.itemPrice || 0,
            };
          } else {
            updatedSizes[size] = newQty;
          }
        });

        const totalStock = Object.values(updatedSizes).reduce(
          (sum, sizeData) => sum + getSizeQty(sizeData),
          0,
        );

        // Calculate size quantities that were added
        const sizeQuantitiesAdded = {};
        stockData.selectedSizes.forEach((size) => {
          const addQty = stockData.sizes[size] || 0;
          if (addQty > 0) {
            sizeQuantitiesAdded[size] = addQty;
          }
        });

        await productAPI.update(fullProduct._id, {
          currentStock: totalStock,
          sizes: updatedSizes,
          stockMovementType: "Stock-In",
          stockMovementReason: stockData.reason || "Restock",
          handledBy: handledBy,
          handledById: handledById,
          stockMovementSizeQuantities:
            Object.keys(sizeQuantitiesAdded).length > 0
              ? sizeQuantitiesAdded
              : null,
        });
      }

      Alert.alert("Success", "Stock added successfully");
      setShowStockIn(false);
      setStockItem(null);
      onRefresh(true);
    } catch (error) {
      console.error("Error adding stock:", error);
      Alert.alert("Error", "Failed to update stock: " + error.message);
    } finally {
      setStockLoading(false);
    }
  };

  const handleStockOutConfirm = async (stockData) => {
    if (!stockItem) return;

    try {
      setStockLoading(true);

      const { productAPI, archiveAPI } = require("../../services/api");

      // Fetch full product details
      const response = await productAPI.getById(stockItem._id || stockItem.id);

      if (!response.success) {
        throw new Error("Failed to fetch product details");
      }

      const fullProduct = response.data;

      // Helper to get quantity from size data
      const getSizeQty = (sizeData) => {
        if (
          typeof sizeData === "object" &&
          sizeData !== null &&
          sizeData.quantity !== undefined
        ) {
          return sizeData.quantity;
        }
        return typeof sizeData === "number" ? sizeData : 0;
      };

      // Helper to get price from size data
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

      // Determine type based on reason
      const movementType =
        stockData.reason === "Damaged" ||
        stockData.reason === "Lost" ||
        stockData.reason === "Expired" ||
        stockData.reason === "Defective"
          ? "Pull-Out"
          : "Stock-Out";

      // Values for tracking - Fetch actual logged-in user from AsyncStorage
      const storedEmployeeStr = await AsyncStorage.getItem("currentEmployee");
      let handledBy = "Mobile User";
      let handledById = "mobile_user_id";

      if (storedEmployeeStr) {
        try {
          const parsedUser = JSON.parse(storedEmployeeStr);
          handledBy =
            parsedUser.name ||
            `${parsedUser.firstName || ""} ${parsedUser.lastName || ""}`.trim() ||
            "Mobile User";
          handledById = parsedUser._id || parsedUser.id || "mobile_user_id";
        } catch (e) {
          console.error("Failed to parse current employee", e);
        }
      }

      if (stockData.noSizes) {
        // Product without sizes - simple quantity update
        const newStock = Math.max(
          0,
          (fullProduct.currentStock || 0) - stockData.quantity,
        );

        await productAPI.update(fullProduct._id, {
          currentStock: newStock,
          stockMovementType: movementType,
          stockMovementReason: stockData.reason || "Sold",
          handledBy: handledBy,
          handledById: handledById,
          stockMovementSizeQuantities: null,
        });

        // Archive items if reason is Damaged, Defective, or Expired
        const archiveReasons = ["Damaged", "Defective", "Expired"];
        if (archiveReasons.includes(stockData.reason)) {
          try {
            await archiveAPI.archive({
              productId: fullProduct._id,
              itemName: fullProduct.itemName,
              sku: fullProduct.sku,
              variant: fullProduct.variant || "",
              selectedSize: fullProduct.size || "",
              category: fullProduct.category,
              brandName: fullProduct.brandName || "",
              itemPrice: fullProduct.itemPrice || 0,
              costPrice: fullProduct.costPrice || 0,
              quantity: stockData.quantity,
              itemImage: fullProduct.itemImage || "",
              reason:
                stockData.reason === "Defective"
                  ? "Defective"
                  : stockData.reason,
              archivedBy: handledBy,
              archivedById: handledById,
              source: "stock-out",
              notes: `Stock out - ${stockData.reason}`,
            });
          } catch (archiveError) {
            console.error("Error archiving item:", archiveError);
          }
        }
      } else {
        // Product with sizes
        const updatedSizes = { ...(fullProduct.sizes || {}) };

        stockData.selectedSizes.forEach((size) => {
          const currentSizeData = updatedSizes[size];
          const currentQty = getSizeQty(currentSizeData);
          const currentPrice = getSizePrice(currentSizeData);
          const removeQty = stockData.sizes[size] || 0;
          const newQty = Math.max(0, currentQty - removeQty);

          // Preserve price structure if it exists
          if (
            currentPrice !== null ||
            (typeof currentSizeData === "object" && currentSizeData !== null)
          ) {
            updatedSizes[size] = {
              quantity: newQty,
              price:
                currentPrice !== null
                  ? currentPrice
                  : fullProduct.itemPrice || 0,
            };
          } else {
            updatedSizes[size] = newQty;
          }
        });

        const totalStock = Object.values(updatedSizes).reduce(
          (sum, sizeData) => sum + getSizeQty(sizeData),
          0,
        );

        const sizeQuantitiesRemoved = {};
        stockData.selectedSizes.forEach((size) => {
          const removeQty = stockData.sizes[size] || 0;
          if (removeQty > 0) {
            sizeQuantitiesRemoved[size] = removeQty;
          }
        });

        await productAPI.update(fullProduct._id, {
          currentStock: totalStock,
          sizes: updatedSizes,
          stockMovementType: movementType,
          stockMovementReason: stockData.reason || "Sold",
          handledBy: handledBy,
          handledById: handledById,
          stockMovementSizeQuantities:
            Object.keys(sizeQuantitiesRemoved).length > 0
              ? sizeQuantitiesRemoved
              : null,
        });

        // Archive items if reason is Damaged, Defective, or Expired
        const archiveReasons = ["Damaged", "Defective", "Expired"];
        if (archiveReasons.includes(stockData.reason)) {
          const totalQuantityRemoved = Object.values(
            sizeQuantitiesRemoved,
          ).reduce((sum, qty) => sum + qty, 0);
          const sizesString = stockData.selectedSizes.join(", ");

          try {
            await archiveAPI.archive({
              productId: fullProduct._id,
              itemName: fullProduct.itemName,
              sku: fullProduct.sku,
              variant: fullProduct.variant || "",
              selectedSize: sizesString,
              category: fullProduct.category,
              brandName: fullProduct.brandName || "",
              itemPrice: fullProduct.itemPrice || 0,
              costPrice: fullProduct.costPrice || 0,
              quantity: totalQuantityRemoved,
              itemImage: fullProduct.itemImage || "",
              reason:
                stockData.reason === "Defective"
                  ? "Defective"
                  : stockData.reason,
              archivedBy: handledBy,
              archivedById: handledById,
              source: "stock-out",
              notes: `Stock out - ${stockData.reason}. Sizes: ${sizesString}`,
            });
          } catch (archiveError) {
            console.error("Error archiving item:", archiveError);
          }
        }
      }

      Alert.alert("Success", "Stock removed successfully");
      setShowStockOut(false);
      setStockItem(null);
      onRefresh(true);
    } catch (error) {
      console.error("Error removing stock:", error);
      Alert.alert("Error", "Failed to update stock: " + error.message);
    } finally {
      setStockLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <View style={styles.headerLeft} />
        <Text style={styles.tableTitle}>Inventory Table</Text>
        <TouchableOpacity onPress={onBack} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>SKU</Text>
        <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Item Name</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Brand</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>Category</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Price</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.4 }]}>Stock</Text>
        <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Date Added</Text>
        <Text
          style={[styles.tableHeaderCell, { flex: 0.8, textAlign: "center" }]}
        >
          Actions
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B4513" />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) =>
            (item._id || item.id || Math.random()).toString()
          }
          contentContainerStyle={{ paddingBottom: 20 }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ padding: 10 }}>
                <ActivityIndicator size="small" color="#8B4513" />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={["#8B4513"]}
              tintColor="#8B4513"
            />
          }
        />
      )}

      <StockInModal
        visible={showStockIn}
        onClose={() => {
          setShowStockIn(false);
          setStockItem(null);
        }}
        product={stockItem}
        onConfirm={handleStockInConfirm}
        loading={stockLoading}
      />

      <StockOutModal
        visible={showStockOut}
        onClose={() => {
          setShowStockOut(false);
          setStockItem(null);
        }}
        product={stockItem}
        onConfirm={handleStockOutConfirm}
        loading={stockLoading}
      />
    </SafeAreaView>
  );
};

// Constants for optimization
const STALE_TIME = 30000; // 30 seconds - data considered stale after this
const MIN_FETCH_INTERVAL = 5000; // 5 seconds - minimum time between fetches

export default function Inventory() {
  const router = useRouter();
  const {
    products: cachedProducts,
    productsLoading,
    fetchProducts: fetchCachedProducts,
    invalidateCache,
    inventoryStats, // Use stats from context
    calculateDashboardStats, // To refresh stats
  } = useData();

  const [showTableView, setShowTableView] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Optimization refs
  const lastFetchTime = useRef(0);
  const isFetching = useRef(false);
  const appState = useRef(AppState.currentState);

  // Reset to portrait when component unmounts
  useEffect(() => {
    return () => {
      if (Platform.OS !== "web") {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      }
    };
  }, []);

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // App coming to foreground - check if data is stale
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        const timeSinceLastFetch = Date.now() - lastFetchTime.current;
        if (timeSinceLastFetch > STALE_TIME) {
          fetchProductsOptimized(true);
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription?.remove();
  }, []);

  const normalizeProduct = useCallback((product = {}) => {
    return {
      ...product,
      name: product.name || product.itemName || "No Name",
      brand: product.brand || product.brandName || "N/A",
      price: product.price ?? product.itemPrice ?? 0,
      stock: product.stock ?? product.currentStock ?? 0,
      category: product.category || "Uncategorized",
      sku: product.sku || "N/A",
      itemImage: product.itemImage || product.image || "",
      dateAdded:
        product.dateAdded || product.createdAt || product.updatedAt || null,
      costPrice: product.costPrice ?? 0,
    };
  }, []);

  // Memoized normalized products
  const products = useMemo(() => {
    return cachedProducts.map(normalizeProduct);
  }, [cachedProducts, normalizeProduct]);

  // Helper function for date formatting - defined before useMemo that uses it
  const formatDateAdded = useCallback((date) => {
    if (!date) return "Unknown";
    const now = new Date();
    const itemDate = new Date(date);
    const diffTime = Math.abs(now - itemDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return itemDate.toLocaleDateString();
  }, []);

  // inventoryStats is now coming from Context, no need to calculate here!

  // Memoized recently added items
  const recentlyAddedItems = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt || a.dateAdded || 0);
        const dateB = new Date(b.createdAt || b.dateAdded || 0);
        return dateB - dateA;
      })
      .slice(0, 5)
      .map((p) => ({
        id: p._id || p.id,
        name: p.name,
        category: p.category,
        stock: p.stock || 0,
        dateAdded: formatDateAdded(p.createdAt || p.dateAdded),
      }));
  }, [products, formatDateAdded]);

  const loadingProducts = productsLoading && initialLoad;

  // Optimized fetch function with debouncing, stale check, and pagination support
  const fetchProductsOptimized = useCallback(
    async (forceRefresh = false, loadMore = false) => {
      // Prevent concurrent fetches
      if (isFetching.current) {
        return;
      }

      // Determine requested page
      const requestedPage = loadMore ? page + 1 : 1;

      try {
        isFetching.current = true;
        if (loadMore) setLoadingMore(true);

        if (forceRefresh) {
          invalidateCache("products");
          // Also refresh stats when forcing refresh
          calculateDashboardStats(true);
        } else if (!loadMore) {
          // If simply reloading first page, check if we should refresh stats too
          // (Just to keep them in sync on screen load)
          calculateDashboardStats(false);
        }

        const response = await fetchCachedProducts(forceRefresh, {
          page: requestedPage,
          limit: 20,
        });

        if (response && response.data) {
          if (loadMore) {
            setPage((prev) => prev + 1);
          } else {
            setPage(1);
          }

          // Check if there are more pages
          if (response.totalPages) {
            setHasMore(requestedPage < response.totalPages);
          } else {
            // Fallback if backend doesn't return pagination metadata
            setHasMore(response.data.length === 20);
          }
        }

        lastFetchTime.current = Date.now();
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        isFetching.current = false;
        setLoadingMore(false);
      }
    },
    [invalidateCache, fetchCachedProducts, calculateDashboardStats, page],
  );

  // Load products on focus with optimization
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        // Only fetch if data is stale or empty
        const timeSinceLastFetch = Date.now() - lastFetchTime.current;
        const shouldFetch =
          cachedProducts.length === 0 || timeSinceLastFetch > STALE_TIME;

        if (shouldFetch) {
          await fetchProductsOptimized(false);
        }
        setInitialLoad(false);
      };
      loadData();
    }, [fetchProductsOptimized, cachedProducts.length]),
  );

  // Handle manual refresh (always force)
  const fetchProducts = useCallback(
    async (forceRefresh = false) => {
      await fetchProductsOptimized(forceRefresh);
    },
    [fetchProductsOptimized],
  );

  const [editingItem, setEditingItem] = useState(null);

  const handleEditItem = (item) => {
    setEditingItem(item);
    setShowAddItem(true);
  };

  const handleAddItemBack = () => {
    setShowAddItem(false);
    setEditingItem(null);
  };

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      lastFetchTime.current = 0; // Reset to force fetch
      await fetchProducts(true); // Force refresh
    } finally {
      setRefreshing(false);
    }
  }, [fetchProducts]);

  const handleLoadMore = useCallback(() => {
    if (!isFetching.current && hasMore) {
      fetchProductsOptimized(false, true);
    }
  }, [fetchProductsOptimized, hasMore]);

  if (showAddItem) {
    return (
      <View style={{ flex: 1 }}>
        <AddItem
          onBack={handleAddItemBack}
          item={editingItem}
          isEditing={!!editingItem}
        />
      </View>
    );
  }

  if (showTableView) {
    return (
      <InventoryTable
        items={products}
        loading={loadingProducts}
        onBack={() => setShowTableView(false)}
        onEditItem={handleEditItem}
        onRefresh={fetchProducts}
        onEndReached={handleLoadMore}
        loadingMore={loadingMore}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.container}>
        {/* HEADER */}
        <Header />
        <View style={styles.whitecard}>
          {/* MAIN CONTENT */}
          <ScrollView
            style={styles.main}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={["#8B4513"]}
                tintColor="#8B4513"
              />
            }
          >
            {/* TOP ACTION BUTTONS */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: "#16a34a", flex: 1 },
                ]}
                onPress={() => setShowAddItem(true)}
              >
                <Ionicons
                  name="add"
                  size={20}
                  color="#fff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.actionButtonText}>Add Item</Text>
              </TouchableOpacity>

              {/* <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#3E2723', flex: 1 }]}
              onPress={() => router.push('/ItemArchive')}
            >
              <Ionicons name="archive" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.actionButtonText}>Item Archive</Text>
            </TouchableOpacity> */}
            </View>

            {/* SUMMARY STATS */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardDark]}>
                <Text style={[styles.statValue, { color: "#fff" }]}>
                  {inventoryStats.totalItems}
                </Text>
                <Text style={[styles.statLabel, { color: "#d1d5db" }]}>
                  Total Items
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#16a34a" }]}>
                  {inventoryStats.inStock}
                </Text>
                <Text style={styles.statLabel}>In-Stock</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#D97706" }]}>
                  {inventoryStats.lowStock}
                </Text>
                <Text style={styles.statLabel}>Low Stock</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: "#DC2626" }]}>
                  {inventoryStats.outOfStock}
                </Text>
                <Text style={styles.statLabel}>Out of Stock</Text>
              </View>
            </View>

            {/* RECENTLY ADDED ITEMS */}
            <View style={styles.recentlyAddedContainer}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.coltitle}>Recently Added Items</Text>
                  <Text style={styles.colsubtitle}>
                    Your newly added products
                  </Text>
                </View>
              </View>

              {recentlyAddedItems.map((item) => (
                <TouchableOpacity
                  key={item.id.toString()}
                  style={styles.recentItemCard}
                >
                  <View style={styles.recentItemContent}>
                    <Text style={styles.recentItemName}>{item.name}</Text>
                    <View style={styles.infoRow}>
                      <Text style={styles.recentItemCategory}>
                        {item.category}
                      </Text>
                      <Text style={styles.separator}>•</Text>
                      <Text
                        style={[
                          styles.stockText,
                          { color: item.stock <= 10 ? "#DC2626" : "#0369A1" },
                        ]}
                      >
                        {item.stock} in stock
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.recentItemDate}>{item.dateAdded}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* VIEW INVENTORY BUTTON */}
            <View
              style={[
                styles.actionButtonsContainer,
                { justifyContent: "center", marginTop: 5, marginBottom: 10 },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: "#1f1f1f",
                    width: "90%",
                    maxWidth: "100%",
                    paddingVertical: 15,
                  },
                ]}
                onPress={() => setShowTableView(true)}
              >
                <Ionicons
                  name="grid"
                  size={20}
                  color="#ffffffff"
                  style={styles.buttonIcon}
                />
                <Text style={styles.actionButtonText}>View Inventory</Text>
              </TouchableOpacity>
            </View>

            {/* ALL PRODUCTS LIST */}
            <View style={styles.allProductsContainer}>
              <Text style={styles.coltitle}>All Products</Text>
              <Text style={styles.colsubtitle}>
                Showing {products.length} items from local database
              </Text>
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No products found.</Text>
                </View>
              ) : (
                products.map((product) => (
                  <View
                    key={(
                      product._id ||
                      product.id ||
                      Math.random()
                    ).toString()}
                    style={styles.productListItem}
                  >
                    <View>
                      <Text style={styles.productName}>
                        {product.name || "Unnamed Product"}
                      </Text>
                      <Text style={styles.productMeta}>
                        {product.category || "Uncategorized"} • SKU:{" "}
                        {product.sku || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.productRight}>
                      <Text style={styles.productPrice}>
                        ₱{Number(product.price || 0).toFixed(2)}
                      </Text>
                      <Text
                        style={[
                          styles.productStock,
                          (product.stock || 0) <= 10 ? styles.lowStock : null,
                        ]}
                      >
                        {product.stock || 0} in stock
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButtonsContainer: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
    gap: 10,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  buttonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  tableContainer: {
    flex: 1,
    backgroundColor: "#fff",

    zIndex: 1,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#8B4513",
    padding: 15,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeButton: {
    backgroundColor: "#000000ff",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10, // Reduced from 20 to 10 to move it left
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  tableTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#F5F0E5",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderColor: "#E0D9C8",
  },
  tableHeaderCell: {
    fontWeight: "600",
    textAlign: "left",
    paddingHorizontal: 12,
    color: "#333333",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    paddingVertical: 8,
    alignItems: "center",
  },
  actionButtonContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButton: {
    padding: 10,
    borderRadius: 20,
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  menuContainer: {
    position: "absolute",
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 1000,
    flexDirection: "row",
    gap: 8,
  },
  menuItem: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  menuIcon: {
    fontSize: 20,
  },
  tableCell: {
    padding: 10,
    textAlign: "left",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#eee",
    zIndex: 1,
  },
  tableList: {
    flex: 1,
  },

  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  container: {
    flex: 1,
    backgroundColor: "#53321c",
  },
  headerBackground: {
    height: 120,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  button: {
    padding: 10,
  },
  buttonImage: {
    width: 20,
    height: 20,
    resizeMode: "contain",
  },
  main: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  card: {
    borderRadius: 12,
    backgroundColor: "#f7f2ef",
    marginTop: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  card2: {
    height: 100,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 10,
    marginRight: 20,
    marginLeft: 25,
    padding: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
  mainValue: {
    fontSize: 32,
    fontWeight: "800",
    color: "#AD7F65",
  },
  whitecard: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: -10,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingTop: 2,
  },
  title: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
    marginTop: 2,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  column: {
    alignItems: "flex-start",
    flex: 1,
  },
  subValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 2,
  },
  subLabel: {
    fontSize: 11,
    color: "#999",
    marginTop: 0,
    textAlign: "left",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statCardDark: {
    backgroundColor: "#1f1f1f",
    borderColor: "#1f1f1f",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "600",
    color: "#6b7280",
  },
  colcontainer: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    elevation: 1,
    marginBottom: 15,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  coltitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  colsubtitle: {
    color: "#999",
    fontSize: 11,
    marginTop: 2,
  },
  viewMore: { color: "#AD7F65", fontWeight: "600", fontSize: 12 },
  recentlyAddedContainer: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    elevation: 1,
    marginBottom: 15,
  },
  recentItemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  recentItemContent: {
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    flexWrap: "wrap",
  },
  recentItemCategory: {
    fontSize: 12,
    color: "#6B7280",
  },
  separator: {
    marginHorizontal: 6,
    color: "#D1D5DB",
  },
  stockText: {
    fontSize: 12,
    fontWeight: "500",
  },
  recentItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  recentItemDate: {
    fontSize: 10,
    color: "#AD7F65",
    fontWeight: "500",
    marginLeft: 8,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerText: { fontSize: 11, color: "#999", fontWeight: "600" },
  rowtext: { fontSize: 12, color: "#333", paddingVertical: 6 },
  statusBadge: {
    backgroundColor: "#FFE8CC",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignItems: "center",
  },
  statusText: { color: "#AD7F65", fontWeight: "600", fontSize: 10 },
  addItemButton: {
    backgroundColor: "#8B4513",
    padding: 15,
    borderRadius: 8,
    margin: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  addItemText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
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
  allProductsContainer: {
    backgroundColor: "#fafafa",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    elevation: 1,
    marginBottom: 25,
  },
  productListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  productMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  productRight: {
    alignItems: "flex-end",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5D4037",
  },
  productStock: {
    fontSize: 12,
    color: "#0369A1",
    marginTop: 2,
  },
  lowStock: {
    color: "#DC2626",
    fontWeight: "600",
  },
});
