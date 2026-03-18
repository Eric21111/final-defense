import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import AddBrandModal from "./AddBrandModal";
import AddCategoryModal from "./AddCategoryModal";


const COMMON_COLORS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Navy Blue",
  "Green",
  "Yellow",
  "Orange",
  "Pink",
  "Purple",
  "Brown",
  "Gray",
  "Beige",
  "Cream",
  "Maroon",
  "Olive",
  "Teal",
  "Coral",
  "Lavender",
  "Mint",
  "Gold",
  "Silver",
  "Rose Gold",
  "Custom"];


const AddProductModal = ({
  showAddModal,
  setShowAddModal,
  editingProduct,
  newProduct,
  setNewProduct,
  handleAddProduct,
  handleInputChange,
  handleSizeToggle,
  handleSizeQuantityChange,
  handleSizePriceChange,
  resetProductForm,
  loading,
  categories = [],
  brandPartners = [],
  onCategoryAdd,
  onBrandAdd
}) => {
  const { theme } = useTheme();

  const categoryStructure = {
    "Apparel - Men": ["Tops", "Bottoms", "Outerwear"],
    "Apparel - Women": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Apparel - Kids": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Apparel - Unisex": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Foods": ["Beverages", "Snacks", "Meals", "Desserts", "Ingredients", "Other"],
    "Makeup": ["Face", "Eyes", "Lips", "Nails", "SkinCare", "Others"],
    "Accessories": ["Jewelry", "Bags", "Head Wear", "Glasses/Sunglasses", "Others"],
    "Shoes": ["Sneakers", "Boots", "Sandals", "Others"],
    "Others": ["Others"]
  };

  const parentCategories = Object.keys(categoryStructure);
  const allKnownDefaultSubs = new Set(Object.values(categoryStructure).flat());
  const legacyParentCategories = ["Apparel", "Shoes", "Foods", "Accessories", "Makeup", "Head Wear"];

  const customSubCategories = categories
    .map((c) => c.name)
    .filter(
      (name) =>
        name !== "All" &&
        name !== "Others" &&
        !parentCategories.includes(name) &&
        !allKnownDefaultSubs.has(name) &&
        !legacyParentCategories.includes(name)
    );

  const getSubcategories = (parentCat) => {
    const defaultSubs = categoryStructure[parentCat] || [];
    const subs = [...defaultSubs, ...customSubCategories];

    if (newProduct.subCategory && newProduct.subCategory !== "__add_new__" && !subs.includes(newProduct.subCategory)) {
      if (newProduct.category === parentCat) {
        subs.push(newProduct.subCategory);
      }
    }
    return [...new Set(subs)];
  };

  const [showDraftNotice, setShowDraftNotice] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showCustomSizeInput, setShowCustomSizeInput] = useState(false);
  const [customSizeValue, setCustomSizeValue] = useState("");
  const [productImages, setProductImages] = useState([]);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [customSizes, setCustomSizes] = useState([]);
  const [multipleVariantsPerSize, setMultipleVariantsPerSize] = useState({});
  const [sizeMultiVariants, setSizeMultiVariants] = useState({});
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [customColorInput, setCustomColorInput] = useState("");

  const [variantQuantities, setVariantQuantities] = useState({});
  const [differentPricesPerVariant, setDifferentPricesPerVariant] = useState({});
  const [variantPrices, setVariantPrices] = useState({});
  const [variantCostPrices, setVariantCostPrices] = useState({});

  const [currentStep, setCurrentStep] = useState(1);
  const STEPS = [
    { id: 1, label: "Basic Info" },
    { id: 2, label: "Variants & Sizes" },
    { id: 3, label: "Stock" },
    { id: 4, label: "Review" },
  ];

  const getVariantsForSize = (size) => {
    if (!size) return [];

    if (newProduct.differentVariantsPerSize) {
      if (multipleVariantsPerSize[size]) {
        return (sizeMultiVariants[size] || []).filter(Boolean);
      }
      const single = (newProduct.sizeVariants?.[size] || "").trim();
      return single ? [single] : [];
    }

    return (selectedVariants || []).filter(Boolean);
  };

  const getTotalStockFromInputs = () => {
    const sizeTotal = Object.values(newProduct.sizeQuantities || {}).reduce(
      (sum, q) => sum + (parseInt(q) || 0),
      0
    );
    const variantTotal = Object.values(newProduct.variantQuantities || {}).reduce(
      (sum, perSize) =>
        sum +
        (perSize && typeof perSize === "object" ?
          Object.values(perSize).reduce((s, q) => s + (parseInt(q) || 0), 0) :
          0),
      0
    );
    return Math.max(sizeTotal, variantTotal);
  };

  const isStepValid = (step) => {
    if (editingProduct) return true;

    switch (step) {
      case 1:
        if (!newProduct.itemName || !newProduct.itemName.trim()) return false;
        if (!newProduct.category) return false;
        if (!newProduct.subCategory || newProduct.subCategory === "__add_new__") return false;
        return true;
      case 2:
        if (!newProduct.selectedSizes || newProduct.selectedSizes.length === 0) return false;
        return true;
      case 3:

        if (newProduct.selectedSizes?.length > 0) {
          const totalStock = getTotalStockFromInputs();
          if (totalStock <= 0) return false;
        }

        if (!newProduct.differentPricesPerSize && !Object.values(differentPricesPerVariant).some(v => v)) {

          if (!newProduct.itemPrice || parseFloat(newProduct.itemPrice) <= 0) return false;
          if (!newProduct.costPrice || parseFloat(newProduct.costPrice) <= 0) return false;
        } else if (newProduct.differentPricesPerSize && selectedVariants.length === 0) {

          for (const size of newProduct.selectedSizes || []) {
            if (!newProduct.sizePrices?.[size] || parseFloat(newProduct.sizePrices[size]) <= 0) return false;
            if (!newProduct.sizeCostPrices?.[size] || parseFloat(newProduct.sizeCostPrices[size]) <= 0) return false;
          }
        }
        return true;
      default:
        return true;
    }
  };

  const [editableSizePrices, setEditableSizePrices] = useState({});


  useEffect(() => {
    if (editingProduct && editingProduct.sizes && typeof editingProduct.sizes === 'object') {
      const sizePrices = {};
      Object.entries(editingProduct.sizes).forEach(([size, sizeData]) => {
        if (typeof sizeData === 'object' && sizeData !== null) {

          if (sizeData.variants && typeof sizeData.variants === 'object') {
            sizePrices[size] = {
              hasVariants: true,
              basePrice: sizeData.price || editingProduct.itemPrice || 0,
              baseCostPrice: sizeData.costPrice || editingProduct.costPrice || 0,
              variants: {}
            };
            Object.entries(sizeData.variants).forEach(([variant, variantData]) => {
              if (typeof variantData === 'object' && variantData !== null) {
                sizePrices[size].variants[variant] = {
                  price: variantData.price || sizeData.variantPrices?.[variant] || sizeData.price || editingProduct.itemPrice || 0,
                  costPrice: variantData.costPrice || sizeData.variantCostPrices?.[variant] || sizeData.costPrice || editingProduct.costPrice || 0,
                  quantity: variantData.quantity || 0
                };
              } else {
                sizePrices[size].variants[variant] = {
                  price: sizeData.variantPrices?.[variant] || sizeData.price || editingProduct.itemPrice || 0,
                  costPrice: sizeData.variantCostPrices?.[variant] || sizeData.costPrice || editingProduct.costPrice || 0,
                  quantity: typeof variantData === 'number' ? variantData : 0
                };
              }
            });
          } else {

            sizePrices[size] = {
              hasVariants: false,
              price: sizeData.price || editingProduct.itemPrice || 0,
              costPrice: sizeData.costPrice || editingProduct.costPrice || 0,
              quantity: sizeData.quantity || 0
            };
          }
        } else if (typeof sizeData === 'number') {

          sizePrices[size] = {
            hasVariants: false,
            price: editingProduct.itemPrice || 0,
            costPrice: editingProduct.costPrice || 0,
            quantity: sizeData
          };
        }
      });
      setEditableSizePrices(sizePrices);
    } else {
      setEditableSizePrices({});
    }
  }, [editingProduct]);


  const handleEditableSizePriceChange = (size, price) => {
    setEditableSizePrices((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        price: parseFloat(price) || 0
      }
    }));
  };


  const handleEditableSizeCostPriceChange = (size, costPrice) => {
    setEditableSizePrices((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        costPrice: parseFloat(costPrice) || 0
      }
    }));
  };


  const handleEditableVariantPriceChange = (size, variant, price) => {
    setEditableSizePrices((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        variants: {
          ...prev[size]?.variants,
          [variant]: {
            ...prev[size]?.variants?.[variant],
            price: parseFloat(price) || 0
          }
        }
      }
    }));
  };


  const handleEditableVariantCostPriceChange = (size, variant, costPrice) => {
    setEditableSizePrices((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        variants: {
          ...prev[size]?.variants,
          [variant]: {
            ...prev[size]?.variants?.[variant],
            costPrice: parseFloat(costPrice) || 0
          }
        }
      }
    }));
  };


  const handleVariantPriceChange = (size, variant, price) => {
    const priceValue = parseFloat(price) || 0;
    setVariantPrices((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: priceValue
      }
    }));
  };


  const handleVariantCostPriceChange = (size, variant, price) => {
    const priceValue = parseFloat(price) || 0;
    setVariantCostPrices((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: priceValue
      }
    }));
  };



  const handleVariantToggle = (color) => {
    setSelectedVariants((prev) => {
      const newVariants = prev.includes(color) ?
        prev.filter((v) => v !== color) :
        [...prev, color];


      const variantString = newVariants.join(", ");
      setNewProduct((prevProduct) => ({ ...prevProduct, variant: variantString }));

      return newVariants;
    });
  };


  const addCustomColor = () => {
    const trimmedColor = customColorInput.trim();
    if (trimmedColor && !selectedVariants.includes(trimmedColor)) {
      const newVariants = [...selectedVariants, trimmedColor];
      setSelectedVariants(newVariants);
      const variantString = newVariants.join(", ");
      setNewProduct((prevProduct) => ({ ...prevProduct, variant: variantString }));
      setCustomColorInput("");
    }
  };


  const handleCustomColorKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomColor();
    }
  };


  const removeVariant = (color) => {
    setSelectedVariants((prev) => {
      const newVariants = prev.filter((v) => v !== color);
      const variantString = newVariants.join(", ");
      setNewProduct((prevProduct) => ({ ...prevProduct, variant: variantString }));
      return newVariants;
    });
  };


  useEffect(() => {
    if (showAddModal && !editingProduct) {
      const hasData =
        newProduct.itemName ||
        newProduct.variant ||
        newProduct.itemPrice ||
        newProduct.costPrice ||
        newProduct.currentStock ||
        newProduct.itemImage ||
        newProduct.selectedSizes && newProduct.selectedSizes.length > 0;
      setShowDraftNotice(hasData);


      if (newProduct.variant) {
        const variants = newProduct.variant.split(", ").filter((v) => v.trim());
        setSelectedVariants(variants);
      } else {
        setSelectedVariants([]);
      }

      // Initialize multi-image gallery with existing image
      if (editingProduct && editingProduct.itemImage) {
        setProductImages([editingProduct.itemImage]);
      } else {
        setProductImages([]);
      }
    } else if (!showAddModal) {

      setSelectedVariants([]);
      setShowVariantDropdown(false);
      setCustomColorInput("");
      setVariantQuantities({});
      setShowCustomSizeInput(false);
      setCustomSizeValue("");
      setCustomSizes([]);
      setCurrentStep(1);
      setProductImages([]);
      setImageUrlInput("");
    } else {
      setShowDraftNotice(false);
    }
  }, [showAddModal, editingProduct]);

  if (!showAddModal) return null;

  const partnerNames = Array.from(
    new Set(brandPartners.map((partner) => partner.brandName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const legacyBrandSelected =
    newProduct.brandName &&
    newProduct.brandName !== "Default" &&
    !partnerNames.includes(newProduct.brandName);


  const handleFormSubmit = (e) => {
    e.preventDefault();


    const completeProductData = {
      ...newProduct,

      ...(newProduct.variant === "Custom" && { variant: "Custom" }),

      ...(Object.keys(sizeMultiVariants).length > 0 && {
        sizeMultiVariants: sizeMultiVariants,
        multipleVariantsPerSize: multipleVariantsPerSize
      }),

      ...(Object.keys(variantQuantities).length > 0 && {
        variantQuantities: variantQuantities
      }),

      differentPricesPerVariant: differentPricesPerVariant,
      ...(Object.keys(variantPrices).length > 0 && { variantPrices: variantPrices }),
      ...(Object.keys(variantCostPrices).length > 0 && { variantCostPrices: variantCostPrices }),

      ...(editingProduct && Object.keys(editableSizePrices).length > 0 && {
        editableSizePrices: editableSizePrices
      })
    };


    setNewProduct(completeProductData);


    requestAnimationFrame(() => {
      handleAddProduct(e);
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-9999 p-4 backdrop-blur-sm pointer-events-none">
      <div
        className={`rounded-2xl w-full max-w-2xl relative pointer-events-auto shadow-2xl flex flex-col ${theme === "dark" ? "bg-[#2A2724] text-white" : "bg-white text-gray-900"}`}
        style={{
          height: "90vh",
          boxShadow:
            theme === "dark" ?
              "0 25px 50px -12px rgba(0, 0, 0, 0.7)" :
              "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)"
        }}>

        <div className="flex justify-between items-center px-6 py-4 pb-2">
          <h2 className="text-xl font-bold">
            {editingProduct ? "Edit Product Details" : "Add New Product"}
          </h2>
          <button
            onClick={() => {
              setShowAddModal(false);
            }}
            className={`text-2xl hover:text-gray-500 transition-colors ${theme === "dark" ? "text-gray-400" : "text-gray-400"}`}>
            ×
          </button>
        </div>

        { }
        {showDraftNotice && !editingProduct &&
          <div
            className={`mx-6 mt-2 p-3 border rounded-lg flex items-center justify-between ${theme === "dark" ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-2">
              <svg className={`w-5 h-5 ${theme === "dark" ? "text-amber-500" : "text-amber-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className={`text-sm ${theme === "dark" ? "text-amber-200" : "text-amber-800"}`}>Draft recovered from your previous session</span>
            </div>
            <button type="button" onClick={() => { resetProductForm(); setShowDraftNotice(false); }}
              className={`text-xs underline hover:opacity-80 ${theme === "dark" ? "text-amber-300" : "text-amber-700"}`}>Clear Draft</button>
          </div>
        }

        <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Horizontal stepper for Add mode */}
          {!editingProduct && (
            <div className="px-8 pt-3 pb-4 flex-shrink-0">
              <div className="flex items-center">
                {STEPS.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center" style={{ minWidth: 50 }}>
                      <div
                        onClick={() => { if (currentStep > step.id) setCurrentStep(step.id); }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200 ${currentStep > step.id
                          ? "bg-green-500 border-green-500 text-white cursor-pointer hover:shadow-md"
                          : currentStep === step.id
                            ? "bg-[#AD7F65] border-[#AD7F65] text-white shadow-md"
                            : theme === "dark"
                              ? "bg-transparent border-gray-600 text-gray-500"
                              : "bg-transparent border-gray-300 text-gray-400"
                          }`}
                      >
                        {currentStep > step.id ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : step.id}
                      </div>
                      <span className={`text-[11px] mt-1 font-semibold whitespace-nowrap ${currentStep === step.id
                        ? "text-[#AD7F65]"
                        : currentStep > step.id
                          ? "text-green-500"
                          : theme === "dark" ? "text-gray-500" : "text-gray-400"
                        }`}>
                        {step.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`flex-1 h-[2px] mx-1 mt-[-16px] rounded transition-all duration-200 ${currentStep > step.id ? "bg-green-500" : theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-8 pb-4">

            {/* ══════════ EDITING MODE: show everything at once ══════════ */}
            {editingProduct && (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold mb-3">Basic Info</h3>
                    <div className="space-y-3">
                      <div>
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                          Product Name
                        </label>
                        <input
                          type="text"
                          name="itemName"
                          value={newProduct.itemName}
                          onChange={handleInputChange}
                          required
                          placeholder="Product name"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ?
                            "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300" :
                            "bg-gray-50 border-gray-300 placeholder-gray-400"}`
                          } />

                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            Category
                          </label>
                          <select
                            name="category"
                            value={newProduct.category || ""}
                            onChange={(e) => {
                              handleInputChange(e);
                              setNewProduct(prev => ({ ...prev, subCategory: "" }));
                            }}
                            required
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`}
                          >
                            <option value="" disabled className={theme === "dark" ? "bg-[#2A2724]" : ""}>Select Category</option>
                            {parentCategories.map(cat => (
                              <option key={cat} value={cat} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{cat}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label
                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                            Brand
                          </label>
                          <select
                            name="brandName"
                            value={newProduct.brandName || "Default"}
                            onChange={(e) => {
                              if (e.target.value === "__add_new_brand__") {
                                setShowBrandModal(true);

                                return;
                              }
                              handleInputChange(e);
                            }}
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ?
                              "bg-[#1E1B18] border-gray-600 text-white" :
                              "bg-gray-50 border-gray-300"}`
                            }>

                            <option
                              value="Default"
                              className={theme === "dark" ? "bg-[#2A2724]" : ""}>

                              Default
                            </option>
                            {partnerNames.map((name) =>
                              <option
                                key={name}
                                value={name}
                                className={theme === "dark" ? "bg-[#2A2724]" : ""}>

                                {name}
                              </option>
                            )}
                            <option
                              value="__add_new_brand__"
                              className="font-semibold text-[#AD7F65]">

                              + Add Brand
                            </option>
                            {legacyBrandSelected &&
                              <option value={newProduct.brandName}>
                                {newProduct.brandName} (Inactive)
                              </option>
                            }
                          </select>
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          SubCategory
                        </label>
                        <select
                          name="subCategory"
                          value={newProduct.subCategory || ""}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              setShowCategoryModal(true);
                              return;
                            }
                            handleInputChange(e);
                            setSelectedVariants([]);
                            setCustomColorInput("");
                            setVariantQuantities({});
                            setVariantPrices({});
                            setVariantCostPrices({});
                            setDifferentPricesPerVariant({});
                          }}
                          required
                          disabled={!newProduct.category}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"} ${!newProduct.category ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <option value="" disabled className={theme === "dark" ? "bg-[#2A2724]" : ""}>Select SubCategory</option>
                          {getSubcategories(newProduct.category).map(sub => (
                            <option key={sub} value={sub} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{sub}</option>
                          ))}
                          <option value="__add_new__" className="font-semibold text-[#AD7F65]">+ Add Subcategory</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {!editingProduct && (
                    <div>
                      <h3 className="text-base font-semibold mb-3">Pricing</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            Cost Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name="costPrice"
                            value={newProduct.costPrice}
                            onChange={handleInputChange}
                            placeholder="Enter cost price"
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ?
                              "bg-[#1E1B18] border-gray-600 text-white" :
                              "bg-gray-50 border-gray-300"}`
                            } />
                        </div>
                        <div>
                          <label
                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            Selling Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            name="itemPrice"
                            value={newProduct.itemPrice}
                            onChange={handleInputChange}
                            required
                            placeholder="Enter selling price"
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ?
                              "bg-[#1E1B18] border-gray-600 text-white" :
                              "bg-gray-50 border-gray-300"}`
                            } />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-base font-semibold mb-3">
                      Display Settings
                    </h3>
                    <div className="space-y-3">
                      {(() => {


                        const hasZeroStock = () => {
                          if (editingProduct) {

                            if (
                              editingProduct.sizes &&
                              typeof editingProduct.sizes === "object" &&
                              Object.keys(editingProduct.sizes).length > 0) {

                              const allSizesZero = Object.values(
                                editingProduct.sizes
                              ).every((sizeData) => {
                                if (
                                  typeof sizeData === "object" &&
                                  sizeData !== null &&
                                  sizeData.quantity !== undefined) {
                                  return (sizeData.quantity || 0) === 0;
                                }
                                return (
                                  (typeof sizeData === "number" ?
                                    sizeData :
                                    0) === 0);

                              });
                              return allSizesZero;
                            }

                            return (editingProduct.currentStock || 0) === 0;
                          } else {

                            if (
                              newProduct.selectedSizes &&
                              newProduct.selectedSizes.length > 0 &&
                              newProduct.sizeQuantities) {

                              const allSizesZero = newProduct.selectedSizes.every(
                                (size) => {
                                  const qty =
                                    newProduct.sizeQuantities[size] || 0;
                                  return parseInt(qty) === 0;
                                }
                              );
                              return allSizesZero;
                            }

                            return parseInt(newProduct.currentStock || 0) === 0;
                          }
                        };

                        const isStockZero = hasZeroStock();
                        const isDisabled = editingProduct && isStockZero;

                        return (
                          <label
                            className={`flex items-center gap-3 ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>

                            <div className="relative">
                              <input
                                type="checkbox"
                                name="displayInTerminal"
                                checked={newProduct.displayInTerminal !== false}
                                onChange={handleInputChange}
                                disabled={isDisabled}
                                className="sr-only" />

                              <div
                                className={`w-14 h-7 rounded-full transition-colors duration-200 ${newProduct.displayInTerminal !== false ?
                                  "bg-[#AD7F65]" :
                                  "bg-gray-300"} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}>

                                <div
                                  className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${newProduct.displayInTerminal !== false ?
                                    "translate-x-7" :
                                    "translate-x-1"} mt-0.5`
                                  }>
                                </div>
                              </div>
                            </div>
                            <div>
                              <span
                                className={`text-sm font-medium ${isDisabled ? "text-gray-400 opacity-60" : theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                                Display in Terminal
                              </span>
                              <p
                                className={`text-xs ${isDisabled ? "text-gray-500 opacity-60" : theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>

                                {isDisabled ?
                                  "Add stock to enable this option" :
                                  "Show this product in POS/terminal"}
                              </p>
                            </div>
                          </label>);

                      })()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col px-8 mt-6 pb-6">
                  <div>
                    {/* Image Upload - Multiple Images */}
                    <div className="flex flex-col">
                      {/* Image thumbnails grid */}
                      {productImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {productImages.map((img, index) => (
                            <div key={index} className={`relative group rounded-lg overflow-hidden border ${index === 0 ? 'ring-2 ring-[#AD7F65]' : ''} ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`} style={{ aspectRatio: '1' }}>
                              <img src={img} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                              {index === 0 && (
                                <span className="absolute top-1 left-1 bg-[#AD7F65] text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">Main</span>
                              )}
                              <button type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductImages(prev => {
                                    const updated = prev.filter((_, i) => i !== index);
                                    setNewProduct(p => ({ ...p, itemImage: updated[0] || '' }));
                                    return updated;
                                  });
                                }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:bg-red-600"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Warning for 3+ images */}
                      {productImages.length > 3 && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium">Adding more than 3 photos may slow down the system.</span>
                        </div>
                      )}

                      {/* Upload area */}
                      <div
                        onClick={() => document.getElementById("editFileInput").click()}
                        className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 hover:bg-[#2A2724] hover:border-[#AD7F65]" : "bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-[#AD7F65]"}`}
                        style={{ height: productImages.length > 0 ? '120px' : '200px' }}>
                        <input id="editFileInput" type="file" accept="image/*" multiple onChange={(e) => {
                          const files = Array.from(e.target.files);
                          files.forEach(file => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProductImages(prev => {
                                const updated = [...prev, reader.result];
                                setNewProduct(p => ({ ...p, itemImage: updated[0] }));
                                return updated;
                              });
                            };
                            reader.readAsDataURL(file);
                          });
                          e.target.value = '';
                        }} className="hidden" />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-200"}`}>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                          {productImages.length > 0 ? 'Add more images' : 'Upload Images'}
                        </p>
                        <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Click to browse (multiple files)</p>
                      </div>

                      {/* URL input */}
                      <div className="mt-3 flex gap-2">
                        <input type="text" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const url = imageUrlInput.trim();
                              if (url) {
                                setProductImages(prev => {
                                  const updated = [...prev, url];
                                  setNewProduct(p => ({ ...p, itemImage: updated[0] }));
                                  return updated;
                                });
                                setImageUrlInput('');
                              }
                            }
                          }}
                          placeholder="Or paste image URL and press Enter"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300" : "bg-white border-gray-300 placeholder-gray-400"}`} />
                        <button type="button"
                          onClick={() => {
                            const url = imageUrlInput.trim();
                            if (url) {
                              setProductImages(prev => {
                                const updated = [...prev, url];
                                setNewProduct(p => ({ ...p, itemImage: updated[0] }));
                                return updated;
                              });
                              setImageUrlInput('');
                            }
                          }}
                          disabled={!imageUrlInput.trim()}
                          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${imageUrlInput.trim() ? 'bg-[#AD7F65] text-white hover:bg-[#8B6553]' : (theme === 'dark' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')}`}
                        >Add</button>
                      </div>
                      {productImages.length > 0 && (
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{productImages.length} image{productImages.length > 1 ? 's' : ''} added. First image will be the main display image.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════ ADD MODE: Step-by-step wizard ══════════ */}
            {!editingProduct && (
              <>
                {/* ── Step 1: Basic Info ── */}
                {currentStep === 1 && (
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className={`text-base font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Basic Info</h3>
                      <div className="space-y-3">
                        <div>
                          <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Product Name</label>
                          <input type="text" name="itemName" value={newProduct.itemName} onChange={handleInputChange} required placeholder="Product name"
                            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300" : "bg-white border-gray-300 placeholder-gray-400"}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Category</label>
                            <select name="category" value={newProduct.category || ""} onChange={(e) => {
                              handleInputChange(e);
                              setNewProduct(prev => ({ ...prev, subCategory: "" }));
                            }} required
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent appearance-none bg-no-repeat bg-[length:16px] bg-[center_right_12px] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-white border-gray-300"}`}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}>
                              <option value="" disabled className={theme === "dark" ? "bg-[#2A2724]" : ""}>Select Category</option>
                              {parentCategories.map((cat) => (
                                <option key={cat} value={cat} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{cat}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>SubCategory</label>
                            <select name="subCategory" value={newProduct.subCategory || ""} onChange={(e) => {
                              if (e.target.value === "__add_new__") { setShowCategoryModal(true); return; }
                              handleInputChange(e);
                              setSelectedVariants([]); setCustomColorInput(""); setVariantQuantities({}); setVariantPrices({}); setVariantCostPrices({}); setDifferentPricesPerVariant({});
                            }} required disabled={!newProduct.category}
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent appearance-none bg-no-repeat bg-[length:16px] bg-[center_right_12px] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-white border-gray-300"} ${!newProduct.category ? "opacity-50 cursor-not-allowed" : ""}`}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}>
                              <option value="" disabled className={theme === "dark" ? "bg-[#2A2724]" : ""}>Select SubCategory</option>
                              {getSubcategories(newProduct.category).map(sub => (
                                <option key={sub} value={sub} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{sub}</option>
                              ))}
                              <option value="__add_new__" className="font-semibold text-[#AD7F65]">+ Add Subcategory</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Brand</label>
                            <select name="brandName" value={newProduct.brandName || "Default"} onChange={(e) => {
                              if (e.target.value === "__add_new_brand__") { setShowBrandModal(true); return; }
                              handleInputChange(e);
                            }}
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent appearance-none bg-no-repeat bg-[length:16px] bg-[center_right_12px] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-white border-gray-300"}`}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}>
                              <option value="Default" className={theme === "dark" ? "bg-[#2A2724]" : ""}>Default</option>
                              {partnerNames.map((name) => (<option key={name} value={name} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{name}</option>))}
                              <option value="__add_new_brand__" className="font-semibold text-[#AD7F65]">+ Add Brand</option>
                              {legacyBrandSelected && <option value={newProduct.brandName}>{newProduct.brandName} (Inactive)</option>}
                            </select>
                          </div>
                          <div />
                        </div>
                      </div>
                    </div>
                    {/* Image Upload - Multiple Images */}
                    <div className="flex flex-col">
                      {/* Image thumbnails grid */}
                      {productImages.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {productImages.map((img, index) => (
                            <div key={index} className={`relative group rounded-lg overflow-hidden border ${index === 0 ? 'ring-2 ring-[#AD7F65]' : ''} ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`} style={{ aspectRatio: '1' }}>
                              <img src={img} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                              {index === 0 && (
                                <span className="absolute top-1 left-1 bg-[#AD7F65] text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">Main</span>
                              )}
                              <button type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setProductImages(prev => {
                                    const updated = prev.filter((_, i) => i !== index);
                                    setNewProduct(p => ({ ...p, itemImage: updated[0] || '' }));
                                    return updated;
                                  });
                                }}
                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:bg-red-600"
                              >×</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Warning for 3+ images */}
                      {productImages.length > 3 && (
                        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-medium">Adding more than 3 photos may slow down the system.</span>
                        </div>
                      )}

                      {/* Upload area */}
                      <div
                        onClick={() => document.getElementById("fileInput").click()}
                        className={`w-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 hover:bg-[#2A2724] hover:border-[#AD7F65]" : "bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-[#AD7F65]"}`}
                        style={{ height: productImages.length > 0 ? '120px' : '200px' }}>
                        <input id="fileInput" type="file" accept="image/*" multiple onChange={(e) => {
                          const files = Array.from(e.target.files);
                          files.forEach(file => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProductImages(prev => {
                                const updated = [...prev, reader.result];
                                setNewProduct(p => ({ ...p, itemImage: updated[0] }));
                                return updated;
                              });
                            };
                            reader.readAsDataURL(file);
                          });
                          e.target.value = '';
                        }} className="hidden" />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-200"}`}>
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                        <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                          {productImages.length > 0 ? 'Add more images' : 'Upload Images'}
                        </p>
                        <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Click to browse (multiple files)</p>
                      </div>

                      {/* URL input */}
                      <div className="mt-3 flex gap-2">
                        <input type="text" value={imageUrlInput} onChange={(e) => setImageUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const url = imageUrlInput.trim();
                              if (url) {
                                setProductImages(prev => {
                                  const updated = [...prev, url];
                                  setNewProduct(p => ({ ...p, itemImage: updated[0] }));
                                  return updated;
                                });
                                setImageUrlInput('');
                              }
                            }
                          }}
                          placeholder="Or paste image URL and press Enter"
                          className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300" : "bg-white border-gray-300 placeholder-gray-400"}`} />
                        <button type="button"
                          onClick={() => {
                            const url = imageUrlInput.trim();
                            if (url) {
                              setProductImages(prev => {
                                const updated = [...prev, url];
                                setNewProduct(p => ({ ...p, itemImage: updated[0] }));
                                return updated;
                              });
                              setImageUrlInput('');
                            }
                          }}
                          disabled={!imageUrlInput.trim()}
                          className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${imageUrlInput.trim() ? 'bg-[#AD7F65] text-white hover:bg-[#8B6553]' : (theme === 'dark' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed')}`}
                        >Add</button>
                      </div>
                      {productImages.length > 0 && (
                        <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>{productImages.length} image{productImages.length > 1 ? 's' : ''} added. First image will be the main display image.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 2: Variants & Set ── */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-base font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Variants</h3>
                      <div className="relative">
                        <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          Variant <span className="text-gray-400">{newProduct.category === "Foods" || newProduct.category === "Makeup" ? "Optional - Add variants (e.g., Strawberry, Vanilla)" : "Optional - Select multiple colors"}</span>
                        </label>
                        {newProduct.category === "Foods" || newProduct.category === "Makeup" ? (
                          <>
                            <div className="flex gap-2">
                              <input type="text" value={customColorInput} onChange={(e) => setCustomColorInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (customColorInput.trim() && !selectedVariants.includes(customColorInput.trim())) { setSelectedVariants([...selectedVariants, customColorInput.trim()]); setCustomColorInput(""); } } }}
                                placeholder={newProduct.category === "Foods" ? "e.g., Strawberry, Chocolate..." : "e.g., Nude, Red, Coral..."} disabled={newProduct.differentVariantsPerSize}
                                className={`flex-1 px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#AD7F65] ${newProduct.differentVariantsPerSize ? (theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-gray-500 cursor-not-allowed" : "bg-gray-100 text-gray-400 cursor-not-allowed") : (theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-white border-gray-300")}`} />
                              <button type="button" onClick={() => { if (customColorInput.trim() && !selectedVariants.includes(customColorInput.trim())) { setSelectedVariants([...selectedVariants, customColorInput.trim()]); setCustomColorInput(""); } }}
                                disabled={!customColorInput.trim() || newProduct.differentVariantsPerSize}
                                className={`px-4 py-2.5 text-sm rounded-lg font-medium transition-colors ${customColorInput.trim() && !newProduct.differentVariantsPerSize ? "bg-[#AD7F65] text-white hover:bg-[#8B6553]" : (theme === "dark" ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed")}`}>Add</button>
                            </div>
                            {selectedVariants.length > 0 && !newProduct.differentVariantsPerSize && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {selectedVariants.map((variant) => (
                                  <span key={variant} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full ${theme === "dark" ? "bg-[#AD7F65]/20 text-[#AD7F65] border border-[#AD7F65]/30" : "bg-[#AD7F65]/10 text-[#AD7F65] border border-[#AD7F65]/20"}`}>
                                    {variant}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeVariant(variant); }} className="hover:text-red-500 transition-colors">×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div onClick={() => !newProduct.differentVariantsPerSize && setShowVariantDropdown(!showVariantDropdown)}
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg cursor-pointer flex items-center justify-between ${newProduct.differentVariantsPerSize ? (theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-gray-500 cursor-not-allowed" : "bg-gray-100 text-gray-400 cursor-not-allowed") : (theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white hover:border-[#AD7F65]" : "bg-white border-gray-300 hover:border-[#AD7F65]")}`}>
                              <span className={selectedVariants.length === 0 ? "text-gray-400" : ""}>
                                {newProduct.differentVariantsPerSize ? "Multiple variants selected" : selectedVariants.length === 0 ? "Select colors..." : `${selectedVariants.length} color${selectedVariants.length > 1 ? 's' : ''} selected`}
                              </span>
                              <svg className={`w-4 h-4 transition-transform ${showVariantDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            {selectedVariants.length > 0 && !newProduct.differentVariantsPerSize && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {selectedVariants.map((color) => (
                                  <span key={color} className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full ${theme === "dark" ? "bg-[#AD7F65]/20 text-[#AD7F65] border border-[#AD7F65]/30" : "bg-[#AD7F65]/10 text-[#AD7F65] border border-[#AD7F65]/20"}`}>
                                    {color}
                                    <button type="button" onClick={(e) => { e.stopPropagation(); removeVariant(color); }} className="hover:text-red-500 transition-colors">×</button>
                                  </span>
                                ))}
                              </div>
                            )}
                            {showVariantDropdown && !newProduct.differentVariantsPerSize && (
                              <div className={`absolute z-50 w-full mt-1 max-h-48 overflow-y-auto border rounded-lg shadow-lg ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-white border-gray-200"}`}>
                                {COMMON_COLORS.filter((c) => c !== "Custom").map((color) => (
                                  <div key={color} onClick={() => handleVariantToggle(color)}
                                    className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${selectedVariants.includes(color) ? (theme === "dark" ? "bg-[#AD7F65]/20 text-[#AD7F65]" : "bg-[#AD7F65]/10 text-[#AD7F65]") : (theme === "dark" ? "hover:bg-[#3A3734]" : "hover:bg-gray-100")}`}>
                                    <span>{color}</span>
                                    {selectedVariants.includes(color) && <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                  </div>
                                ))}
                                <div className={`px-3 py-2 border-t ${theme === "dark" ? "border-gray-600" : "border-gray-200"}`} onClick={(e) => e.stopPropagation()}>
                                  <div className="flex gap-2">
                                    <input type="text" value={customColorInput} onChange={(e) => setCustomColorInput(e.target.value)} onKeyDown={handleCustomColorKeyDown} placeholder="Add custom color..."
                                      className={`flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`} />
                                    <button type="button" onClick={addCustomColor} disabled={!customColorInput.trim()}
                                      className={`px-3 py-1 text-sm rounded font-medium transition-colors ${customColorInput.trim() ? "bg-[#AD7F65] text-white hover:bg-[#8B6553]" : (theme === "dark" ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-200 text-gray-400 cursor-not-allowed")}`}>Add</button>
                                  </div>
                                </div>
                              </div>
                            )}
                            {showVariantDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowVariantDropdown(false)} />}
                          </>
                        )}
                      </div>
                      {selectedVariants.length === 0 && (
                        <p className={`text-sm text-center py-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>No variants selected. You can skip this step if not needed.</p>
                      )}
                    </div>

                    <div className={`h-px w-full ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`} />

                    <div>
                      <h3 className={`text-base font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Sizes</h3>
                      <div>
                        <label className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                          Sizes <span className="text-red-500">* Required</span> <span className="text-gray-400 ml-2">- Select multiple sizes</span>
                        </label>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {(() => {
                            const category = newProduct.category;
                            const subCategory = newProduct.subCategory || "";
                            let sizes = [];

                            const parentHasSizes = categoryStructure[category] !== undefined;

                            if (!parentHasSizes) { sizes = ["Free Size"]; }
                            else if (category === "Foods") {
                              switch (subCategory) {
                                case "Beverages": sizes = ["Small", "Medium", "Large", "Extra Large", "Free Size"]; break;
                                case "Snacks": sizes = ["Small Pack", "Medium Pack", "Large Pack", "Family Pack", "Free Size"]; break;
                                case "Meals": sizes = ["Regular", "Large", "Family Size", "Free Size"]; break;
                                case "Desserts": sizes = ["Small", "Medium", "Large", "Free Size"]; break;
                                case "Ingredients": sizes = ["100g", "250g", "500g", "1kg", "Free Size"]; break;
                                default: sizes = ["Small", "Medium", "Large", "Free Size"];
                              }
                            } else if (["Tops", "Bottoms", "Dresses", "Outerwear"].includes(subCategory)) {
                              sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"];
                            }
                            else if (category === "Shoes") { sizes = ["5", "6", "7", "8", "9", "10", "11", "12"]; }
                            else if (category === "Accessories" || category === "Makeup") { sizes = ["Free Size"]; }
                            else { sizes = ["Free Size"]; }
                            return [...sizes, ...customSizes].map((size) => (
                              <label key={size} className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={newProduct.selectedSizes?.includes(size) || false} onChange={() => handleSizeToggle(size)} className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]" />
                                <span className="flex-1 text-sm text-gray-700 break-words line-clamp-2" title={size}>{size}</span>
                                {customSizes.includes(size) && (
                                  <button type="button" title="Remove custom size" className="text-red-500 hover:text-red-700 text-xs ml-1"
                                    onClick={(e) => { e.preventDefault(); setCustomSizes(prev => prev.filter(s => s !== size)); if (newProduct.selectedSizes?.includes(size)) { handleSizeToggle(size); } }}>×</button>
                                )}
                              </label>
                            ));
                          })()}
                        </div>
                        <div className="mb-4">
                          <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input type="checkbox" checked={showCustomSizeInput} onChange={(e) => { setShowCustomSizeInput(e.target.checked); if (!e.target.checked) { setCustomSizeValue(""); } }} className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]" />
                            <span className="text-sm text-gray-700">Size not listed? Add custom size</span>
                          </label>
                          {showCustomSizeInput && (
                            <div className="flex gap-2 items-center">
                              <input type="text" value={customSizeValue} onChange={(e) => setCustomSizeValue(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const trimmed = customSizeValue.trim(); if (trimmed && !customSizes.includes(trimmed)) { setCustomSizes(prev => [...prev, trimmed]); setCustomSizeValue(""); } } }}
                                placeholder="Type size and press Enter or Add"
                                className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                              <button type="button" onClick={(e) => { e.preventDefault(); const trimmed = customSizeValue.trim(); if (trimmed && !customSizes.includes(trimmed)) { setCustomSizes(prev => [...prev, trimmed]); setCustomSizeValue(""); } }}
                                disabled={!customSizeValue.trim()} className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${!customSizeValue.trim() ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-[#AD7F65] text-white hover:bg-[#8B6553]"}`}>Add</button>
                            </div>
                          )}
                        </div>
                      </div>
                      {(!newProduct.selectedSizes || newProduct.selectedSizes.length === 0) && (
                        <p className={`text-sm text-center py-4 text-red-500`}>Please select at least one size to continue.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Step 3: Batch & Stock ── */}
                {currentStep === 3 && (
                  <div className="space-y-5">
                    <h3 className={`text-base font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Pricing & Stock</h3>

                    {/* Stock quantities */}
                    {newProduct.selectedSizes?.length > 0 && (
                      <div className={`p-3 rounded-lg border ${theme === "dark" ? "bg-[#1E1B18] border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                        <label className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          {newProduct.differentVariantsPerSize || selectedVariants.length > 0 ? "Quantity per Variant per Size:" : "Quantity per Size:"}
                        </label>

                        {/* If there are variants (global or per-size), capture per-variant quantities */}
                        {(newProduct.differentVariantsPerSize || selectedVariants.length > 0) ? (
                          <div className="space-y-4">
                            {newProduct.selectedSizes.map((size) => {
                              const variants = getVariantsForSize(size);
                              return (
                                <div key={size} className={`p-3 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>
                                  <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-200" : "text-gray-800"}`}>
                                    {size}
                                  </label>

                                  {variants.length === 0 ? (
                                    <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                                      No variants selected for this size. Go back to Step 2 and add/select variants, or turn off per-size variants.
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                      {variants.map((variant) => (
                                        <div key={`${size}-${variant}`}>
                                          <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                            {variant}
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            value={newProduct.variantQuantities?.[size]?.[variant] ?? ""}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              setVariantQuantities((prev) => {
                                                const updated = {
                                                  ...prev,
                                                  [size]: {
                                                    ...(prev[size] || {}),
                                                    [variant]: parseInt(value) || 0
                                                  }
                                                };
                                                setNewProduct((p) => ({ ...p, variantQuantities: updated }));
                                                return updated;
                                              });
                                            }}
                                            placeholder="Qty"
                                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            {newProduct.selectedSizes.map((size) => (
                              <div key={size}>
                                <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                                  {size}
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={newProduct.sizeQuantities?.[size] ?? ""}
                                  onChange={(e) => handleSizeQuantityChange(size, e.target.value)}
                                  placeholder="Qty"
                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <p className={`text-xs mt-2 ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                          Total stock to add: {getTotalStockFromInputs()}
                        </p>
                      </div>
                    )}

                    {/* Per-size pricing options */}
                    {newProduct.selectedSizes?.length > 0 && (
                      <>
                        <div className="mt-3 mb-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={newProduct.differentPricesPerSize || false}
                              onChange={(e) => {
                                setNewProduct((prev) => {
                                  const newSizePrices = {}; const newSizeCostPrices = {};
                                  if (e.target.checked) { prev.selectedSizes.forEach((size) => { newSizePrices[size] = prev.itemPrice || ""; newSizeCostPrices[size] = prev.costPrice || ""; }); }
                                  return { ...prev, differentPricesPerSize: e.target.checked, sizePrices: e.target.checked ? newSizePrices : {}, sizeCostPrices: e.target.checked ? newSizeCostPrices : {} };
                                });
                              }} className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]" />
                            <span className="text-sm text-gray-700">Different prices each size?</span>
                          </label>
                        </div>

                        {/* Variant pricing per size */}
                        {selectedVariants.length > 0 && (
                          <div className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}>
                            <label className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Pricing per Variant per Size:</label>
                            <div className="space-y-4">
                              {newProduct.selectedSizes.map((size) => (
                                <div key={size} className={`p-3 rounded-lg border ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-white border-gray-200"}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">{size}</label>
                                  </div>
                                  {!differentPricesPerVariant[size] && (newProduct.differentPricesPerSize || Object.values(differentPricesPerVariant).some((v) => v)) && (
                                    <div className="grid grid-cols-2 gap-2 mb-3">
                                      <div>
                                        <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Purchase Price</label>
                                        <div className="flex items-center gap-1">
                                          <span className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>₱</span>
                                          <input type="number" min="0" step="0.01" value={newProduct.sizeCostPrices?.[size] || ""}
                                            onChange={(e) => { setNewProduct((prev) => ({ ...prev, sizeCostPrices: { ...(prev.sizeCostPrices || {}), [size]: e.target.value } })); }}
                                            placeholder="Cost" className={`flex-1 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`} />
                                        </div>
                                      </div>
                                      <div>
                                        <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Selling Price</label>
                                        <div className="flex items-center gap-1">
                                          <span className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>₱</span>
                                          <input type="number" min="0" step="0.01" value={newProduct.sizePrices?.[size] || ""} onChange={(e) => handleSizePriceChange(size, e.target.value)}
                                            placeholder="Price" className={`flex-1 px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`} />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <label className="flex items-center gap-2 cursor-pointer mb-3">
                                    <input type="checkbox" checked={differentPricesPerVariant[size] || false}
                                      onChange={(e) => {
                                        setDifferentPricesPerVariant((prev) => ({ ...prev, [size]: e.target.checked }));
                                        if (e.target.checked) {
                                          const defaultPrice = parseFloat(newProduct.sizePrices?.[size]) || parseFloat(newProduct.itemPrice) || 0;
                                          const defaultCostPrice = parseFloat(newProduct.sizeCostPrices?.[size]) || parseFloat(newProduct.costPrice) || 0;
                                          const initialPrices = {}; const initialCostPrices = {};
                                          selectedVariants.forEach((v) => { initialPrices[v] = defaultPrice; initialCostPrices[v] = defaultCostPrice; });
                                          setVariantPrices((prev) => ({ ...prev, [size]: initialPrices }));
                                          setVariantCostPrices((prev) => ({ ...prev, [size]: initialCostPrices }));
                                        }
                                      }} className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]" />
                                    <span className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Different prices each variant?</span>
                                  </label>
                                  <div className={differentPricesPerVariant[size] ? "space-y-2" : "grid grid-cols-3 gap-2"}>
                                    {selectedVariants.map((variant) => (
                                      <div key={variant} className={differentPricesPerVariant[size] ? "flex items-center gap-2 flex-wrap" : "flex items-center gap-1"}>
                                        <span className={`text-xs px-2 py-1 rounded-full shrink-0 ${theme === "dark" ? "bg-[#AD7F65]/20 text-[#AD7F65]" : "bg-[#AD7F65]/10 text-[#AD7F65]"}`} style={{ minWidth: '50px', textAlign: 'center' }}>{variant}</span>
                                        {differentPricesPerVariant[size] && (
                                          <>
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Purchase:</span>
                                              <input type="number" min="0" step="0.01" value={variantCostPrices[size]?.[variant] || ""} onChange={(e) => handleVariantCostPriceChange(size, variant, e.target.value)}
                                                placeholder="₱" className={`w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`} />
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Selling:</span>
                                              <input type="number" min="0" step="0.01" value={variantPrices[size]?.[variant] || ""} onChange={(e) => handleVariantPriceChange(size, variant, e.target.value)}
                                                placeholder="₱" className={`w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[#AD7F65] ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`} />
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Different variants per size */}
                        {newProduct.differentVariantsPerSize && (
                          <div className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}>
                            <label className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Variant per Size:</label>
                            <div className="space-y-4">
                              {newProduct.selectedSizes.map((size) => {
                                const hasMultipleVariants = multipleVariantsPerSize[size] || false;
                                const variants = sizeMultiVariants[size] || [];
                                const singleVariant = newProduct.sizeVariants?.[size] || "";
                                return (
                                  <div key={size} className={`p-3 rounded-lg border ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-white border-gray-200"}`}>
                                    <label className={`block text-xs font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{size}</label>
                                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                                      <input type="checkbox" checked={hasMultipleVariants}
                                        onChange={(e) => {
                                          setMultipleVariantsPerSize((prev) => ({ ...prev, [size]: e.target.checked }));
                                          if (e.target.checked) { setSizeMultiVariants((prev) => ({ ...prev, [size]: singleVariant ? [singleVariant] : [] })); }
                                          else { setSizeMultiVariants((prev) => { const newState = { ...prev }; delete newState[size]; return newState; }); }
                                        }} className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]" />
                                      <span className="text-xs text-gray-600">Different variant in this size?</span>
                                    </label>
                                    {!hasMultipleVariants ? (
                                      <select value={singleVariant} onChange={(e) => { setNewProduct((prev) => ({ ...prev, sizeVariants: { ...prev.sizeVariants, [size]: e.target.value } })); }}
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`}>
                                        <option value="" className={theme === "dark" ? "bg-[#2A2724]" : ""}>Select a color</option>
                                        {COMMON_COLORS.filter((c) => c !== "Custom").map((color) => (<option key={color} value={color} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{color}</option>))}
                                      </select>
                                    ) : (
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap gap-2 min-h-[30px]">
                                          {variants.map((v, index) => (
                                            <span key={index} className="inline-flex items-center gap-1 bg-[#AD7F65] text-white text-xs px-3 py-1 rounded-full">
                                              {v}
                                              <button type="button" onClick={() => { setSizeMultiVariants((prev) => ({ ...prev, [size]: variants.filter((_, i) => i !== index) })); }} className="hover:opacity-80">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                        <select value="" onChange={(e) => { if (e.target.value && !variants.includes(e.target.value)) { setSizeMultiVariants((prev) => ({ ...prev, [size]: [...(prev[size] || []), e.target.value] })); } }}
                                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-300"}`}>
                                          <option value="" className={theme === "dark" ? "bg-[#2A2724]" : ""}>+ Add variant</option>
                                          {COMMON_COLORS.filter((c) => c !== "Custom" && !variants.includes(c)).map((color) => (<option key={color} value={color} className={theme === "dark" ? "bg-[#2A2724]" : ""}>{color}</option>))}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Per-size pricing (no variants) */}
                        {newProduct.differentPricesPerSize && selectedVariants.length === 0 && (
                          <div className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}>
                            <label className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Pricing per Size:</label>
                            <div className="space-y-3">
                              {newProduct.selectedSizes.map((size) => (
                                <div key={size} className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>{size} Purchase Price</label>
                                    <input type="number" step="0.01" min="0" value={newProduct.sizeCostPrices?.[size] || ""}
                                      onChange={(e) => { setNewProduct((prev) => ({ ...prev, sizeCostPrices: { ...prev.sizeCostPrices, [size]: e.target.value } })); }}
                                      placeholder="Enter cost price" className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300"}`} />
                                  </div>
                                  <div>
                                    <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>{size} Selling Price</label>
                                    <input type="number" step="0.01" min="0" value={newProduct.sizePrices?.[size] || ""} onChange={(e) => handleSizePriceChange(size, e.target.value)}
                                      placeholder="Enter selling price" className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300"}`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Global pricing */}
                    {!newProduct.differentPricesPerSize && !Object.values(differentPricesPerVariant).some((v) => v) && (
                      <div>
                        <h3 className="text-base font-semibold mb-3">Pricing</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Purchase Price</label>
                            <input type="number" step="0.01" name="costPrice" value={newProduct.costPrice} onChange={handleInputChange} placeholder="Enter cost price"
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-white border-gray-300"}`} />
                          </div>
                          <div>
                            <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>Selling Price</label>
                            <input type="number" step="0.01" name="itemPrice" value={newProduct.itemPrice} onChange={handleInputChange} required={!newProduct.differentPricesPerSize} placeholder="Enter selling price"
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-white border-gray-300"}`} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Expiration Date (Optional) */}
                    <div>
                      <h3 className="text-base font-semibold mb-3">Expiration</h3>
                      <div className="grid grid-cols-2 gap-3 max-w-md">
                        <div>
                          <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                            Expiration Date <span className="text-gray-400">(optional)</span>
                          </label>
                          <input
                            type="date"
                            name="expirationDate"
                            value={newProduct.expirationDate || ""}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark"
                              ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-400"
                              : "bg-white border-gray-300 placeholder-gray-400"}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Display Settings */}
                    <div>
                      <h3 className="text-base font-semibold mb-3">Display Settings</h3>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input type="checkbox" name="displayInTerminal" checked={newProduct.displayInTerminal !== false} onChange={handleInputChange} className="sr-only" />
                          <div className={`w-14 h-7 rounded-full transition-colors duration-200 ${newProduct.displayInTerminal !== false ? "bg-[#AD7F65]" : "bg-gray-300"}`}>
                            <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${newProduct.displayInTerminal !== false ? "translate-x-7" : "translate-x-1"} mt-0.5`}></div>
                          </div>
                        </div>
                        <div>
                          <span className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Display in Terminal</span>
                          <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>Show this product in POS/terminal</p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* ── Step 4: Review ── */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className={`text-base font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Review Product</h3>
                    <div className={`rounded-xl border p-5 space-y-4 ${theme === "dark" ? "bg-[#1E1B18] border-gray-700" : "bg-gray-50 border-gray-200"}`}>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <div>
                            <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Product Name</p>
                            <p className={`text-sm font-semibold mt-0.5 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>{newProduct.itemName || "—"}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Category</p>
                              <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{newProduct.category || "—"}</p>
                            </div>
                            <div>
                              <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Brand</p>
                              <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{newProduct.brandName || "Default"}</p>
                            </div>
                          </div>
                          {selectedVariants.length > 0 && (
                            <div>
                              <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Variants</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedVariants.map((v) => (
                                  <span key={v} className="inline-block px-2 py-0.5 text-xs rounded-full bg-[#AD7F65]/10 text-[#AD7F65] border border-[#AD7F65]/20">{v}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {newProduct.selectedSizes?.length > 0 && (
                            <div>
                              <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Sizes</p>
                              <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{newProduct.selectedSizes.join(", ")}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Cost Price</p>
                              <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{newProduct.costPrice ? `₱${newProduct.costPrice}` : "—"}</p>
                            </div>
                            <div>
                              <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Selling Price</p>
                              <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{newProduct.itemPrice ? `₱${newProduct.itemPrice}` : "—"}</p>
                            </div>
                          </div>
                          <div>
                            <p className={`text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Display in Terminal</p>
                            <p className={`text-sm mt-0.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>{newProduct.displayInTerminal !== false ? "Yes" : "No"}</p>
                          </div>
                        </div>
                        {/* Image preview */}
                        <div className="flex flex-col items-center justify-start gap-2">
                          {productImages.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2 w-full">
                              {productImages.map((img, idx) => (
                                <div key={idx} className={`relative rounded-lg overflow-hidden border ${idx === 0 ? 'ring-2 ring-[#AD7F65]' : ''} ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`} style={{ aspectRatio: '1' }}>
                                  <img src={img} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                                  {idx === 0 && <span className="absolute top-1 left-1 bg-[#AD7F65] text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">Main</span>}
                                </div>
                              ))}
                            </div>
                          ) : newProduct.itemImage && newProduct.itemImage.trim() !== "" ? (
                            <img src={newProduct.itemImage} alt="Preview" className="max-h-48 object-contain rounded-lg border border-gray-200" />
                          ) : (
                            <div className={`w-full h-40 rounded-lg flex items-center justify-center ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-200"}`}>
                              <span className="text-gray-400 text-sm">No image</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>

          {/* Navigation Footer */}
          {!editingProduct ? (
            <div className={`px-8 py-4 flex justify-between items-center border-t flex-shrink-0 ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
              <button type="button"
                onClick={() => currentStep === 1 ? setShowAddModal(false) : setCurrentStep((prev) => prev - 1)}
                className={`px-6 py-2.5 text-sm font-medium rounded-xl transition-colors ${theme === "dark" ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}>
                {currentStep === 1 ? "Cancel" : "← Back"}
              </button>
              {currentStep < 4 ? (
                <button type="button"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={!isStepValid(currentStep)}
                  className={`px-8 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-md hover:opacity-90 ${!isStepValid(currentStep) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{ background: "linear-gradient(135deg, #AD7F65 0%, #8B6553 100%)" }}>
                  Continue →
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  className="px-10 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-md hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
                  {loading ? "Adding..." : "Save Product"}
                </button>
              )}
            </div>
          ) : (
            <div className="px-8 py-4 flex justify-center flex-shrink-0">
              <button type="submit" disabled={loading}
                className="px-12 py-3 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg, #10B981 0%, #059669 100%)" }}>
                {loading ? "Updating..." : "Update Product"}
              </button>
            </div>
          )}
        </form>
      </div>

      <AddCategoryModal
        show={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onAdd={(newCategoryName) => {
          if (onCategoryAdd) {
            onCategoryAdd();
          }

          setNewProduct((prev) => ({ ...prev, category: newCategoryName }));
        }} />


      <AddBrandModal
        show={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onAdd={(newBrandName) => {
          if (onBrandAdd) {
            onBrandAdd();
          }
          setNewProduct((prev) => ({ ...prev, brandName: newBrandName }));
        }} />

    </div>);

};

export default AddProductModal;