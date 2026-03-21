import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { generateDynamicSku } from "../../utils/skuUtils";

const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

const ViewProductModal = ({
  showViewModal,
  setShowViewModal,
  viewingProduct,
  formatDate
}) => {
  const { theme } = useTheme();
  /** 'totals' = aggregate stock/price/exp; number = batch slot index (0 = oldest / current FIFO) */
  const [batchTab, setBatchTab] = useState("totals");

  const toNum = (v) => {
    const n = typeof v === "number" ? v : parseInt(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getBatchList = (data) => {
    if (!data || typeof data !== "object") return [];
    return Array.isArray(data.batches) ? data.batches : [];
  };

  /** Single "Expiration" column: do not show one batch's date if another batch with stock has no expiry */
  const renderAggregateExpiration = (batches) => {
    const active = (Array.isArray(batches) ? batches : []).filter((b) => toNum(b?.qty) > 0);
    if (active.length === 0) {
      return <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>;
    }
    const withExp = active.filter((b) => b?.expirationDate);
    const withoutExp = active.filter((b) => !b?.expirationDate);
    if (withExp.length > 0 && withoutExp.length > 0) {
      return <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>;
    }
    if (withExp.length === 0) {
      return <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>;
    }
    const dates = [...new Set(withExp.map((b) => String(b.expirationDate).slice(0, 10)))].sort();
    const nearest = dates[0];
    const now = new Date();
    const expDate = new Date(nearest);
    const daysUntil = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
    const colorClass = daysUntil < 0 ? "text-red-500 font-semibold" : daysUntil <= 30 ? "text-yellow-500 font-semibold" : (theme === "dark" ? "text-gray-300" : "text-gray-600");
    return (
      <div className="space-y-0.5">
        <div className={`text-xs ${colorClass}`}>{nearest}</div>
        {dates.length > 1 && (
          <div className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Multiple expiration dates</div>
        )}
        {dates.length === 1 && daysUntil < 0 && <div className="text-[10px] text-red-400">Expired</div>}
        {dates.length === 1 && daysUntil >= 0 && daysUntil <= 30 && <div className="text-[10px] text-yellow-400">Expiring soon</div>}
      </div>
    );
  };

  const renderBatchSlotCell = (batch, slotIndex) => {
    if (!batch) {
      return <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>;
    }
    const qty = toNum(batch.qty);
    const isZero = qty === 0;
    const pillClass =
      slotIndex === 0
        ? isZero
          ? "bg-red-100 text-red-700"
          : "bg-green-100 text-green-700"
        : slotIndex === 1
          ? isZero
            ? "bg-red-100 text-red-700"
            : "bg-blue-100 text-blue-700"
          : isZero
            ? "bg-red-100 text-red-700"
            : theme === "dark"
              ? "bg-violet-900/50 text-violet-200"
              : "bg-violet-100 text-violet-900";

    return (
      <div className="space-y-0.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pillClass}`}>
          {qty} {viewingProduct?.unitOfMeasure || "pcs"}
        </span>
        <div className={`text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
          Sell: ₱{(batch.price ?? 0).toFixed ? batch.price.toFixed(2) : Number(batch.price || 0).toFixed(2)} · Buy: ₱
          {(batch.costPrice ?? 0).toFixed ? batch.costPrice.toFixed(2) : Number(batch.costPrice || 0).toFixed(2)}
          {(batch.batchCode || batch.expirationDate) && (
            <span className="ml-2">
              {batch.batchCode ? `· Lot: ${batch.batchCode}` : ""}
              {batch.expirationDate ? ` · Exp: ${String(batch.expirationDate).slice(0, 10)}` : ""}
            </span>
          )}
        </div>
      </div>
    );
  };

  const maxBatchDepth = useMemo(() => {
    if (!viewingProduct?.sizes || typeof viewingProduct.sizes !== "object") return 0;
    let max = 0;
    Object.values(viewingProduct.sizes).forEach((sizeData) => {
      if (!sizeData || typeof sizeData !== "object") return;
      if (sizeData.variants && typeof sizeData.variants === "object") {
        Object.values(sizeData.variants).forEach((variantData) => {
          if (variantData && typeof variantData === "object" && Array.isArray(variantData.batches)) {
            max = Math.max(max, variantData.batches.length);
          }
        });
      }
      if (Array.isArray(sizeData.batches)) {
        max = Math.max(max, sizeData.batches.length);
      }
    });
    return max;
  }, [viewingProduct]);

  /** Sum of qty in the selected batch slot across all options; null when viewing totals */
  const selectedBatchSlotTotal = useMemo(() => {
    if (!viewingProduct?.sizes || typeof viewingProduct.sizes !== "object") return null;
    if (batchTab === "totals" || typeof batchTab !== "number") return null;
    const slot = batchTab;
    let sum = 0;
    Object.values(viewingProduct.sizes).forEach((sizeData) => {
      if (!sizeData || typeof sizeData !== "object") return;
      if (sizeData.variants && typeof sizeData.variants === "object") {
        Object.values(sizeData.variants).forEach((variantData) => {
          if (variantData && typeof variantData === "object" && Array.isArray(variantData.batches)) {
            const b = variantData.batches[slot];
            if (b) sum += toNum(b.qty);
          }
        });
        return;
      }
      if (Array.isArray(sizeData.batches)) {
        const b = sizeData.batches[slot];
        if (b) sum += toNum(b.qty);
      }
    });
    return sum;
  }, [viewingProduct, batchTab]);

  // If the user opens a different product, reset back to totals view
  useEffect(() => {
    setBatchTab("totals");
  }, [viewingProduct?._id]);

  if (!showViewModal || !viewingProduct) return null;


  const totalStock =
    viewingProduct.sizes &&
      typeof viewingProduct.sizes === "object" &&
      Object.keys(viewingProduct.sizes).length > 0 ?
      Object.values(viewingProduct.sizes).reduce((sum, sizeData) => {
        if (typeof sizeData === "object" && sizeData !== null && sizeData.variants && typeof sizeData.variants === "object") {
          const vSum = Object.values(sizeData.variants).reduce((s, v) => {
            if (typeof v === "number") return s + (parseInt(v, 10) || 0);
            if (v && typeof v === "object" && v.quantity !== undefined) return s + (parseInt(v.quantity, 10) || 0);
            return s;
          }, 0);
          if (vSum > 0) return sum + vSum;
        }
        const qty =
          typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined ?
            sizeData.quantity :
            typeof sizeData === "number" ?
              sizeData :
              0;
        return sum + qty;
      }, 0) :
      viewingProduct.currentStock || 0;

  const showPerBatchColumn = maxBatchDepth > 0 && typeof batchTab === "number";
  const tableFooterTotal = selectedBatchSlotTotal !== null ? selectedBatchSlotTotal : totalStock;
  const tableFooterLabel =
    selectedBatchSlotTotal !== null ? "Stock in this batch:" : "Total Options Stock:";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-9999 p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setShowViewModal(false)}>

      <div
        className={`rounded-2xl w-full max-w-6xl max-h-[90vh] relative overflow-hidden flex flex-col ${theme === "dark" ? "bg-[#1E1B18] text-white" : "bg-white text-gray-900"}`}
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)"
        }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className={`px-6 py-4 border-b shrink-0 ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center shadow-sm">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold truncate">{viewingProduct.itemName}</h2>
                  <div className={`mt-0.5 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                    SKU: <span className={`font-semibold ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>{viewingProduct.sku || "—"}</span>
                    {viewingProduct.category ? <span className="ml-2">· {viewingProduct.category}</span> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowViewModal(false)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${theme === "dark"
                  ? "border-gray-700 text-gray-300 hover:bg-gray-800"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}
                aria-label="Close modal"
              >
                <span className="text-2xl leading-none">×</span>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Top Row: Image | Overview + Pricing + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Image */}
              <div className="lg:col-span-5">
                <div className={`rounded-2xl border overflow-hidden h-full ${theme === "dark" ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-gray-50"}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Preview</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${theme === "dark" ? "border-gray-700 text-gray-200" : "border-gray-200 text-gray-700"}`}>
                          {viewingProduct.category || "—"}
                        </span>
                        {viewingProduct.genderCategory && (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${theme === "dark" ? "border-gray-700 text-gray-200" : "border-gray-200 text-gray-700"}`}>
                            {viewingProduct.genderCategory}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={`p-6 flex items-center justify-center ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}>
                    {viewingProduct.itemImage && viewingProduct.itemImage.trim() !== "" ? (
                      <img
                        src={viewingProduct.itemImage}
                        alt={viewingProduct.itemName}
                        className="w-full max-h-[320px] object-contain rounded-xl"
                      />
                    ) : (
                      <div className="text-center text-gray-400">
                        <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm">No Image Available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Overview + Pricing + Stats */}
              <div className="lg:col-span-7 space-y-4">
                {/* Overview */}
                <div className={`rounded-2xl border p-5 ${theme === "dark" ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Overview</div>
                      <div className="mt-2 text-lg font-bold truncate">{viewingProduct.itemName}</div>
                      <div className={`mt-1 text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                        {viewingProduct.category} {viewingProduct.subCategory ? `> ${viewingProduct.subCategory}` : ""}
                        {viewingProduct.foodSubtype ? ` · ${viewingProduct.foodSubtype}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className={`text-xs font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>SKU</div>
                      <div className={`px-3 py-1.5 rounded-xl border text-sm font-semibold ${theme === "dark" ? "border-gray-700 bg-[#1E1B18] text-gray-200" : "border-gray-200 bg-gray-50 text-gray-800"}`}>
                        {viewingProduct.sku || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className={`rounded-xl border p-3 ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-gray-50"}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Brand</div>
                      <div className={`mt-1 text-sm font-semibold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>{viewingProduct.brandName || "N/A"}</div>
                    </div>
                    <div className={`rounded-xl border p-3 ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-gray-50"}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Variant</div>
                      <div className={`mt-1 text-sm font-semibold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>{viewingProduct.variant || "N/A"}</div>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className={`rounded-2xl border p-5 ${theme === "dark" ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-white"}`}>
                  <div className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Pricing</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className={`rounded-xl border p-4 ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-gray-50"}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Selling Price</div>
                      <div className={`mt-1 text-lg font-bold ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                        {(() => {
                          const prices = [];
                          if (viewingProduct.sizes && typeof viewingProduct.sizes === "object") {
                            Object.values(viewingProduct.sizes).forEach((sizeData) => {
                              if (typeof sizeData === "object" && sizeData !== null) {
                                if (sizeData.variants && typeof sizeData.variants === "object") {
                                  Object.entries(sizeData.variants).forEach(([vName, v]) => {
                                    const vPrice = v?.price ?? sizeData.variantPrices?.[vName] ?? sizeData.price;
                                    if (vPrice !== undefined && vPrice !== null) prices.push(Number(vPrice));
                                  });
                                } else if (sizeData.variantPrices && typeof sizeData.variantPrices === "object") {
                                  Object.values(sizeData.variantPrices).forEach((p) => {
                                    if (p !== undefined && p !== null) prices.push(Number(p));
                                  });
                                } else if (sizeData.price !== undefined && sizeData.price !== null) {
                                  prices.push(Number(sizeData.price));
                                }
                              }
                            });
                          }
                          if (prices.length > 0) {
                            const minP = Math.min(...prices);
                            const maxP = Math.max(...prices);
                            return minP !== maxP ? `₱${minP.toFixed(2)} - ₱${maxP.toFixed(2)}` : `₱${minP.toFixed(2)}`;
                          }
                          return `₱${viewingProduct.itemPrice?.toFixed(2) || "0.00"}`;
                        })()}
                      </div>
                    </div>
                    <div className={`rounded-xl border p-4 ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-gray-50"}`}>
                      <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Purchase Price</div>
                      <div className={`mt-1 text-lg font-bold ${theme === "dark" ? "text-red-400" : "text-red-600"}`}>
                        {(() => {
                          const costs = [];
                          if (viewingProduct.sizes && typeof viewingProduct.sizes === "object") {
                            Object.values(viewingProduct.sizes).forEach((sizeData) => {
                              if (typeof sizeData === "object" && sizeData !== null) {
                                if (sizeData.variants && typeof sizeData.variants === "object") {
                                  Object.entries(sizeData.variants).forEach(([vName, v]) => {
                                    const vCost = v?.costPrice ?? sizeData.variantCostPrices?.[vName] ?? sizeData.costPrice;
                                    if (vCost !== undefined && vCost !== null) costs.push(Number(vCost));
                                  });
                                } else if (sizeData.costPrice !== undefined && sizeData.costPrice !== null) {
                                  costs.push(Number(sizeData.costPrice));
                                }
                              }
                            });
                          }
                          if (costs.length > 0) {
                            const minC = Math.min(...costs);
                            const maxC = Math.max(...costs);
                            return minC !== maxC ? `₱${minC.toFixed(2)} - ₱${maxC.toFixed(2)}` : `₱${minC.toFixed(2)}`;
                          }
                          return `₱${viewingProduct.costPrice?.toFixed(2) || "0.00"}`;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total Stock / Reorder Level */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`rounded-xl border p-3 ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-gray-50"}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Total Stock</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div className={`text-lg font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>{totalStock}</div>
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${totalStock === 0 ? "bg-red-100 text-red-700" : totalStock <= (viewingProduct.reorderNumber || 10) ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {totalStock === 0 ? "Out" : totalStock <= (viewingProduct.reorderNumber || 10) ? "Low" : "In Stock"}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-xl border p-3 ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-gray-50"}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Reorder Level</div>
                    <div className={`mt-1 text-lg font-bold ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>{viewingProduct.reorderNumber || 0}</div>
                    <div className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Threshold for low-stock</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stock Table — Full Width */}
            <div className={`rounded-2xl border ${theme === "dark" ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-white"}`}>
              <div
                className="px-5 py-4 border-b flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: theme === "dark" ? "#374151" : "#E5E7EB" }}
              >
                <div className="min-w-0">
                  <div className={`text-xs font-semibold uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Stock</div>
                  <div className={`mt-0.5 text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                    {maxBatchDepth > 0
                      ? showPerBatchColumn
                        ? batchTab === 0
                          ? "Showing oldest batch (FIFO) per option"
                          : `Showing batch ${batchTab + 1} per option`
                        : "Showing total + price per option"
                      : "Showing total + price per option"}
                  </div>
                </div>
                {maxBatchDepth > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setBatchTab("totals")}
                      className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-200 active:scale-[0.98] ${batchTab === "totals"
                        ? "bg-[#AD7F65] text-white border-[#AD7F65] shadow-sm"
                        : theme === "dark"
                          ? "bg-[#1E1B18] text-gray-300 border-gray-600 hover:border-[#AD7F65]"
                          : "bg-white text-gray-700 border-gray-200 hover:border-[#AD7F65]"
                        }`}
                    >
                      Totals
                    </button>
                    {Array.from({ length: maxBatchDepth }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setBatchTab(i)}
                        className={`inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all duration-200 active:scale-[0.98] ${batchTab === i
                          ? "bg-[#AD7F65] text-white border-[#AD7F65] shadow-sm"
                          : theme === "dark"
                            ? "bg-[#1E1B18] text-gray-300 border-gray-600 hover:border-[#AD7F65]"
                            : "bg-white text-gray-700 border-gray-200 hover:border-[#AD7F65]"
                          }`}
                      >
                        {i === 0 ? "Batch 1 (current stock)" : `Batch ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4">
                {viewingProduct.sizes &&
                  typeof viewingProduct.sizes === "object" &&
                  Object.keys(viewingProduct.sizes).length > 0 ? (
                  <div className={`overflow-x-auto rounded-xl border ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-white"}`}>
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className={`text-xs uppercase bg-opacity-50 ${theme === "dark" ? "bg-gray-800 text-gray-400" : "bg-gray-50 text-gray-600"}`}>
                        <tr>
                          <th className="px-4 py-3 font-semibold">SKU</th>
                          <th className="px-4 py-3 font-semibold">Variant / Size</th>
                          {showPerBatchColumn ? (
                            <th className="px-4 py-3 font-semibold">
                              {batchTab === 0 ? "Batch 1 (current stock)" : `Batch ${batchTab + 1}`}
                            </th>
                          ) : (
                            <>
                              <th className="px-4 py-3 font-semibold">Stock</th>
                              <th className="px-4 py-3 font-semibold">Price</th>
                              <th className="px-4 py-3 font-semibold">Expiration</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme === "dark" ? "divide-gray-700" : "divide-gray-100"}`}>
                        {(() => {
                          const rows = [];
                          const baseSku = viewingProduct.sku || "";

                          Object.entries(viewingProduct.sizes).forEach(([size, sizeData]) => {
                            const variants = sizeData && typeof sizeData === 'object' && sizeData.variants ? sizeData.variants : null;
                            const variantPrices = sizeData && typeof sizeData === 'object' && sizeData.variantPrices ? sizeData.variantPrices : null;

                            const sizeInitial =
                              size === VARIANT_ONLY_SIZE_KEY ? "VO" :
                              size === "Free Size" ? "FS" : size.substring(0, 2).toUpperCase();

                            if ((variants && Object.keys(variants).length > 0) || (variantPrices && Object.keys(variantPrices).length > 0)) {
                              const variantKeys = variants && Object.keys(variants).length > 0 ? Object.keys(variants) : (variantPrices ? Object.keys(variantPrices) : []);

                              variantKeys.forEach((variantName) => {
                                const variantData = variants?.[variantName];
                                const variantQty = typeof variantData === 'number' ? variantData : (variantData && typeof variantData === 'object' ? variantData.quantity || 0 : 0);
                                const batches = getBatchList(typeof variantData === "object" && variantData !== null ? variantData : null);
                                const b1 = batches[0] || null;
                                const b2 = batches[1] || null;

                                // Format Variant for SKU
                                const dynamicSku = generateDynamicSku(baseSku, variantName, size);

                                rows.push(
                                  <tr key={`${size}-${variantName}`} className={`transition-colors ${theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-50"}`}>
                                    <td className={`px-4 py-3 font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-900"}`}>{dynamicSku}</td>
                                    <td className={`px-4 py-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                      {size === VARIANT_ONLY_SIZE_KEY ? variantName : `${variantName} / ${size}`}
                                    </td>
                                    {showPerBatchColumn ? (
                                      <td className="px-4 py-3">
                                        {renderBatchSlotCell(batches[batchTab] ?? null, batchTab)}
                                      </td>
                                    ) : (
                                      <>
                                        <td className="px-4 py-3">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantQty === 0 ? "bg-red-100 text-red-700" :
                                            variantQty <= (viewingProduct.reorderNumber || 10) ? "bg-yellow-100 text-yellow-700" :
                                              "bg-green-100 text-green-700"
                                            }`}>
                                            {variantQty} {viewingProduct.unitOfMeasure || 'pcs'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          <div className="space-y-0.5">
                                            <div className={`text-xs font-medium ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                                              Sell: ₱{Number(variantData?.price ?? variantPrices?.[variantName] ?? sizeData?.price ?? viewingProduct.itemPrice ?? 0).toFixed(2)}
                                            </div>
                                            <div className={`text-xs ${theme === "dark" ? "text-red-400" : "text-red-500"}`}>
                                              Cost: ₱{Number(variantData?.costPrice ?? sizeData?.variantCostPrices?.[variantName] ?? sizeData?.costPrice ?? viewingProduct.costPrice ?? 0).toFixed(2)}
                                            </div>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3">
                                          {renderAggregateExpiration(batches)}
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              });
                            } else {
                              const stock = typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined ? sizeData.quantity : (typeof sizeData === "number" ? sizeData : 0);
                              const batches = getBatchList(typeof sizeData === "object" && sizeData !== null ? sizeData : null);
                              const dynamicSku = generateDynamicSku(baseSku, null, size);

                              rows.push(
                                <tr key={size} className={`transition-colors ${theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-50"}`}>
                                  <td className={`px-4 py-3 font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-900"}`}>{dynamicSku}</td>
                                  <td className={`px-4 py-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                    {size}
                                  </td>
                                  {showPerBatchColumn ? (
                                    <td className="px-4 py-3">
                                      {renderBatchSlotCell(batches[batchTab] ?? null, batchTab)}
                                    </td>
                                  ) : (
                                    <>
                                      <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stock === 0 ? "bg-red-100 text-red-700" :
                                          stock <= (viewingProduct.reorderNumber || 10) ? "bg-yellow-100 text-yellow-700" :
                                            "bg-green-100 text-green-700"
                                          }`}>
                                          {stock} {viewingProduct.unitOfMeasure || 'pcs'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="space-y-0.5">
                                          <div className={`text-xs font-medium ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                                            Sell: ₱{Number(typeof sizeData === "object" && sizeData !== null ? (sizeData.price ?? viewingProduct.itemPrice ?? 0) : (viewingProduct.itemPrice ?? 0)).toFixed(2)}
                                          </div>
                                          <div className={`text-xs ${theme === "dark" ? "text-red-400" : "text-red-500"}`}>
                                            Cost: ₱{Number(typeof sizeData === "object" && sizeData !== null ? (sizeData.costPrice ?? viewingProduct.costPrice ?? 0) : (viewingProduct.costPrice ?? 0)).toFixed(2)}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        {renderAggregateExpiration(batches)}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            }
                          });

                          return rows;
                        })()}
                      </tbody>
                    </table>

                    <div className={`px-4 py-3 border-t text-right flex justify-end items-center gap-2 ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                      <span className={`text-xs uppercase tracking-wider font-semibold ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>{tableFooterLabel}</span>
                      <span className={`text-sm font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{tableFooterTotal}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${theme === "dark" ? "bg-[#1E1B18] border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{viewingProduct.sku || "N/A"}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${totalStock === 0 ? "bg-red-100 text-red-700" :
                      totalStock <= (viewingProduct.reorderNumber || 10) ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                      {totalStock} {viewingProduct.unitOfMeasure || "pcs"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProductModal;