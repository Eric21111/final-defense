import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const StockInModal = ({ isOpen, onClose, product, onConfirm, loading }) => {
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [variantQuantities, setVariantQuantities] = useState({});
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("Restock");
  const [otherReason, setOtherReason] = useState("");
  const [newVariantInputs, setNewVariantInputs] = useState({});
  const [addedVariants, setAddedVariants] = useState([]);
  const [newVariantPrices, setNewVariantPrices] = useState({});
  const [showNewSizes, setShowNewSizes] = useState(false);
  const [customNewSizeInput, setCustomNewSizeInput] = useState("");
  const [addedNewSizes, setAddedNewSizes] = useState([]);
  const [newSizePrices, setNewSizePrices] = useState({});
  const { theme } = useTheme();

  const reasons = ["Restock", "Returned Item", "Exchange", "Other"];


  const hasSizes =
    product.sizes &&
    typeof product.sizes === "object" &&
    Object.keys(product.sizes).length > 0;


  const getSizeQuantity = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.quantity !== undefined) {
      return sizeData.quantity;
    }
    return typeof sizeData === "number" ? sizeData : 0;
  };


  const getSizeVariants = (size) => {
    if (
      hasSizes &&
      product.sizes[size] &&
      typeof product.sizes[size] === "object" &&
      product.sizes[size].variants) {
      return product.sizes[size].variants;
    }
    return null;
  };


  const getAllVariants = () => {
    const variantSet = new Set();
    if (hasSizes) {
      Object.values(product.sizes).forEach((sizeData) => {
        if (typeof sizeData === "object" && sizeData?.variants) {
          Object.keys(sizeData.variants).forEach((v) => variantSet.add(v));
        }
      });
    }

    addedVariants.forEach((v) => variantSet.add(v));
    return Array.from(variantSet);
  };

  const allVariants = getAllVariants();
  const hasVariants = allVariants.length > 0;

  const existingSizes = hasSizes ? Object.keys(product.sizes) : [];
  const availableSizes = [...existingSizes, ...addedNewSizes];

  // Build list of sizes that are NOT already on the product for the "New sizes?" picker
  const allPossibleSizes = (() => {
    const category = product.category || "";
    let sizes = [];
    if (["Tops", "Bottoms", "Dresses"].includes(category)) {
      sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"];
    } else if (category === "Shoes") {
      sizes = ["5", "6", "7", "8", "9", "10", "11", "12"];
    } else if (["Accessories", "Head Wear", "Makeup"].includes(category)) {
      sizes = ["Free Size"];
    } else if (category === "Foods") {
      const subtype = product.foodSubtype || "";
      if (["Beverages", "Drinks"].includes(subtype)) {
        sizes = ["Small", "Medium", "Large", "Family Size", "Free Size"];
      } else {
        sizes = ["Small", "Medium", "Large", "Free Size"];
      }
    } else {
      sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Small", "Medium", "Large", "Free Size"];
    }
    return sizes.filter(s => !existingSizes.includes(s) && !addedNewSizes.includes(s));
  })();

  useEffect(() => {
    if (isOpen && product) {
      setSelectedSizes([]);
      setSizeQuantities({});
      setVariantQuantities({});
      setQuantity("");
      setReason("Restock");
      setOtherReason("");
      setNewVariantInputs({});
      setAddedVariants([]);
      setNewVariantPrices({});
      setShowNewSizes(false);
      setCustomNewSizeInput("");
      setAddedNewSizes([]);
      setNewSizePrices({});
    }

  }, [isOpen, product?._id]);

  if (!isOpen || !product) return null;

  const handleClose = () => {
    setSelectedSizes([]);
    setSizeQuantities({});
    setVariantQuantities({});
    setQuantity("");
    setReason("Restock");
    setOtherReason("");
    setNewVariantInputs({});
    setAddedVariants([]);
    setNewVariantPrices({});
    setShowNewSizes(false);
    setCustomNewSizeInput("");
    setAddedNewSizes([]);
    setNewSizePrices({});
    onClose();
  };

  const handleAddNewSize = (size) => {
    if (!size || addedNewSizes.includes(size) || existingSizes.includes(size)) return;
    setAddedNewSizes(prev => [...prev, size]);
    // Initialize price with product defaults
    setNewSizePrices(prev => ({
      ...prev,
      [size]: {
        price: product.itemPrice || 0,
        costPrice: product.costPrice || 0
      }
    }));
  };

  const handleRemoveNewSize = (size) => {
    setAddedNewSizes(prev => prev.filter(s => s !== size));
    setNewSizePrices(prev => {
      const updated = { ...prev };
      delete updated[size];
      return updated;
    });
    // Also deselect it if it was selected
    if (selectedSizes.includes(size)) {
      handleSizeToggle(size);
    }
  };

  const handleNewSizePriceChange = (size, field, value) => {
    setNewSizePrices(prev => ({
      ...prev,
      [size]: {
        ...(prev[size] || { price: 0, costPrice: 0 }),
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handleSizeToggle = (size) => {
    const isSelected = selectedSizes.includes(size);
    if (isSelected) {
      setSelectedSizes((prev) => prev.filter((s) => s !== size));
      setSizeQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[size];
        return newQuantities;
      });
      setVariantQuantities((prev) => {
        const newQuantities = { ...prev };
        delete newQuantities[size];
        return newQuantities;
      });
    } else {
      setSelectedSizes((prev) => [...prev, size]);
      setSizeQuantities((prev) => ({
        ...prev,
        [size]: ""
      }));

      if (hasVariants) {
        setVariantQuantities((prev) => ({
          ...prev,
          [size]: {}
        }));
      }
    }
  };

  const handleSizeQuantityChange = (size, qty) => {
    setSizeQuantities((prev) => ({
      ...prev,
      [size]: parseInt(qty) || 0
    }));
  };

  const handleVariantQuantityChange = (size, variant, qty) => {
    setVariantQuantities((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: parseInt(qty) || 0
      }
    }));
  };


  const getVariantCurrentQty = (size, variant) => {
    const variants = getSizeVariants(size);
    if (variants && variants[variant] !== undefined) {

      if (typeof variants[variant] === "number") {
        return variants[variant];
      }
      return variants[variant].quantity || 0;
    }
    return 0;
  };


  const handleNewVariantInputChange = (size, value) => {
    setNewVariantInputs((prev) => ({
      ...prev,
      [size]: value
    }));
  };


  const handleAddNewVariant = (size) => {
    const variantName = (newVariantInputs[size] || "").trim();
    if (!variantName) {
      alert("Please enter a variant name");
      return;
    }

    if (allVariants.includes(variantName)) {
      alert("This variant already exists");
      return;
    }

    setAddedVariants((prev) => [...prev, variantName]);

    setNewVariantPrices((prev) => ({
      ...prev,
      [variantName]: {
        price: product.itemPrice || 0,
        costPrice: product.costPrice || 0
      }
    }));

    setNewVariantInputs((prev) => ({
      ...prev,
      [size]: ""
    }));
  };


  const handleNewVariantPriceChange = (variantName, field, value) => {
    setNewVariantPrices((prev) => ({
      ...prev,
      [variantName]: {
        ...(prev[variantName] || { price: 0, costPrice: 0 }),
        [field]: parseFloat(value) || 0
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();


    if (reason === "Other" && !otherReason.trim()) {
      alert("Please specify the reason");
      return;
    }

    const finalReason =
      reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    if (!hasSizes) {

      const qty = parseInt(quantity) || 0;
      if (qty <= 0) {
        alert("Please enter a valid quantity");
        return;
      }
      onConfirm({
        quantity: qty,
        noSizes: true,
        reason: finalReason
      });
      return;
    }


    if (selectedSizes.length === 0) {
      alert("Please select at least one size");
      return;
    }


    if (hasVariants) {
      const hasValidVariantQuantities = selectedSizes.some((size) => {
        const sizeVariantQtys = variantQuantities[size] || {};
        return Object.values(sizeVariantQtys).some((qty) => qty > 0);
      });

      if (!hasValidVariantQuantities) {
        alert("Please enter quantities for at least one variant");
        return;
      }

      onConfirm({
        sizes: sizeQuantities,
        variantQuantities: variantQuantities,
        selectedSizes: selectedSizes,
        reason: finalReason,
        hasVariants: true,
        newVariantPrices: addedVariants.length > 0 ? newVariantPrices : null,
        newSizePrices: addedNewSizes.length > 0 ? newSizePrices : null
      });
      return;
    }


    const hasValidQuantities = selectedSizes.some((size) => {
      const qty = sizeQuantities[size] || 0;
      return qty > 0;
    });

    if (!hasValidQuantities) {
      alert("Please enter quantities for at least one selected size");
      return;
    }

    onConfirm({
      sizes: sizeQuantities,
      selectedSizes: selectedSizes,
      reason: finalReason,
      newSizePrices: addedNewSizes.length > 0 ? newSizePrices : null
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm pointer-events-none">
      <div
        className={`rounded-2xl w-full max-w-5xl relative pointer-events-auto overflow-hidden ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)"
        }}>

        <div className="flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative w-6 h-6 flex items-center justify-center">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />

              </svg>
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <span className="text-white text-[8px] font-bold leading-none">
                  +
                </span>
              </span>
            </div>
            <h2
              className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

              Stock In
            </h2>
          </div>
          <button
            onClick={handleClose}
            className={`text-2xl font-light ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}>

            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex" style={{ maxHeight: "calc(100vh - 150px)" }}>
            <div
              className={`w-1/2 p-6 flex items-center justify-center ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}
              style={{ minHeight: "500px", maxHeight: "calc(100vh - 150px)" }}>

              {product.itemImage && product.itemImage.trim() !== "" ?
                <img
                  src={product.itemImage}
                  alt={product.itemName}
                  className="max-w-full max-h-full object-contain rounded-lg" /> :


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

            <div className="w-1/2 p-6 flex flex-col justify-between overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
              <div className="space-y-6">
                <div>
                  <h3
                    className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                    {product.itemName}
                    {product.size && !product.sizes && ` (${product.size})`}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                      SKU/Item Code
                    </label>
                    <p
                      className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                      {product.sku || "-"}
                    </p>
                  </div>
                  <div>
                    <label
                      className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                      Brand Partner{" "}
                      <span className="text-gray-400">(optional)</span>
                    </label>
                    <p
                      className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                      {product.supplierName || "-"}
                    </p>
                  </div>
                </div>

                {hasSizes ?
                  <div>
                    <label
                      className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                      Select sizes to add stock to
                    </label>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {availableSizes.map((size) => {
                        const isNew = addedNewSizes.includes(size);
                        const currentQty =
                          hasSizes && product.sizes[size] ?
                            getSizeQuantity(product.sizes[size]) :
                            0;
                        return (
                          <label
                            key={size}
                            className="flex items-center gap-2 cursor-pointer">

                            <input
                              type="checkbox"
                              checked={selectedSizes.includes(size)}
                              onChange={() => handleSizeToggle(size)}
                              className="w-4 h-4 border-gray-300 rounded focus:ring-[#AD7F65] cursor-pointer"
                              style={{
                                accentColor: "#AD7F65"
                              }} />

                            <span
                              className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>

                              {size}{" "}
                              {isNew ?
                                <span className="text-xs text-green-500">(New)</span> :
                                <span className="text-xs text-gray-500">
                                  ({currentQty})
                                </span>
                              }
                            </span>
                            {isNew &&
                              <button
                                type="button"
                                title="Remove new size"
                                className="text-red-500 hover:text-red-700 text-xs"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleRemoveNewSize(size);
                                }}>
                                ×
                              </button>
                            }
                          </label>);

                      })}
                    </div>

                    {/* New Sizes section */}
                    <div className="mb-3">
                      <label className="flex items-center gap-2 cursor-pointer mb-2">
                        <input
                          type="checkbox"
                          checked={showNewSizes}
                          onChange={(e) => {
                            setShowNewSizes(e.target.checked);
                            if (!e.target.checked) {
                              setCustomNewSizeInput("");
                            }
                          }}
                          className="w-4 h-4 border-gray-300 rounded focus:ring-[#AD7F65] cursor-pointer"
                          style={{ accentColor: "#AD7F65" }} />
                        <span className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}>
                          New sizes? Add sizes not listed
                        </span>
                      </label>

                      {showNewSizes &&
                        <div className={`p-3 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}>
                          {allPossibleSizes.length > 0 &&
                            <>
                              <label className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                Select new sizes to add
                              </label>
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                {allPossibleSizes.map((size) =>
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => handleAddNewSize(size)}
                                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${theme === "dark" ? "border-gray-600 text-gray-200 hover:bg-[#AD7F65] hover:text-white hover:border-[#AD7F65]" : "border-gray-300 text-gray-700 hover:bg-[#AD7F65] hover:text-white hover:border-[#AD7F65]"}`}>
                                    + {size}
                                  </button>
                                )}
                              </div>
                            </>
                          }
                          <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            Or type a custom size
                          </label>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={customNewSizeInput}
                              onChange={(e) => setCustomNewSizeInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const trimmed = customNewSizeInput.trim();
                                  if (trimmed) {
                                    handleAddNewSize(trimmed);
                                    setCustomNewSizeInput("");
                                  }
                                }
                              }}
                              placeholder="Type size and press Enter or Add"
                              className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = customNewSizeInput.trim();
                                if (trimmed) {
                                  handleAddNewSize(trimmed);
                                  setCustomNewSizeInput("");
                                }
                              }}
                              disabled={!customNewSizeInput.trim()}
                              className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${!customNewSizeInput.trim() ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#AD7F65] text-white hover:bg-[#8B6553]"}`}>
                              Add
                            </button>
                          </div>
                        </div>
                      }
                    </div>

                    <div
                      className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}>

                      <label
                        className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                        {hasVariants ? "Quantity per Variant:" : "Quantity per Size:"}
                      </label>
                      <div className={hasVariants ? "space-y-4" : "grid grid-cols-2 gap-3"}>
                        {selectedSizes.length > 0 ?
                          selectedSizes.map((size) => {
                            const currentQty =
                              hasSizes && product.sizes[size] ?
                                getSizeQuantity(product.sizes[size]) :
                                0;
                            const sizeVariants = getSizeVariants(size);


                            if (hasVariants) {
                              const isNewSize = addedNewSizes.includes(size);
                              return (
                                <div key={size} className={`p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}>
                                  <label
                                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>

                                    {size}{" "}
                                    {isNewSize ?
                                      <span className="text-green-500 font-normal">(New)</span> :
                                      <span className="text-gray-500 font-normal">
                                        (Current Total: {currentQty})
                                      </span>
                                    }
                                  </label>

                                  {/* Price inputs for new sizes */}
                                  {isNewSize &&
                                    <div className={`grid grid-cols-2 gap-2 mb-3 p-2 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-100"}`}>
                                      <div>
                                        <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                          Selling Price
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={newSizePrices[size]?.price || ""}
                                          onChange={(e) => handleNewSizePriceChange(size, "price", e.target.value)}
                                          placeholder="0.00"
                                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                                      </div>
                                      <div>
                                        <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                          Cost Price
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={newSizePrices[size]?.costPrice || ""}
                                          onChange={(e) => handleNewSizePriceChange(size, "costPrice", e.target.value)}
                                          placeholder="0.00"
                                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                                      </div>
                                    </div>
                                  }
                                  <div className="grid grid-cols-2 gap-2">
                                    {allVariants.map((variant) => {
                                      const currentVariantQty = getVariantCurrentQty(size, variant);
                                      const isNewVariant = addedVariants.includes(variant);
                                      return (
                                        <div key={`${size}-${variant}`}>
                                          <label
                                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                                            {variant}{" "}
                                            {isNewVariant ?
                                              <span className="text-green-500">(New)</span> :

                                              <span className="text-gray-500">
                                                ({currentVariantQty})
                                              </span>
                                            }
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={variantQuantities[size]?.[variant] || ""}
                                            onChange={(e) =>
                                              handleVariantQuantityChange(
                                                size,
                                                variant,
                                                e.target.value
                                              )
                                            }
                                            placeholder="0"
                                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`} />

                                        </div>);

                                    })}
                                  </div>

                                  { }
                                  <div className={`mt-3 pt-3 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                                    <label
                                      className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                                      Add New Variant
                                    </label>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={newVariantInputs[size] || ""}
                                        onChange={(e) =>
                                          handleNewVariantInputChange(size, e.target.value)
                                        }
                                        placeholder="e.g. Red, Green..."
                                        className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddNewVariant(size);
                                          }
                                        }} />

                                      <button
                                        type="button"
                                        onClick={() => handleAddNewVariant(size)}
                                        className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">

                                        +
                                      </button>
                                    </div>
                                  </div>

                                  { }
                                  {selectedSizes[0] === size && addedVariants.length > 0 &&
                                    <div className={`mt-3 pt-3 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                                      <label
                                        className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                                        New Variant Prices
                                      </label>
                                      <div className="space-y-3">
                                        {addedVariants.map((variant) =>
                                          <div key={`price-${variant}`} className={`p-2 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-100"}`}>
                                            <p className={`text-sm font-medium mb-2 ${theme === "dark" ? "text-green-400" : "text-green-600"}`}>
                                              {variant} <span className="text-xs font-normal">(New)</span>
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                              <div>
                                                <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                                  Selling Price
                                                </label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={newVariantPrices[variant]?.price || ""}
                                                  onChange={(e) => handleNewVariantPriceChange(variant, "price", e.target.value)}
                                                  placeholder="0.00"
                                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

                                              </div>
                                              <div>
                                                <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                                  Cost Price
                                                </label>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  step="0.01"
                                                  value={newVariantPrices[variant]?.costPrice || ""}
                                                  onChange={(e) => handleNewVariantPriceChange(variant, "costPrice", e.target.value)}
                                                  placeholder="0.00"
                                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  }

                                  {Object.keys(variantQuantities[size] || {}).length > 0 &&
                                    <p className={`text-xs mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                                      Adding: {Object.values(variantQuantities[size] || {}).reduce((sum, q) => sum + (parseInt(q) || 0), 0)} units
                                    </p>
                                  }
                                </div>);

                            }


                            const isNewSize = addedNewSizes.includes(size);
                            return (
                              <div key={size}>
                                <label
                                  className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                                  {size}{" "}
                                  {isNewSize ?
                                    <span className="text-green-500">(New)</span> :
                                    <span className="text-gray-500">
                                      (Current: {currentQty})
                                    </span>
                                  }
                                </label>

                                {/* Price inputs for new sizes without variants */}
                                {isNewSize &&
                                  <div className={`grid grid-cols-2 gap-2 mb-2 p-2 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-100"}`}>
                                    <div>
                                      <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                        Selling Price
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newSizePrices[size]?.price || ""}
                                        onChange={(e) => handleNewSizePriceChange(size, "price", e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                                    </div>
                                    <div>
                                      <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                        Cost Price
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newSizePrices[size]?.costPrice || ""}
                                        onChange={(e) => handleNewSizePriceChange(size, "costPrice", e.target.value)}
                                        placeholder="0.00"
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                                    </div>
                                  </div>
                                }
                                <input
                                  type="number"
                                  min="0"
                                  value={sizeQuantities[size] || ""}
                                  onChange={(e) =>
                                    handleSizeQuantityChange(
                                      size,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Enter quantity"
                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />


                                { }
                                <div className={`mt-2`}>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={newVariantInputs[size] || ""}
                                      onChange={(e) =>
                                        handleNewVariantInputChange(size, e.target.value)
                                      }
                                      placeholder="Add variant (e.g. Blue)"
                                      className={`flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddNewVariant(size);
                                        }
                                      }} />

                                    <button
                                      type="button"
                                      onClick={() => handleAddNewVariant(size)}
                                      className="px-2 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">

                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>);

                          }) :

                          <div className="col-span-2 text-xs text-gray-400 italic">
                            Select sizes above to add quantities
                          </div>
                        }
                      </div>
                    </div>
                  </div> :

                  <div>
                    <label
                      className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                      Quantity to Add
                    </label>
                    <p
                      className={`text-xs mb-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>

                      Current Stock: {product.currentStock || 0}
                    </p>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity to add"
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

                  </div>
                }

                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                    Reason
                  </label>
                  <div className="relative">
                    <select
                      value={reason}
                      onChange={(e) => {
                        setReason(e.target.value);
                        if (e.target.value !== "Other") {
                          setOtherReason("");
                        }
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}>

                      {reasons.map((r) =>
                        <option key={r} value={r}>
                          {r}
                        </option>
                      )}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7" />

                      </svg>
                    </div>
                  </div>
                  {reason === "Other" &&
                    <input
                      type="text"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Please specify the reason"
                      className={`w-full mt-2 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

                  }
                </div>
              </div>

              <div
                className={`flex justify-end gap-3 mt-8 pt-6 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>

                <button
                  type="button"
                  onClick={handleClose}
                  className={`px-6 py-3 border rounded-lg font-medium transition-colors ${theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>

                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  style={{
                    background:
                      "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                  }}>

                  {loading ? "Adding..." : "Add Stocks"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>);

};

export default StockInModal;