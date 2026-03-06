import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const StockOutModal = ({ visible, onClose, product, onConfirm, loading }) => {
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Sold");
  const [otherReason, setOtherReason] = useState("");

  const reasons = [
    "Sold",
    "Damaged",
    "Defective",
    "Returned Item",
    "Lost",
    "Expired",
    "Other",
  ];

  useEffect(() => {
    if (visible && product) {
      setSelectedSizes([]);
      setSizeQuantities({});
      setQuantity("");
      setReason("Sold");
      setOtherReason("");
    }
  }, [visible, product]);

  if (!visible || !product) return null;

  // Helper to get quantity from size data
  const getSizeQuantity = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.quantity !== undefined
    ) {
      return sizeData.quantity;
    }
    return typeof sizeData === "number" ? sizeData : 0;
  };

  const hasSizes =
    product.sizes &&
    typeof product.sizes === "object" &&
    Object.keys(product.sizes).length > 0;

  const availableSizes = hasSizes
    ? Object.keys(product.sizes).filter(
        (size) => getSizeQuantity(product.sizes[size]) > 0,
      )
    : [];

  const toggleSize = (size) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes((prev) => prev.filter((s) => s !== size));
      const newQuantities = { ...sizeQuantities };
      delete newQuantities[size];
      setSizeQuantities(newQuantities);
    } else {
      setSelectedSizes((prev) => [...prev, size]);
      setSizeQuantities((prev) => ({ ...prev, [size]: "" }));
    }
  };

  const handleQuantityChange = (size, qty) => {
    // Only allow numeric input
    const numericQty = qty.replace(/[^0-9]/g, "");
    const maxQty =
      product.sizes && product.sizes[size]
        ? getSizeQuantity(product.sizes[size])
        : 0;

    // Warn if exceeds available stock ?? logic is in handler or submit?
    // Let's enforce in UI as well but definitely validation on submit

    setSizeQuantities((prev) => ({
      ...prev,
      [size]: numericQty ? parseInt(numericQty) : "",
    }));
  };

  const handleSubmit = () => {
    if (reason === "Other" && !otherReason.trim()) {
      Alert.alert("Error", "Please specify the reason");
      return;
    }

    const finalReason =
      reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    if (!hasSizes) {
      // Product without sizes - simple quantity
      const qty = parseInt(quantity) || 0;
      if (qty <= 0) {
        Alert.alert("Error", "Please enter a valid quantity");
        return;
      }
      if (qty > (product.currentStock || 0)) {
        Alert.alert(
          "Error",
          `Cannot remove more than available stock (${product.currentStock || 0})`,
        );
        return;
      }
      onConfirm({
        quantity: qty,
        noSizes: true,
        reason: finalReason,
      });
      return;
    }

    // Product with sizes
    if (selectedSizes.length === 0) {
      Alert.alert("Error", "Please select at least one size");
      return;
    }

    const hasValidQuantities = selectedSizes.some((size) => {
      const qty = sizeQuantities[size];
      return typeof qty === "number" && qty > 0;
    });

    if (!hasValidQuantities) {
      Alert.alert(
        "Error",
        "Please enter quantities for at least one selected size",
      );
      return;
    }

    const invalidSizes = selectedSizes.filter((size) => {
      const requestedQty = sizeQuantities[size] || 0;
      const availableQty =
        product.sizes && product.sizes[size]
          ? getSizeQuantity(product.sizes[size])
          : 0;
      return requestedQty > availableQty;
    });

    if (invalidSizes.length > 0) {
      Alert.alert(
        "Error",
        `Cannot remove more than available stock for: ${invalidSizes.join(", ")}`,
      );
      return;
    }

    const finalQuantities = {};
    selectedSizes.forEach((size) => {
      if (sizeQuantities[size]) {
        finalQuantities[size] = parseInt(sizeQuantities[size]);
      }
    });

    onConfirm({
      sizes: finalQuantities,
      selectedSizes: selectedSizes,
      reason: finalReason,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleContainer}>
              <View
                style={[styles.iconContainer, { backgroundColor: "#e74c3c" }]}
              >
                <Ionicons name="remove" size={20} color="#fff" />
              </View>
              <Text style={styles.modalTitle}>Stock Out</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Product Info */}
            <View style={styles.productInfo}>
              {product.itemImage ? (
                <Image
                  source={{ uri: product.itemImage }}
                  style={styles.productImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.productImage, styles.placeholderImage]}>
                  <Ionicons name="image-outline" size={40} color="#ccc" />
                </View>
              )}
              <View style={styles.productDetails}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productSku}>SKU: {product.sku || "-"}</Text>
                <Text style={styles.productBrand}>
                  {product.brand || "No Brand"}
                </Text>
              </View>
            </View>

            {/* Sizes Selection or Simple Quantity */}
            {hasSizes ? (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Select Sizes to Remove
                  </Text>
                  {availableSizes.length > 0 ? (
                    <View style={styles.sizesGrid}>
                      {availableSizes.map((size) => {
                        const currentQty =
                          product.sizes && product.sizes[size]
                            ? getSizeQuantity(product.sizes[size])
                            : 0;
                        const isSelected = selectedSizes.includes(size);

                        return (
                          <TouchableOpacity
                            key={size}
                            style={[
                              styles.sizeChip,
                              isSelected && styles.sizeChipSelected,
                            ]}
                            onPress={() => toggleSize(size)}
                          >
                            <Text
                              style={[
                                styles.sizeChipText,
                                isSelected && styles.sizeChipTextSelected,
                              ]}
                            >
                              {size}
                            </Text>
                            <Text
                              style={[
                                styles.sizeChipStock,
                                isSelected && styles.sizeChipTextSelected,
                              ]}
                            >
                              ({currentQty})
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noStockText}>
                      No sizes available with stock.
                    </Text>
                  )}
                </View>

                {selectedSizes.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quantity to Remove</Text>
                    {selectedSizes.map((size) => {
                      const maxQty =
                        product.sizes && product.sizes[size]
                          ? getSizeQuantity(product.sizes[size])
                          : 0;
                      const enteredQty = sizeQuantities[size];
                      const isError = enteredQty > maxQty;

                      return (
                        <View key={size} style={styles.quantityRowContainer}>
                          <View style={styles.quantityRow}>
                            <Text style={styles.quantityLabel}>{size}</Text>
                            <TextInput
                              style={[
                                styles.quantityInput,
                                isError && styles.inputError,
                              ]}
                              value={sizeQuantities[size]?.toString() || ""}
                              onChangeText={(text) =>
                                handleQuantityChange(size, text)
                              }
                              placeholder="0"
                              keyboardType="numeric"
                            />
                          </View>
                          {isError && (
                            <Text style={styles.errorText}>
                              Cannot exceed {maxQty}
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quantity to Remove</Text>
                <Text style={styles.currentStockText}>
                  Current Stock: {product.currentStock || 0}
                </Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={(text) =>
                    setQuantity(text.replace(/[^0-9]/g, ""))
                  }
                  placeholder="Enter quantity to remove"
                  keyboardType="numeric"
                />
                {parseInt(quantity) > (product.currentStock || 0) && (
                  <Text style={styles.errorText}>
                    Cannot exceed current stock ({product.currentStock || 0})
                  </Text>
                )}
              </View>
            )}

            {/* Reason */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reason</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={reason}
                  onValueChange={(itemValue) => setReason(itemValue)}
                >
                  {reasons.map((r) => (
                    <Picker.Item key={r} label={r} value={r} />
                  ))}
                </Picker>
              </View>

              {reason === "Other" && (
                <TextInput
                  style={styles.input}
                  value={otherReason}
                  onChangeText={setOtherReason}
                  placeholder="Specify reason"
                />
              )}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Remove Stocks</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  productInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  placeholderImage: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  productDetails: {
    marginLeft: 16,
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  productSku: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  productBrand: {
    fontSize: 14,
    color: "#888",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  sizesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
    minWidth: 70,
    alignItems: "center",
  },
  sizeChipSelected: {
    backgroundColor: "#e74c3c",
    borderColor: "#e74c3c",
  },
  sizeChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  sizeChipTextSelected: {
    color: "#fff",
  },
  sizeChipStock: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  noStockText: {
    color: "#888",
    fontStyle: "italic",
  },
  currentStockText: {
    fontSize: 14,
    color: "#888",
    marginBottom: 8,
  },
  quantityRowContainer: {
    marginBottom: 12,
  },
  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityLabel: {
    width: 60,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
  inputError: {
    borderColor: "#e74c3c",
  },
  errorText: {
    color: "#e74c3c",
    fontSize: 12,
    marginTop: 4,
    marginLeft: 60,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  confirmButton: {
    backgroundColor: "#e74c3c", // Red for removal
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default StockOutModal;
