import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { voidLogAPI } from '../services/api';

export default function VoidLog() {
  const [search, setSearch] = useState("");
  const [voidLogs, setVoidLogs] = useState([]);
  const [selectedVoid, setSelectedVoid] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const handleVoidPress = (voidItem) => {
    setSelectedVoid(voidItem);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedVoid(null);
  };

  const fetchVoidLogs = async () => {
    try {
      const response = await voidLogAPI.getAll();
      if (response.success && response.data) {
        setVoidLogs(response.data);
      }
    } catch (error) {
      console.error('Error fetching void logs:', error);
      // Keep empty array on error
      setVoidLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVoidLogs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVoidLogs();
  };

  const filteredLogs = voidLogs.filter(log => {
    const transactionId = log.voidId || log.transactionId || log.transaction?.receiptNo || '';
    const reason = log.voidReason || '';
    const approvedBy = log.approvedBy || log.approvedByName || '';
    const searchLower = search.toLowerCase();
    return (
      transactionId.toLowerCase().includes(searchLower) ||
      reason.toLowerCase().includes(searchLower) ||
      approvedBy.toLowerCase().includes(searchLower)
    );
  });

  const renderItem = ({ item }) => {
    const transactionId = item.voidId || item.transactionId || item.transaction?.receiptNo || item._id || 'N/A';
    const date = item.voidedAt || item.date || item.createdAt || item.timestamp || new Date();
    const reason = item.voidReason || 'No reason provided';
    const items = item.items || [];
    const total = item.totalAmount || item.total || 0;
    const approvedBy = item.approvedBy || item.voidedByName || 'N/A';

    return (
      <TouchableOpacity
        style={styles.logItem}
        onPress={() => handleVoidPress(item)}
      >
        <View style={styles.logHeader}>
          <Text style={styles.transactionId}>{transactionId}</Text>
          <Text style={styles.date}>
            {new Date(date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.logDetails}>
          <Text style={styles.reason}>{reason}</Text>
          {items.length > 0 && (
            <Text style={styles.items}>
              {items.map((i, idx) => {
                const qty = i.quantity || i.qty || 1;
                const name = i.itemName || i.name || i.productName || 'Unknown';
                return `${qty}x ${name}`;
              }).join(', ')}
            </Text>
          )}
        </View>

        <View style={styles.logFooter}>
          <Text style={styles.total}>₱{parseFloat(total).toFixed(2)}</Text>
          <Text style={styles.approvedBy}>Approved by: {approvedBy}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search void logs..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#999"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#AD7F65" />
          <Text style={styles.loadingText}>Loading void logs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLogs}
          renderItem={renderItem}
          keyExtractor={item => item._id || item.id || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#AD7F65']}
              tintColor="#AD7F65"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No void logs found</Text>
            </View>
          }
        />
      )}

      {/* Void Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Void Details</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedVoid && (() => {
                const transactionId = selectedVoid.voidId || selectedVoid.transactionId || selectedVoid.transaction?.receiptNo || selectedVoid._id || 'N/A';
                const date = selectedVoid.voidedAt || selectedVoid.date || selectedVoid.createdAt || selectedVoid.timestamp || new Date();
                const reason = selectedVoid.voidReason || 'No reason provided';
                const items = selectedVoid.items || [];
                const total = selectedVoid.totalAmount || selectedVoid.total || 0;
                const approvedBy = selectedVoid.approvedBy || selectedVoid.voidedByName || 'N/A';
                const status = selectedVoid.status || 'Voided';

                return (
                  <>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Transaction ID:</Text>
                      <Text style={styles.detailValue}>{transactionId}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date & Time:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(date).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>

                    {items.length > 0 && (
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Items Voided</Text>
                        {items.map((item, index) => {
                          const qty = item.quantity || item.qty || 1;
                          const name = item.itemName || item.name || item.productName || 'Unknown';
                          const price = item.price || 0;
                          return (
                            <View key={index} style={styles.itemRow}>
                              <Text style={styles.itemName}>{qty}x {name}</Text>
                              <Text style={styles.itemPrice}>₱{(qty * price).toFixed(2)}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.section}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Voided:</Text>
                        <Text style={styles.totalAmount}>₱{parseFloat(total).toFixed(2)}</Text>
                      </View>
                    </View>

                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Reason for Void</Text>
                      <View style={styles.reasonBox}>
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Approved By:</Text>
                      <Text style={[styles.detailValue, { color: '#2E7D32' }]}>
                        {approvedBy}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Status:</Text>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: status === 'Completed' ? '#E8F5E9' : '#FFF3E0' }
                      ]}>
                        <Text style={[
                          styles.statusText,
                          { color: status === 'Completed' ? '#2E7D32' : '#E65100' }
                        ]}>
                          {status}
                        </Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemName: {
    fontSize: 14,
    color: '#333',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  reasonBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Existing styles
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    color: '#333',
  },
  clearButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  logItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderLeftWidth: 4,
    borderLeftColor: '#D32F2F',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionId: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 16,
  },
  date: {
    color: '#666',
    fontSize: 12,
  },
  logDetails: {
    marginBottom: 12,
  },
  reason: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  items: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  logFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  total: {
    fontWeight: 'bold',
    color: '#D32F2F',
    fontSize: 16,
  },
  approvedBy: {
    fontSize: 12,
    color: '#888',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
});