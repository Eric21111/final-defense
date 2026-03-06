import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { archiveAPI } from "../services/api";

const formatDateTime = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const reasonColor = (reason) => {
  switch (reason) {
    case "Defective":
      return { bg: "#fef2f2", text: "#dc2626" };
    case "Damaged":
      return { bg: "#fef2f2", text: "#dc2626" };
    case "Expired":
      return { bg: "#fef2f2", text: "#dc2626" };
    default:
      return { bg: "#fef2f2", text: "#dc2626" };
  }
};

export default function Archive() {
  const router = useRouter();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [itemToRestore, setItemToRestore] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const fetchArchives = useCallback(async () => {
    try {
      const response = await archiveAPI.getAll();
      if (response.success && response.data) {
        setArchives(response.data);
      } else {
        setArchives([]);
      }
    } catch (error) {
      console.error("Error fetching archives:", error);
      setArchives([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchArchives();
  };

  const handleRestore = (item) => {
    setItemToRestore(item);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!itemToRestore) return;
    setRestoring(true);
    try {
      const id = itemToRestore._id || itemToRestore.id;
      const response = await archiveAPI.restore(id);
      if (response.success) {
        await fetchArchives();
      }
    } catch (error) {
      console.error("Error restoring item:", error);
    } finally {
      setRestoring(false);
      setShowRestoreModal(false);
      setItemToRestore(null);
    }
  };

  const cancelRestore = () => {
    setShowRestoreModal(false);
    setItemToRestore(null);
  };

  const renderArchiveItem = ({ item, index }) => {
    const archiveNumber = archives.length - index;
    const colors = reasonColor(item.reason);

    return (
      <View style={styles.card}>
        {/* Header row: Archive # and Restore */}
        <View style={styles.cardHeader}>
          <Text style={styles.archiveNumber}>#{archiveNumber}</Text>
          <TouchableOpacity
            onPress={() => handleRestore(item)}
            style={styles.restoreButton}
          >
            <Ionicons name="refresh" size={18} color="#16a34a" />
          </TouchableOpacity>
        </View>

        {/* Image + Info row */}
        <View style={styles.cardBody}>
          {/* Item Image */}
          <View style={styles.imageContainer}>
            {item.itemImage ? (
              <Image
                source={{ uri: item.itemImage }}
                style={styles.itemImage}
                resizeMode="cover"
                onError={() => {}}
              />
            ) : (
              <View style={styles.noImage}>
                <Text style={styles.noImageText}>No Image</Text>
              </View>
            )}
          </View>

          {/* Item Details */}
          <View style={styles.itemDetails}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.itemName || "Unknown"}
            </Text>
            {item.variant ? (
              <Text style={styles.itemSubtext}>({item.variant})</Text>
            ) : null}
            {item.selectedSize ? (
              <Text style={styles.itemSubtext}>Size: {item.selectedSize}</Text>
            ) : null}
            {item.brandName ? (
              <Text style={styles.itemSubtext}>Brand: {item.brandName}</Text>
            ) : null}
            <Text style={styles.skuText}>SKU: {item.sku || "N/A"}</Text>
          </View>
        </View>

        {/* Details grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Category</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.category || "N/A"}</Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Quantity</Text>
            <Text style={styles.detailValue}>{item.quantity || 0}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.priceValue}>
              ₱{parseFloat(item.itemPrice || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Reason */}
        <View style={styles.reasonRow}>
          <Text style={styles.detailLabel}>Reason</Text>
          <View style={[styles.reasonBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.reasonText, { color: colors.text }]}>
              {item.reason}
            </Text>
          </View>
        </View>
        {item.returnReason ? (
          <Text style={styles.returnReasonText}>{item.returnReason}</Text>
        ) : null}
        {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}

        {/* Footer: Date & Archived By */}
        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={14} color="#888" />
            <Text style={styles.footerText}>
              {formatDateTime(item.archivedAt)}
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="person-outline" size={14} color="#888" />
            <Text style={styles.footerText}>{item.archivedBy || "N/A"}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B4513" />
          <Text style={styles.loadingText}>Loading archives...</Text>
        </View>
      ) : (
        <FlatList
          data={archives}
          renderItem={renderArchiveItem}
          keyExtractor={(item) =>
            (item._id || item.id || Math.random()).toString()
          }
          contentContainerStyle={
            archives.length === 0 ? styles.emptyListContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#8B4513"]}
              tintColor="#8B4513"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="archive-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No Archive yet</Text>
              <Text style={styles.emptySubtext}>
                Items removed from inventory will appear here
              </Text>
            </View>
          }
        />
      )}

      {/* Restore Confirmation Modal */}
      <Modal
        visible={showRestoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelRestore}
      >
        <TouchableWithoutFeedback onPress={cancelRestore}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Confirm Restore</Text>
                <Text style={styles.modalText}>
                  Are you sure you want to restore this item? It will be moved
                  back to your inventory.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={cancelRestore}
                    disabled={restoring}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmBtn]}
                    onPress={confirmRestore}
                    disabled={restoring}
                  >
                    {restoring ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmButtonText}>Restore</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyListContent: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    color: "#999",
    fontWeight: "500",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
  },

  // Card styles
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  archiveNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  restoreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    justifyContent: "center",
    alignItems: "center",
  },
  cardBody: {
    flexDirection: "row",
    marginBottom: 12,
  },
  imageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  noImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    fontSize: 10,
    color: "#999",
  },
  itemDetails: {
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  itemSubtext: {
    fontSize: 12,
    color: "#888",
  },
  skuText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "monospace",
    marginTop: 2,
  },

  // Details grid
  detailsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  detailItem: {
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: "500",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  categoryBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },

  // Reason
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  returnReasonText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
    marginLeft: 2,
  },
  notesText: {
    fontSize: 12,
    color: "#888",
    fontStyle: "italic",
    marginBottom: 2,
    marginLeft: 2,
  },

  // Footer
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 10,
    marginTop: 8,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerText: {
    fontSize: 12,
    color: "#888",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  modalText: {
    fontSize: 15,
    color: "#555",
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginLeft: 12,
    minWidth: 100,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  confirmBtn: {
    backgroundColor: "#8B4513",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "500",
  },
  confirmButtonText: {
    color: "white",
    fontWeight: "500",
  },
});
