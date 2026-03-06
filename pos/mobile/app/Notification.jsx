import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { stockAPI } from "../services/api";

export default function Notification() {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch stock alerts
  const fetchNotifications = async () => {
    try {
      const response = await stockAPI.getLowStock();
      if (response && response.success && response.data) {
        // Transform stock data to notification format
        const stockAlerts = response.data.map(item => ({
          id: item._id,
          title: item.alertType === 'out_of_stock'
            ? `${item.itemName} is OUT OF STOCK`
            : `${item.itemName} is running low`,
          description: `Current stock: ${item.currentStock} ${item.reorderNumber ? `| Reorder level: ${item.reorderNumber}` : ''}`,
          time: item.alertType === 'out_of_stock' ? 'Urgent' : 'Low Stock',
          isRead: false,
          type: item.alertType,
          itemData: item
        }));
        setNotifications(stockAlerts);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getIconColor = (type) => {
    return type === 'out_of_stock' ? '#D45D3E' : '#E6A23C';
  };

  const getIconBg = (type) => {
    return type === 'out_of_stock' ? '#FFE8E0' : '#FFF6E0';
  };

  const getIconName = (type) => {
    return type === 'out_of_stock' ? 'alert-circle' : 'warning';
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="checkmark-circle-outline" size={80} color="#4CAF50" />
      <Text style={styles.emptyText}>All Stocks Healthy</Text>
      <Text style={styles.emptySubtext}>No low stock or out-of-stock items found.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#76462B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Stock Alerts</Text>
          <View style={{ width: 40 }} />
        </View>

        {notifications.length > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>
              {notifications.length} {notifications.length === 1 ? 'alert' : 'alerts'}
            </Text>
          </View>
        )}
      </View>

      {/* Notification List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#AD7F65" />
          <Text style={styles.loadingText}>Checking stock levels...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          contentContainerStyle={notifications.length === 0 ? styles.emptyListContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#AD7F65']}
              tintColor="#AD7F65"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.card,
                item.type === 'out_of_stock' && styles.outOfStockCard,
                item.type === 'low_stock' && styles.lowStockCard
              ]}
              activeOpacity={0.9}
            >
              <View style={[
                styles.iconContainer,
                { backgroundColor: getIconBg(item.type) }
              ]}>
                <Ionicons
                  name={getIconName(item.type)}
                  size={24}
                  color={getIconColor(item.type)}
                />
              </View>
              <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                  <Text style={[
                    styles.title,
                    item.type === 'out_of_stock' ? styles.outOfStockTitle : styles.lowStockTitle
                  ]}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.description}>
                  {item.description}
                </Text>
                <Text style={styles.skuText}>SKU: {item.itemData.sku}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9F5F0",
  },
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F0E6DD',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#3E3E3E',
    textAlign: 'center',
    flex: 1,
    marginRight: 0, // Adjusted simple alignment
  },
  unreadBadge: {
    backgroundColor: '#FFE8E0',
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  unreadText: {
    color: '#D45D3E',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 15,
    paddingTop: 10,
    paddingBottom: 30,
  },
  emptyListContent: {
    padding: 15,
    paddingTop: 10,
    paddingBottom: 30,
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    alignItems: 'center',
  },
  outOfStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#D45D3E',
  },
  lowStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#E6A23C',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2D2D2D',
    lineHeight: 20,
  },
  outOfStockTitle: {
    color: '#D45D3E',
  },
  lowStockTitle: {
    color: '#D9822B', // Slightly darker orange for text readability
  },
  description: {
    fontSize: 13.5,
    color: '#5A5A5A',
    marginBottom: 4,
    lineHeight: 19,
  },
  skuText: {
    fontSize: 12,
    color: '#8E8E8E',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E8E',
    textAlign: 'center',
  },
});
