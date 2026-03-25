import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

const StockOutModal = ({ visible, onClose, product, onConfirm, loading }) => {
  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedCombos, setSelectedCombos] = useState([]);
  const [comboQuantities, setComboQuantities] = useState({});
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
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

  const displayName = product?.itemName || product?.name || "";

  const hasSizes =
    product?.sizes &&
    typeof product.sizes === "object" &&
    Object.keys(product.sizes).length > 0;

  const hasVariants = useMemo(() => {
    if (!hasSizes) return false;
    return Object.values(product.sizes).some(
      (sd) =>
        typeof sd === "object" &&
        sd?.variants &&
        Object.keys(sd.variants).length > 0,
    );
  }, [product, hasSizes]);

  const batchList = useMemo(() => {
    if (!hasSizes || !hasVariants) return [];

    const getVariantQty = (vData) => {
      if (typeof vData === "number") return parseInt(vData, 10) || 0;
      if (vData && typeof vData === "object") {
        const qty = vData.qty ?? vData.quantity ?? 0;
        return parseInt(qty, 10) || 0;
      }
      return 0;
    };

    const maxBatchDepth = (() => {
      let max = 0;
      Object.entries(product.sizes).forEach(([_, sd]) => {
        if (!sd || typeof sd !== "object" || !sd?.variants) return;
        Object.values(sd.variants).forEach((vData) => {
          const batches =
            typeof vData === "object" && Array.isArray(vData.batches)
              ? vData.batches
              : [];
          max = Math.max(max, batches.length);
        });
      });
      return max;
    })();

    if (maxBatchDepth <= 0) {
      const openingBatchCode =
        product?.batchNumber || product?.openingBatchNumber || "B1";
      const combos = {};
      Object.entries(product.sizes).forEach(([size, sd]) => {
        if (!sd || typeof sd !== "object" || !sd?.variants) return;
        Object.entries(sd.variants).forEach(([variant, vData]) => {
          const qty = getVariantQty(vData);
          if (qty > 0) combos[`${size}|${variant}`] = { size, variant, qty };
        });
      });
      const comboArr = Object.values(combos);
      const totalQty = comboArr.reduce((sum, c) => sum + (c.qty || 0), 0);
      if (totalQty <= 0) return [];
      return [{ slotIndex: 0, code: openingBatchCode, totalQty, combos }];
    }

    const slots = Array.from({ length: maxBatchDepth }, (_, slotIndex) => ({
      slotIndex,
      code: "",
      totalQty: 0,
      combos: {},
    }));

    Object.entries(product.sizes).forEach(([size, sd]) => {
      if (!sd || typeof sd !== "object" || !sd?.variants) return;
      Object.entries(sd.variants).forEach(([variant, vData]) => {
        const batches =
          typeof vData === "object" && Array.isArray(vData.batches)
            ? vData.batches
            : [];
        const fallbackQty = (slotIndexForFallback) =>
          slotIndexForFallback === 0 ? getVariantQty(vData) : 0;

        for (let slotIndex = 0; slotIndex < maxBatchDepth; slotIndex++) {
          const b = batches[slotIndex];
          const qty = b ? parseInt(b.qty, 10) || 0 : fallbackQty(slotIndex);
          if (qty <= 0) continue;

          const slot = slots[slotIndex];
          const key = `${size}|${variant}`;
          if (!slot.combos[key]) slot.combos[key] = { size, variant, qty: 0 };
          slot.combos[key].qty += qty;
          slot.totalQty += qty;

          if (!slot.code) {
            slot.code =
              b?.batchCode ||
              (slotIndex === 0
                ? product?.batchNumber || product?.openingBatchNumber || "B1"
                : "");
          }
        }
      });
    });

    return slots.filter((s) => s.totalQty > 0);
  }, [product, hasSizes, hasVariants]);

  const batchCombos = useMemo(() => {
    if (!selectedBatch) return [];
    const slot = batchList.find((b) => String(b.slotIndex) === selectedBatch);
    if (!slot) return [];
    return Object.values(slot.combos).filter((c) => c.qty > 0);
  }, [selectedBatch, batchList]);

  useEffect(() => {
    if (visible && product) {
      setSelectedBatch("");
      setSelectedCombos([]);
      setComboQuantities({});
      setQuantity("");
      setReason("");
      setOtherReason("");
    }
  }, [visible, product?._id, product?.id]);

  if (!visible || !product) return null;

  const handleClose = () => {
    setSelectedBatch("");
    setSelectedCombos([]);
    setComboQuantities({});
    setQuantity("");
    setReason("");
    setOtherReason("");
    onClose();
  };

  const comboKey = (size, variant) => `${size}|${variant}`;

  const toggleCombo = (size, variant) => {
    const key = comboKey(size, variant);
    const isSelected = selectedCombos.includes(key);
    if (isSelected) {
      setSelectedCombos((prev) => prev.filter((k) => k !== key));
      setComboQuantities((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
    } else {
      setSelectedCombos((prev) => [...prev, key]);
    }
  };

  const handleQtyChange = (key, val) => {
    setComboQuantities((prev) => ({ ...prev, [key]: val }));
  };

  const isValid = () => {
    if (!reason) return false;
    if (reason === "Other" && !otherReason.trim()) return false;
    if (!hasSizes) return (parseInt(quantity, 10) || 0) > 0;
    if (hasVariants) {
      if (!selectedBatch) return false;
      return selectedCombos.some((key) => (comboQuantities[key] || 0) > 0);
    }
    return (parseInt(quantity, 10) || 0) > 0;
  };

  const handleSubmit = () => {
    const finalReason =
      reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    if (!hasSizes || !hasVariants) {
      const qty = parseInt(quantity, 10) || 0;
      if (qty > (product.currentStock || 0)) {
        Alert.alert(
          "Cannot remove stock",
          `Cannot remove more than available stock (${product.currentStock || 0})`,
        );
        return;
      }
      onConfirm({ quantity: qty, noSizes: true, reason: finalReason });
      return;
    }

    const variantQuantities = {};
    const selectedSizesSet = new Set();
    const overLimitItems = [];

    selectedCombos.forEach((key) => {
      const qty = parseInt(comboQuantities[key], 10) || 0;
      if (qty <= 0) return;
      const [size, variant] = key.split("|");
      const combo = batchCombos.find(
        (c) => c.size === size && c.variant === variant,
      );
      if (combo && qty > combo.qty) {
        overLimitItems.push(
          `${variant}${
            size !== VARIANT_ONLY_SIZE_KEY ? ` × ${size}` : ""
          } (max: ${combo.qty})`,
        );
      }
      if (!variantQuantities[size]) variantQuantities[size] = {};
      variantQuantities[size][variant] = qty;
      selectedSizesSet.add(size);
    });

    if (overLimitItems.length > 0) {
      Alert.alert(
        "Cannot remove stock",
        `Cannot remove more than available stock for:\n${overLimitItems.join("\n")}`,
      );
      return;
    }

    onConfirm({
      sizes: {},
      variantQuantities,
      selectedSizes: Array.from(selectedSizesSet),
      reason: finalReason,
      hasVariants: true,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="cube-outline" size={18} color="#111" />
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>−</Text>
                </View>
              </View>
              <Text style={styles.title}>Stock Out</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Text style={styles.close}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.row2}>
              <View style={styles.col}>
                <Text style={styles.label}>
                  PRODUCT NAME <Text style={styles.req}>*</Text>
                </Text>
                <Text style={styles.productName}>{displayName}</Text>
              </View>
              {hasVariants && batchList.length > 0 && (
                <View style={styles.col}>
                  <Text style={styles.label}>
                    BATCH NUMBER <Text style={styles.req}>*</Text>
                  </Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={selectedBatch}
                      onValueChange={(v) => {
                        setSelectedBatch(v);
                        setSelectedCombos([]);
                        setComboQuantities({});
                      }}
                    >
                      <Picker.Item label="Select Batch" value="" color="#9CA3AF" />
                      {batchList.map((b) => (
                        <Picker.Item
                          key={b.slotIndex}
                          label={`Batch ${b.slotIndex + 1}${b.code ? ` (${b.code})` : ""} (${b.totalQty})`}
                          value={String(b.slotIndex)}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}
            </View>

            {hasVariants && selectedBatch && batchCombos.length > 0 && (
              <View style={styles.chipSection}>
                <Text style={styles.chipSectionTitle}>
                  SELECT VARIANTS TO REMOVE
                </Text>
                <View style={styles.chipRow}>
                  {batchCombos.map((c) => {
                    const key = comboKey(c.size, c.variant);
                    const isSel = selectedCombos.includes(key);
                    const label =
                      c.size !== VARIANT_ONLY_SIZE_KEY
                        ? `${c.variant} x ${c.size}`
                        : c.variant;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.chip, isSel && styles.chipSel]}
                        onPress={() => toggleCombo(c.size, c.variant)}
                      >
                        <Text style={[styles.chipTxt, isSel && styles.chipTxtSel]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {hasVariants && selectedCombos.length > 0 && (
              <View style={styles.tableWrap}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 1.4 }]}>VARIANT</Text>
                  <Text style={[styles.th, { flex: 0.5, textAlign: "center" }]}>
                    STOCK
                  </Text>
                  <Text style={[styles.th, { flex: 0.55, textAlign: "center" }]}>
                    QTY OUT
                  </Text>
                </View>
                <ScrollView style={styles.tableBody} nestedScrollEnabled>
                  {selectedCombos.map((key) => {
                    const combo = batchCombos.find(
                      (c) => comboKey(c.size, c.variant) === key,
                    );
                    if (!combo) return null;
                    const [size, variant] = key.split("|");
                    const maxQty = combo.qty;
                    const val = comboQuantities[key] || "";
                    return (
                      <View key={key} style={styles.tr}>
                        <View style={[styles.td, { flex: 1.4, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 }]}>
                          {size !== VARIANT_ONLY_SIZE_KEY && (
                            <Text style={styles.badgeSize}>{size}</Text>
                          )}
                          {size !== VARIANT_ONLY_SIZE_KEY && (
                            <Text style={styles.mul}>×</Text>
                          )}
                          <Text style={styles.badgeVar}>{variant}</Text>
                        </View>
                        <Text style={[styles.td, { flex: 0.5, textAlign: "center" }]}>
                          {maxQty}
                        </Text>
                        <View style={[styles.td, { flex: 0.55 }]}>
                          <TextInput
                            style={styles.qtyIn}
                            keyboardType="number-pad"
                            value={val}
                            onChangeText={(t) => handleQtyChange(key, t)}
                            placeholder="0"
                            placeholderTextColor="#9CA3AF"
                          />
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {!hasVariants && (
              <View style={styles.block}>
                <Text style={styles.label}>QUANTITY TO REMOVE</Text>
                <Text style={styles.hint}>
                  Current Stock: {product.currentStock || 0}
                </Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="Enter quantity"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}

            <View style={styles.block}>
              <Text style={styles.label}>
                REASON <Text style={styles.req}>*</Text>
              </Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={reason}
                  onValueChange={(v) => {
                    setReason(v);
                    if (v !== "Other") setOtherReason("");
                  }}
                >
                  <Picker.Item label="EG. Damaged" value="" color="#9CA3AF" />
                  {reasons.map((r) => (
                    <Picker.Item key={r} label={r} value={r} />
                  ))}
                </Picker>
              </View>
              {reason === "Other" && (
                <TextInput
                  style={[styles.input, { marginTop: 8 }]}
                  value={otherReason}
                  onChangeText={setOtherReason}
                  placeholder="Please specify the reason"
                  placeholderTextColor="#9CA3AF"
                />
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancel} onPress={handleClose}>
              <Text style={styles.btnCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnGo, (!isValid() || loading) && styles.btnDisabled]}
              disabled={loading || !isValid()}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnGoTxt}>Remove</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 14,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "88%",
    overflow: "hidden",
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconWrap: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    marginTop: -1,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#111" },
  close: { fontSize: 26, color: "#9ca3af", fontWeight: "300" },
  body: { paddingHorizontal: 16, paddingTop: 12, maxHeight: 420 },
  row2: { flexDirection: "row", gap: 12, marginBottom: 14 },
  col: { flex: 1 },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: "#374151",
    marginBottom: 6,
  },
  req: { color: "#ef4444" },
  productName: { fontSize: 15, fontWeight: "700", color: "#111" },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  chipSection: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#f9fafb",
    marginBottom: 12,
  },
  chipSectionTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  chipSel: {
    backgroundColor: "#fef2f2",
    borderColor: "#f87171",
  },
  chipTxt: { fontSize: 11, fontWeight: "600", color: "#4b5563" },
  chipTxtSel: { color: "#b91c1c" },
  tableWrap: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  th: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    letterSpacing: 0.4,
  },
  tableBody: { maxHeight: 200 },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  td: { fontSize: 12, color: "#374151" },
  badgeSize: {
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#93c5fd",
    color: "#1d4ed8",
    overflow: "hidden",
  },
  mul: { fontSize: 9, color: "#9ca3af" },
  badgeVar: {
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#f9a8d4",
    color: "#be185d",
    overflow: "hidden",
  },
  qtyIn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "#fff",
  },
  block: { marginBottom: 14 },
  hint: { fontSize: 11, color: "#9ca3af", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 12,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  btnCancelTxt: { fontSize: 14, fontWeight: "600", color: "#4b5563" },
  btnGo: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.45 },
  btnGoTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },
});

export default StockOutModal;
