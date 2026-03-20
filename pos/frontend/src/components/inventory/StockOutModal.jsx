import { useEffect, useState, useMemo } from "react";
import { useTheme } from "../../context/ThemeContext";

const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

const StockOutModal = ({ isOpen, onClose, product, onConfirm, loading }) => {
  const { theme } = useTheme();

  const [selectedBatch, setSelectedBatch] = useState("");
  const [selectedCombos, setSelectedCombos] = useState([]);
  const [comboQuantities, setComboQuantities] = useState({});
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");

  const reasons = ["Sold", "Damaged", "Defective", "Returned Item", "Lost", "Expired", "Other"];

  const hasSizes = product?.sizes && typeof product.sizes === "object" && Object.keys(product.sizes).length > 0;

  const hasVariants = useMemo(() => {
    if (!hasSizes) return false;
    return Object.values(product.sizes).some(sd => typeof sd === "object" && sd?.variants && Object.keys(sd.variants).length > 0);
  }, [product, hasSizes]);

  const batchList = useMemo(() => {
    if (!hasSizes || !hasVariants) return [];

    const getVariantQty = (vData) => {
      if (typeof vData === "number") return parseInt(vData, 10) || 0;
      if (vData && typeof vData === "object") {
        const qty =
          vData.qty ??
          vData.quantity ??
          0;
        return parseInt(qty, 10) || 0;
      }
      return 0;
    };

    const batchMap = {};
    const fallbackCombosMap = {}; // key: `${size}|${variant}` -> { size, variant, qty }
    Object.entries(product.sizes).forEach(([size, sd]) => {
      if (typeof sd !== "object" || !sd?.variants) return;
      Object.entries(sd.variants).forEach(([variant, vData]) => {
        const batches = typeof vData === "object" && Array.isArray(vData.batches) ? vData.batches : [];

        // Track opening batch qty from whatever variant quantity is stored.
        const fallbackQty = getVariantQty(vData);
        if (fallbackQty > 0) {
          const key = `${size}|${variant}`;
          if (!fallbackCombosMap[key]) fallbackCombosMap[key] = { size, variant, qty: 0 };
          fallbackCombosMap[key].qty += fallbackQty;
        }

        batches.forEach(b => {
          const code = b.batchCode || "Default";
          if (!batchMap[code]) batchMap[code] = { code, totalQty: 0, combos: {} };
          const key = `${size}|${variant}`;
          if (!batchMap[code].combos[key]) batchMap[code].combos[key] = { size, variant, qty: 0 };
          batchMap[code].combos[key].qty += (b.qty || 0);
          batchMap[code].totalQty += (b.qty || 0);
        });
      });
    });

    const realBatches = Object.values(batchMap).filter(b => b.totalQty > 0);
    if (realBatches.length > 0) return realBatches;

    // Fallback: no "new batches" yet, but we still need a batch dropdown (opening batch / batch 1).
    const openingBatchCode = product?.batchNumber || product?.openingBatchNumber || "B1";
    const combosEntries = Object.entries(fallbackCombosMap).filter(([, c]) => c.qty > 0);
    if (combosEntries.length === 0) return [];

    const totalQty = combosEntries.reduce((sum, [, c]) => sum + (c.qty || 0), 0) || parseInt(product.currentStock, 10) || 0;
    if (totalQty <= 0) return [];

    const combos = {};
    combosEntries.forEach(([key, combo]) => {
      combos[key] = combo;
    });

    return [{ code: openingBatchCode, totalQty, combos }];
  }, [product, hasSizes, hasVariants]);

  const batchCombos = useMemo(() => {
    if (!selectedBatch) return [];
    const batch = batchList.find(b => b.code === selectedBatch);
    if (!batch) return [];
    return Object.values(batch.combos).filter(c => c.qty > 0);
  }, [selectedBatch, batchList]);

  useEffect(() => {
    if (isOpen && product) {
      setSelectedBatch("");
      setSelectedCombos([]);
      setComboQuantities({});
      setQuantity("");
      setReason("");
      setOtherReason("");
    }
  }, [isOpen, product?._id]);

  if (!isOpen || !product) return null;

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
      setSelectedCombos(prev => prev.filter(k => k !== key));
      setComboQuantities(prev => { const n = { ...prev }; delete n[key]; return n; });
    } else {
      setSelectedCombos(prev => [...prev, key]);
    }
  };

  const handleQtyChange = (key, val) => {
    setComboQuantities(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
  };

  const isValid = () => {
    if (!reason) return false;
    if (reason === "Other" && !otherReason.trim()) return false;
    if (!hasSizes) return (parseInt(quantity) || 0) > 0;
    if (hasVariants) {
      if (!selectedBatch) return false;
      return selectedCombos.some(key => (comboQuantities[key] || 0) > 0);
    }
    return (parseInt(quantity) || 0) > 0;
  };

  const handleSubmit = () => {
    const finalReason = reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    if (!hasSizes || !hasVariants) {
      const qty = parseInt(quantity) || 0;
      if (qty > (product.currentStock || 0)) {
        alert(`Cannot remove more than available stock (${product.currentStock || 0})`);
        return;
      }
      onConfirm({ quantity: qty, noSizes: true, reason: finalReason });
      return;
    }

    const variantQuantities = {};
    const selectedSizes = new Set();
    const overLimitItems = [];

    selectedCombos.forEach(key => {
      const qty = comboQuantities[key] || 0;
      if (qty <= 0) return;
      const [size, variant] = key.split("|");
      const combo = batchCombos.find(c => c.size === size && c.variant === variant);
      if (combo && qty > combo.qty) {
        overLimitItems.push(`${variant}${size !== VARIANT_ONLY_SIZE_KEY ? ` × ${size}` : ""} (max: ${combo.qty})`);
      }
      if (!variantQuantities[size]) variantQuantities[size] = {};
      variantQuantities[size][variant] = qty;
      selectedSizes.add(size);
    });

    if (overLimitItems.length > 0) {
      alert(`Cannot remove more than available stock for:\n${overLimitItems.join("\n")}`);
      return;
    }

    onConfirm({
      sizes: {},
      variantQuantities,
      selectedSizes: Array.from(selectedSizes),
      reason: finalReason,
      hasVariants: true,
    });
  };

  const isDark = theme === "dark";
  const inputCls = `w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent appearance-none cursor-pointer ${isDark ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm pointer-events-none">
      <div
        className={`rounded-2xl w-full max-w-lg relative pointer-events-auto overflow-hidden ${isDark ? "bg-[#1E1B18]" : "bg-white"}`}
        style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.1)" }}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center border-2 border-white">
                <span className="text-white text-[8px] font-bold leading-none">−</span>
              </span>
            </div>
            <h2 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Stock Out</h2>
          </div>
          <button onClick={handleClose} className={`text-2xl font-light ${isDark ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}>×</button>
        </div>

        {/* Body */}
        <div className="px-6 pb-4">
          <div className="space-y-5">

            {/* Product Name + Batch Number */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Product Name <span className="text-red-500">*</span>
                </label>
                <p className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{product.itemName}</p>
              </div>
              {hasVariants && batchList.length > 0 && (
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Batch Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBatch}
                      onChange={(e) => { setSelectedBatch(e.target.value); setSelectedCombos([]); setComboQuantities({}); }}
                      className={inputCls}
                    >
                      <option value="" disabled style={{ color: '#9CA3AF' }}>Select Batch</option>
                      {batchList.map(b => (
                        <option key={b.code} value={b.code}>{b.code} ({b.totalQty})</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Variant selection chips */}
            {hasVariants && selectedBatch && batchCombos.length > 0 && (
              <div className={`rounded-xl border p-4 ${isDark ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-gray-50"}`}>
                <p className={`text-xs font-bold uppercase tracking-wide mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>Select Variants to Remove</p>
                <div className="flex flex-wrap gap-2">
                  {batchCombos.map(c => {
                    const key = comboKey(c.size, c.variant);
                    const isSel = selectedCombos.includes(key);
                    const label = c.size !== VARIANT_ONLY_SIZE_KEY ? `${c.variant} x ${c.size}` : c.variant;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleCombo(c.size, c.variant)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                          isSel
                            ? "bg-red-50 border-red-400 text-red-700"
                            : isDark ? "border-gray-600 text-gray-300 hover:border-gray-400" : "border-gray-300 text-gray-600 hover:border-gray-400"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Qty inputs — scrollable table */}
            {hasVariants && selectedCombos.length > 0 && (
              <div className={`rounded-xl border overflow-hidden ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
                  <table className="w-full text-xs">
                    <thead className={`sticky top-0 z-10 ${isDark ? "bg-[#2A2724]" : "bg-gray-50"}`}>
                      <tr className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                        <th className={`px-4 py-2 text-left font-bold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>Variant</th>
                        <th className={`px-4 py-2 text-center font-bold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>Stock</th>
                        <th className={`px-4 py-2 text-center font-bold uppercase tracking-wide ${isDark ? "text-gray-400" : "text-gray-500"}`}>Qty Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCombos.map(key => {
                        const combo = batchCombos.find(c => comboKey(c.size, c.variant) === key);
                        if (!combo) return null;
                        const [size, variant] = key.split("|");
                        const maxQty = combo.qty;
                        const val = comboQuantities[key] || "";
                        return (
                          <tr key={key} className={`border-b last:border-b-0 ${isDark ? "border-gray-700/50" : "border-gray-100"}`}>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                {size !== VARIANT_ONLY_SIZE_KEY && (
                                  <span className={`inline-block px-2.5 py-0.5 text-[11px] rounded-full font-medium border border-dashed ${isDark ? "border-blue-400/40 text-blue-400" : "border-blue-300 text-blue-700"}`}>{size}</span>
                                )}
                                {size !== VARIANT_ONLY_SIZE_KEY && <span className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>×</span>}
                                <span className={`inline-block px-2.5 py-0.5 text-[11px] rounded-full font-medium border border-dashed ${isDark ? "border-pink-400/40 text-pink-400" : "border-pink-300 text-pink-700"}`}>{variant}</span>
                              </div>
                            </td>
                            <td className={`px-4 py-2.5 text-center font-medium ${isDark ? "text-gray-300" : "text-gray-600"}`}>{maxQty}</td>
                            <td className="px-4 py-2.5 text-center">
                              <input
                                type="number"
                                min="0"
                                max={maxQty}
                                value={val}
                                onChange={(e) => handleQtyChange(key, e.target.value)}
                                placeholder="0"
                                className={`w-20 mx-auto px-2 py-1.5 text-sm text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"}`}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Simple qty for non-variant products */}
            {!hasVariants && (
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>Quantity to Remove</label>
                <p className={`text-xs mb-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Current Stock: {product.currentStock || 0}</p>
                <input
                  type="number"
                  min="1"
                  max={product.currentStock || 0}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 ${isDark ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                />
              </div>
            )}

            {/* Reason */}
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Reason <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); if (e.target.value !== "Other") setOtherReason(""); }}
                  className={inputCls}
                >
                  <option value="" disabled style={{ color: '#9CA3AF' }}>EG. Damaged</option>
                  {reasons.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              {reason === "Other" && (
                <input
                  type="text"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Please specify the reason"
                  className={`w-full mt-2 px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 ${isDark ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-between items-center px-6 py-4 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
          <button
            type="button"
            onClick={handleClose}
            className={`px-8 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${isDark ? "text-gray-300 border-gray-600 hover:bg-gray-700" : "text-gray-600 border-gray-300 hover:bg-gray-100"}`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !isValid()}
            onClick={handleSubmit}
            className="px-8 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed bg-red-600"
          >
            {loading ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockOutModal;
