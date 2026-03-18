import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { generateDynamicSku } from "../../utils/skuUtils";

const ViewProductModal = ({
  showViewModal,
  setShowViewModal,
  viewingProduct,
  formatDate
}) => {
  const { theme } = useTheme();
  const [showBatchView, setShowBatchView] = useState(false);

  const toNum = (v) => {
    const n = typeof v === "number" ? v : parseInt(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getBatchList = (data) => {
    if (!data || typeof data !== "object") return [];
    return Array.isArray(data.batches) ? data.batches : [];
  };

  const hasBatch2 = useMemo(() => {
    if (!viewingProduct) return false;
    const sizes = viewingProduct.sizes;
    if (!sizes || typeof sizes !== "object") return false;
    return Object.values(sizes).some((sizeData) => {
      if (sizeData && typeof sizeData === "object") {
        if (Array.isArray(sizeData.batches) && sizeData.batches.length > 1) return true;
        if (sizeData.variants && typeof sizeData.variants === "object") {
          return Object.values(sizeData.variants).some((variantData) => {
            if (variantData && typeof variantData === "object") {
              return Array.isArray(variantData.batches) && variantData.batches.length > 1;
            }
            return false;
          });
        }
      }
      return false;
    });
  }, [viewingProduct]);

  // If the user opens a different product, reset back to normal view
  // (prevents batch view “sticking” across products)
  useEffect(() => {
    setShowBatchView(false);
  }, [viewingProduct?._id]);

  if (!showViewModal || !viewingProduct) return null;


  const totalStock =
    viewingProduct.sizes &&
      typeof viewingProduct.sizes === "object" &&
      Object.keys(viewingProduct.sizes).length > 0 ?
      Object.values(viewingProduct.sizes).reduce((sum, sizeData) => {
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

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm bg-opacity-30"
      onClick={() => setShowViewModal(false)}>

      <div
        className={`rounded-2xl w-full max-w-5xl max-h-[90vh] relative overflow-hidden flex flex-col ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)"
        }}
        onClick={(e) => e.stopPropagation()}>

        { }
        <div
          className={`flex justify-between items-center px-6 py-4 border-b flex-shrink-0 ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>

          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${theme === "dark" ? "bg-[#AD7F65]" : "bg-[#AD7F65]"}`}>

              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

              </svg>
            </div>
            <h2
              className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

              Product Details
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {hasBatch2 && (
              <button
                type="button"
                onClick={() => setShowBatchView((v) => !v)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.98] ${showBatchView
                  ? "bg-[#AD7F65] text-white border-[#AD7F65] shadow-md"
                  : theme === "dark"
                    ? "bg-[#2A2724] text-gray-200 border-gray-700 hover:border-[#AD7F65] hover:text-white"
                    : "bg-white text-gray-700 border-gray-200 hover:border-[#AD7F65] hover:text-[#76462B]"
                  }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-md transition-transform duration-200 ${showBatchView ? "bg-white/15 rotate-180" : theme === "dark" ? "bg-white/5" : "bg-gray-100"}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10" />
                  </svg>
                </span>
                {showBatchView ? "Hide batches" : "Show batches"}
              </button>
            )}
            <button
              onClick={() => setShowViewModal(false)}
              className={`text-2xl ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}>
              ×
            </button>
          </div>
        </div>

        { }
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-6">
            { }
            <div
              className={`flex items-center justify-center rounded-xl p-6 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}>

              {viewingProduct.itemImage &&
                viewingProduct.itemImage.trim() !== "" ?
                <img
                  src={viewingProduct.itemImage}
                  alt={viewingProduct.itemName}
                  className="max-w-full max-h-[400px] object-contain rounded-lg" /> :


                <div className="text-center text-gray-400">
                  <svg
                    className="w-24 h-24 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />

                  </svg>
                  <p className="text-sm">No Image Available</p>
                </div>
              }
            </div>

            { }
            <div className="space-y-4">
              { }
              <div>
                <h3
                  className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                  Product Name
                </h3>
                <p
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                  {viewingProduct.itemName}
                </p>
              </div>

              { }
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                    Category
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>

                    {viewingProduct.category} {viewingProduct.subCategory ? `> ${viewingProduct.subCategory}` : ""}
                  </p>
                </div>
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                    Selling Price
                  </h3>
                  <p
                    className={`text-sm font-semibold ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>

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
                        return minP !== maxP
                          ? `₱${minP.toFixed(2)} - ₱${maxP.toFixed(2)}`
                          : `₱${minP.toFixed(2)}`;
                      }
                      return `₱${viewingProduct.itemPrice?.toFixed(2) || "0.00"}`;
                    })()}
                  </p>
                </div>
              </div>

              { }
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                    SKU/Item Code
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>

                    {viewingProduct.sku}
                  </p>
                </div>
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                    Cost Price
                  </h3>
                  <p
                    className={`text-sm font-semibold ${theme === "dark" ? "text-red-400" : "text-red-600"}`}>

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
                        return minC !== maxC
                          ? `₱${minC.toFixed(2)} - ₱${maxC.toFixed(2)}`
                          : `₱${minC.toFixed(2)}`;
                      }
                      return `₱${viewingProduct.costPrice?.toFixed(2) || "0.00"}`;
                    })()}
                  </p>
                </div>
              </div>

              { }
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                    Variant
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>

                    {viewingProduct.variant || "N/A"}
                  </p>
                </div>
                <div>
                  <h3
                    className={`text-xs font-semibold mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                    Brand Partner
                  </h3>
                  <p
                    className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>

                    {viewingProduct.brandName || "N/A"}
                  </p>
                </div>
              </div>

              { }
              <div>
                <h3
                  className={`text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>


                  Stock
                </h3>
                {viewingProduct.sizes &&
                  typeof viewingProduct.sizes === "object" &&
                  Object.keys(viewingProduct.sizes).length > 0 ?
                  <div className={`overflow-x-auto rounded-xl border ${theme === "dark" ? "border-gray-700 bg-[#2A2724]" : "border-gray-200 bg-white"}`}>
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className={`text-xs uppercase bg-opacity-50 ${theme === "dark" ? "bg-gray-800 text-gray-400" : "bg-gray-50 text-gray-600"}`}>
                        <tr>
                          <th className="px-4 py-3 font-semibold">SKU</th>
                          <th className="px-4 py-3 font-semibold">Variant / Size</th>
                          {showBatchView ? (
                            <>
                              <th className="px-4 py-3 font-semibold">Batch 1</th>
                              <th className="px-4 py-3 font-semibold">Batch 2</th>
                            </>
                          ) : (
                            <>
                              <th className="px-4 py-3 font-semibold">Stock</th>
                              <th className="px-4 py-3 font-semibold">Price</th>
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

                            // Format Size for SKU
                            const sizeInitial = size === "Free Size" ? "FS" : size.substring(0, 2).toUpperCase();

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
                                      {variantName} / {size}
                                    </td>
                                    {showBatchView ? (
                                      <>
                                        <td className="px-4 py-3">
                                          {b1 ? (
                                            <div className="space-y-0.5">
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${toNum(b1.qty) === 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                                {toNum(b1.qty)} {viewingProduct.unitOfMeasure || 'pcs'}
                                              </span>
                                              <div className={`text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                                Sell: ₱{(b1.price ?? 0).toFixed ? b1.price.toFixed(2) : Number(b1.price || 0).toFixed(2)} · Buy: ₱{(b1.costPrice ?? 0).toFixed ? b1.costPrice.toFixed(2) : Number(b1.costPrice || 0).toFixed(2)}
                                                {(b1.batchCode || b1.expirationDate) && (
                                                  <span className="ml-2">
                                                    {b1.batchCode ? `· Lot: ${b1.batchCode}` : ""}
                                                    {b1.expirationDate ? ` · Exp: ${String(b1.expirationDate).slice(0, 10)}` : ""}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {b2 ? (
                                            <div className="space-y-0.5">
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${toNum(b2.qty) === 0 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                                {toNum(b2.qty)} {viewingProduct.unitOfMeasure || 'pcs'}
                                              </span>
                                              <div className={`text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                                Sell: ₱{(b2.price ?? 0).toFixed ? b2.price.toFixed(2) : Number(b2.price || 0).toFixed(2)} · Buy: ₱{(b2.costPrice ?? 0).toFixed ? b2.costPrice.toFixed(2) : Number(b2.costPrice || 0).toFixed(2)}
                                                {(b2.batchCode || b2.expirationDate) && (
                                                  <span className="ml-2">
                                                    {b2.batchCode ? `· Lot: ${b2.batchCode}` : ""}
                                                    {b2.expirationDate ? ` · Exp: ${String(b2.expirationDate).slice(0, 10)}` : ""}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>
                                          )}
                                        </td>
                                      </>
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
                                      </>
                                    )}
                                  </tr>
                                );
                              });
                            } else {
                              const stock = typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined ? sizeData.quantity : (typeof sizeData === "number" ? sizeData : 0);
                              const batches = getBatchList(typeof sizeData === "object" && sizeData !== null ? sizeData : null);
                              const b1 = batches[0] || null;
                              const b2 = batches[1] || null;
                              const dynamicSku = generateDynamicSku(baseSku, null, size);

                              rows.push(
                                <tr key={size} className={`transition-colors ${theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-50"}`}>
                                  <td className={`px-4 py-3 font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-900"}`}>{dynamicSku}</td>
                                  <td className={`px-4 py-3 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                    {size}
                                  </td>
                                  {showBatchView ? (
                                    <>
                                      <td className="px-4 py-3">
                                        {b1 ? (
                                          <div className="space-y-0.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${toNum(b1.qty) === 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                                              {toNum(b1.qty)} {viewingProduct.unitOfMeasure || 'pcs'}
                                            </span>
                                            <div className={`text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                              Sell: ₱{(b1.price ?? 0).toFixed ? b1.price.toFixed(2) : Number(b1.price || 0).toFixed(2)} · Buy: ₱{(b1.costPrice ?? 0).toFixed ? b1.costPrice.toFixed(2) : Number(b1.costPrice || 0).toFixed(2)}
                                              {(b1.batchCode || b1.expirationDate) && (
                                                <span className="ml-2">
                                                  {b1.batchCode ? `· Lot: ${b1.batchCode}` : ""}
                                                  {b1.expirationDate ? ` · Exp: ${String(b1.expirationDate).slice(0, 10)}` : ""}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        {b2 ? (
                                          <div className="space-y-0.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${toNum(b2.qty) === 0 ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                                              {toNum(b2.qty)} {viewingProduct.unitOfMeasure || 'pcs'}
                                            </span>
                                            <div className={`text-[11px] ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                              Sell: ₱{(b2.price ?? 0).toFixed ? b2.price.toFixed(2) : Number(b2.price || 0).toFixed(2)} · Buy: ₱{(b2.costPrice ?? 0).toFixed ? b2.costPrice.toFixed(2) : Number(b2.costPrice || 0).toFixed(2)}
                                              {(b2.batchCode || b2.expirationDate) && (
                                                <span className="ml-2">
                                                  {b2.batchCode ? `· Lot: ${b2.batchCode}` : ""}
                                                  {b2.expirationDate ? ` · Exp: ${String(b2.expirationDate).slice(0, 10)}` : ""}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>—</span>
                                        )}
                                      </td>
                                    </>
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
                      <span className={`text-xs uppercase tracking-wider font-semibold ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Total Options Stock:</span>
                      <span className={`text-sm font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{totalStock}</span>
                    </div>
                  </div> :

                  <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${theme === "dark" ? "bg-[#2A2724] border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{viewingProduct.sku || "N/A"}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${totalStock === 0 ? "bg-red-100 text-red-700" :
                      totalStock <= (viewingProduct.reorderNumber || 10) ? "bg-yellow-100 text-yellow-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                      {totalStock} {viewingProduct.unitOfMeasure || 'pcs'}
                    </span>
                  </span>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProductModal;