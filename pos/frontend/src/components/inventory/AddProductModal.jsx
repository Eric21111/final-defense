import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import AddBrandModal from "./AddBrandModal";
import AddCategoryModal from "./AddCategoryModal";

// Common colors for variant dropdown
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
  "Custom", // Allows custom color input
];

const AddProductModal = ({
  showAddModal,
  setShowAddModal,
  editingProduct,
  setEditingProduct,
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
  onBrandAdd,
}) => {
  const { theme } = useTheme();
  // Built-in categories that have specific size options
  const builtInCategories = [
    "Tops",
    "Bottoms",
    "Dresses",
    "Makeup",
    "Accessories",
    "Shoes",
    "Head Wear",
    "Foods",
  ];
  const [showDraftNotice, setShowDraftNotice] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [customVariant, setCustomVariant] = useState("");
  const [multipleVariantsPerSize, setMultipleVariantsPerSize] = useState({});
  const [sizeMultiVariants, setSizeMultiVariants] = useState({});

  // Check if there's a recovered draft when modal opens
  useEffect(() => {
    if (showAddModal && !editingProduct) {
      const hasData =
        newProduct.itemName ||
        newProduct.variant ||
        newProduct.itemPrice ||
        newProduct.costPrice ||
        newProduct.currentStock ||
        newProduct.itemImage ||
        (newProduct.selectedSizes && newProduct.selectedSizes.length > 0);
      setShowDraftNotice(hasData);
    } else {
      setShowDraftNotice(false);
    }
  }, [showAddModal, editingProduct]);

  if (!showAddModal) return null;

  const partnerNames = Array.from(
    new Set(brandPartners.map((partner) => partner.brandName).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const legacyBrandSelected =
    newProduct.brandName &&
    newProduct.brandName !== "Default" &&
    !partnerNames.includes(newProduct.brandName);

  // Wrapper function to include custom variant and multi-variant data
  const handleFormSubmit = (e) => {
    e.preventDefault();

    //  Update newProduct with custom variant if applicable
    if (newProduct.variant === "Custom" && customVariant) {
      setNewProduct((prev) => ({ ...prev, variant: customVariant }));
    }

    // Store multi-variant data in newProduct for parent to access
    if (Object.keys(sizeMultiVariants).length > 0) {
      setNewProduct((prev) => ({
        ...prev,
        sizeMultiVariants: sizeMultiVariants,
        multipleVariantsPerSize: multipleVariantsPerSize,
      }));
    }

    // Call the parent's handleAddProduct with a slight delay to ensure state updates
    setTimeout(() => handleAddProduct(e), 10);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm pointer-events-none">
      <div
        className={`rounded-2xl w-full max-w-5xl relative pointer-events-auto shadow-2xl ${theme === "dark" ? "bg-[#2A2724] text-white" : "bg-white text-gray-900"}`}
        style={{
          maxHeight: "95vh",
          boxShadow:
            theme === "dark"
              ? "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
              : "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div className="flex justify-between items-center px-6 py-4">
          <h2 className="text-xl font-bold">
            {editingProduct ? "Edit Product Details" : "Add Product Details"}
          </h2>
          <button
            onClick={() => {
              setShowAddModal(false);
              // Don't clear storage when closing - keep the draft
            }}
            className={`text-2xl hover:text-gray-500 transition-colors ${theme === "dark" ? "text-gray-400" : "text-gray-400"}`}
          >
            ×
          </button>
        </div>

        {/* Draft Recovery Notice */}
        {showDraftNotice && !editingProduct && (
          <div
            className={`mx-6 mt-4 p-3 border rounded-lg flex items-center justify-between ${theme === "dark" ? "bg-amber-900/20 border-amber-800" : "bg-amber-50 border-amber-200"}`}
          >
            <div className="flex items-center gap-2">
              <svg
                className={`w-5 h-5 ${theme === "dark" ? "text-amber-500" : "text-amber-600"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span
                className={`text-sm ${theme === "dark" ? "text-amber-200" : "text-amber-800"}`}
              >
                Draft recovered from your previous session
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                resetProductForm();
                setShowDraftNotice(false);
              }}
              className={`text-xs underline hover:opacity-80 ${theme === "dark" ? "text-amber-300" : "text-amber-700"}`}
            >
              Clear Draft
            </button>
          </div>
        )}

        <form onSubmit={handleFormSubmit}>
          <div
            className="px-10 pb-6 pt-6 overflow-y-auto"
            style={{ maxHeight: "calc(95vh - 80px)" }}
          >
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold mb-3">Basic Info</h3>
                  <div className="space-y-3">
                    <div>
                      <label
                        className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                      >
                        Product Name
                      </label>
                      <input
                        type="text"
                        name="itemName"
                        value={newProduct.itemName}
                        onChange={handleInputChange}
                        required
                        placeholder="Product name"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                          theme === "dark"
                            ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300"
                            : "bg-gray-50 border-gray-300 placeholder-gray-400"
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                        >
                          Choose a Category
                        </label>
                        <select
                          name="category"
                          value={newProduct.category}
                          onChange={(e) => {
                            if (e.target.value === "__add_new__") {
                              setShowCategoryModal(true);
                              // Don't actually select "__add_new__", stick with previous or default
                              // The modal success handler will set the new category
                              return;
                            }

                            handleInputChange(e);

                            // Reset foodSubtype when category changes
                            if (e.target.value !== "Foods") {
                              setNewProduct((prev) => ({
                                ...prev,
                                foodSubtype: "",
                              }));
                            }
                          }}
                          required
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                            theme === "dark"
                              ? "bg-[#1E1B18] border-gray-600 text-white"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          {categories
                            .filter(
                              (cat) =>
                                cat.name !== "All" && cat.name !== "Others",
                            )
                            .map((category) => (
                              <option
                                key={category.name}
                                value={category.name}
                                className={
                                  theme === "dark" ? "bg-[#2A2724]" : ""
                                }
                              >
                                {category.name}
                              </option>
                            ))}
                          <option
                            value="__add_new__"
                            className="font-semibold text-[#AD7F65]"
                          >
                            + Add Category
                          </option>
                        </select>
                      </div>
                      <div>
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                        >
                          Brand
                        </label>
                        <select
                          name="brandName"
                          value={newProduct.brandName || "Default"}
                          onChange={(e) => {
                            if (e.target.value === "__add_new_brand__") {
                              setShowBrandModal(true);
                              // Don't change the value yet
                              return;
                            }
                            handleInputChange(e);
                          }}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                            theme === "dark"
                              ? "bg-[#1E1B18] border-gray-600 text-white"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          <option
                            value="Default"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Default
                          </option>
                          {partnerNames.map((name) => (
                            <option
                              key={name}
                              value={name}
                              className={theme === "dark" ? "bg-[#2A2724]" : ""}
                            >
                              {name}
                            </option>
                          ))}
                          <option
                            value="__add_new_brand__"
                            className="font-semibold text-[#AD7F65]"
                          >
                            + Add Brand
                          </option>
                          {legacyBrandSelected && (
                            <option value={newProduct.brandName}>
                              {newProduct.brandName} (Inactive)
                            </option>
                          )}
                        </select>
                      </div>
                    </div>
                    {newProduct.category === "Foods" && (
                      <div className="mt-3">
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                        >
                          Food Type
                        </label>
                        <select
                          name="foodSubtype"
                          value={newProduct.foodSubtype || ""}
                          onChange={handleInputChange}
                          required
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                            theme === "dark"
                              ? "bg-[#1E1B18] border-gray-600 text-white"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          <option
                            value=""
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Select Food Type
                          </option>
                          <option
                            value="Beverages"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Beverages
                          </option>
                          <option
                            value="Snacks"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Snacks
                          </option>
                          <option
                            value="Meals"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Meals
                          </option>
                          <option
                            value="Desserts"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Desserts
                          </option>
                          <option
                            value="Ingredients"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Ingredients
                          </option>
                          <option
                            value="Other"
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            Other
                          </option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold mb-3">
                    Stock Details
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                        >
                          Variant{" "}
                          <span className="text-gray-400">Optional</span>
                        </label>
                        <select
                          name="variant"
                          value={newProduct.variant || ""}
                          onChange={(e) => {
                            handleInputChange(e);
                            if (e.target.value !== "Custom") {
                              setCustomVariant("");
                            }
                          }}
                          disabled={newProduct.differentVariantsPerSize}
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                            newProduct.differentVariantsPerSize
                              ? theme === "dark"
                                ? "bg-[#1E1B18] border-gray-600 text-gray-500 cursor-not-allowed"
                                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : theme === "dark"
                                ? "bg-[#1E1B18] border-gray-600 text-white"
                                : "bg-gray-50 border-gray-300"
                          }`}
                        >
                          <option
                            value=""
                            className={theme === "dark" ? "bg-[#2A2724]" : ""}
                          >
                            {newProduct.differentVariantsPerSize
                              ? "Multiple variants selected"
                              : "Select a color"}
                          </option>
                          {COMMON_COLORS.map((color) => (
                            <option
                              key={color}
                              value={color}
                              className={theme === "dark" ? "bg-[#2A2724]" : ""}
                            >
                              {color}
                            </option>
                          ))}
                        </select>
                        {newProduct.variant === "Custom" &&
                          !newProduct.differentVariantsPerSize && (
                            <input
                              type="text"
                              value={customVariant}
                              onChange={(e) => setCustomVariant(e.target.value)}
                              placeholder="Enter custom color"
                              className={`w-full px-3 py-2 text-sm border rounded-lg mt-2 focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                                theme === "dark"
                                  ? "bg-[#1E1B18] border-gray-600 text-white"
                                  : "bg-gray-50 border-gray-300"
                              }`}
                            />
                          )}
                      </div>
                    </div>

                    {!editingProduct && (
                      <>
                        <div>
                          <label
                            className={`block text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                          >
                            Sizes{" "}
                            <span className="text-gray-400">
                              Optional - Select multiple sizes
                            </span>
                          </label>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {(() => {
                              const category = newProduct.category;
                              const foodSubtype = newProduct.foodSubtype || "";
                              let sizes = [];

                              // Check if category is built-in
                              const isBuiltIn =
                                builtInCategories.includes(category);

                              if (!isBuiltIn) {
                                // All custom/added categories should have Free Size only
                                sizes = ["Free Size"];
                              }
                              // Foods - size depends on subtype
                              else if (category === "Foods") {
                                switch (foodSubtype) {
                                  case "Beverages":
                                    sizes = [
                                      "Small",
                                      "Medium",
                                      "Large",
                                      "Extra Large",
                                      "Free Size",
                                    ];
                                    break;
                                  case "Snacks":
                                    sizes = [
                                      "Small",
                                      "Medium",
                                      "Large",
                                      "Family Size",
                                      "Free Size",
                                    ];
                                    break;
                                  case "Meals":
                                    sizes = [
                                      "Regular",
                                      "Large",
                                      "Family Size",
                                      "Free Size",
                                    ];
                                    break;
                                  case "Desserts":
                                    sizes = [
                                      "Small",
                                      "Medium",
                                      "Large",
                                      "Free Size",
                                    ];
                                    break;
                                  case "Ingredients":
                                    sizes = [
                                      "100g",
                                      "250g",
                                      "500g",
                                      "1kg",
                                      "Free Size",
                                    ];
                                    break;
                                  case "Other":
                                    sizes = [
                                      "Small",
                                      "Medium",
                                      "Large",
                                      "Free Size",
                                    ];
                                    break;
                                  default:
                                    // Default sizes when no subtype selected
                                    sizes = [
                                      "Small",
                                      "Medium",
                                      "Large",
                                      "Free Size",
                                    ];
                                }
                              }
                              // Clothing categories (Tops, Bottoms, Dresses)
                              else if (
                                ["Tops", "Bottoms", "Dresses"].includes(
                                  category,
                                )
                              ) {
                                sizes = [
                                  "XS",
                                  "S",
                                  "M",
                                  "L",
                                  "XL",
                                  "XXL",
                                  "XXXL",
                                  "Free Size",
                                ];
                              }
                              // Shoes
                              else if (category === "Shoes") {
                                sizes = [
                                  "5",
                                  "6",
                                  "7",
                                  "8",
                                  "9",
                                  "10",
                                  "11",
                                  "12",
                                ];
                              }
                              // Accessories, Head Wear, Makeup
                              else if (
                                ["Accessories", "Head Wear", "Makeup"].includes(
                                  category,
                                )
                              ) {
                                sizes = ["Free Size"];
                              }

                              return sizes.map((size) => (
                                <label
                                  key={size}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      newProduct.selectedSizes?.includes(
                                        size,
                                      ) || false
                                    }
                                    onChange={() => handleSizeToggle(size)}
                                    className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {size}
                                  </span>
                                </label>
                              ));
                            })()}
                          </div>

                          {newProduct.selectedSizes?.length > 0 && (
                            <>
                              <div className="mt-3 mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={
                                      newProduct.differentPricesPerSize || false
                                    }
                                    onChange={(e) => {
                                      setNewProduct((prev) => {
                                        const newSizePrices = {};
                                        const newSizeCostPrices = {};
                                        if (e.target.checked) {
                                          // Initialize prices for all selected sizes with default price
                                          prev.selectedSizes.forEach((size) => {
                                            newSizePrices[size] =
                                              prev.itemPrice || "";
                                            newSizeCostPrices[size] =
                                              prev.costPrice || "";
                                          });
                                        }
                                        return {
                                          ...prev,
                                          differentPricesPerSize:
                                            e.target.checked,
                                          sizePrices: e.target.checked
                                            ? newSizePrices
                                            : {},
                                          sizeCostPrices: e.target.checked
                                            ? newSizeCostPrices
                                            : {},
                                        };
                                      });
                                    }}
                                    className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]"
                                  />
                                  <span className="text-sm text-gray-700">
                                    Different prices each size?
                                  </span>
                                </label>
                              </div>

                              <div className="mb-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={
                                      newProduct.differentVariantsPerSize ||
                                      false
                                    }
                                    onChange={(e) => {
                                      setNewProduct((prev) => {
                                        const newSizeVariants = {};
                                        if (e.target.checked) {
                                          prev.selectedSizes.forEach((size) => {
                                            newSizeVariants[size] =
                                              prev.variant || "";
                                          });
                                          // Clear main variant when this is checked to avoid confusion?
                                          // Or keep it as a fallback? Let's keep it.
                                        }
                                        return {
                                          ...prev,
                                          differentVariantsPerSize:
                                            e.target.checked,
                                          sizeVariants: e.target.checked
                                            ? newSizeVariants
                                            : {},
                                        };
                                      });
                                    }}
                                    className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]"
                                  />
                                  <span className="text-sm text-gray-700">
                                    Different variants each sizes?
                                  </span>
                                </label>
                              </div>

                              <div
                                className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
                              >
                                <label
                                  className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                                >
                                  Quantity per Size:
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                  {newProduct.selectedSizes.map((size) => (
                                    <div key={size}>
                                      <label className="block text-xs text-gray-600 mb-1">
                                        {size}
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        value={
                                          newProduct.sizeQuantities?.[size] ||
                                          ""
                                        }
                                        onChange={(e) =>
                                          handleSizeQuantityChange(
                                            size,
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Enter quantity"
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {newProduct.differentVariantsPerSize && (
                                <div
                                  className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
                                >
                                  <label
                                    className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                                  >
                                    Variant per Size:
                                  </label>
                                  <div className="space-y-4">
                                    {newProduct.selectedSizes.map((size) => {
                                      const hasMultipleVariants =
                                        multipleVariantsPerSize[size] || false;
                                      const variants =
                                        sizeMultiVariants[size] || [];
                                      const singleVariant =
                                        newProduct.sizeVariants?.[size] || "";

                                      return (
                                        <div
                                          key={size}
                                          className={`p-3 rounded-lg border ${theme === "dark" ? "bg-[#2A2724] border-gray-600" : "bg-white border-gray-200"}`}
                                        >
                                          <label
                                            className={`block text-xs font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                                          >
                                            {size}
                                          </label>

                                          {/* Checkbox for multiple variants in this size */}
                                          <label className="flex items-center gap-2 cursor-pointer mb-2">
                                            <input
                                              type="checkbox"
                                              checked={hasMultipleVariants}
                                              onChange={(e) => {
                                                setMultipleVariantsPerSize(
                                                  (prev) => ({
                                                    ...prev,
                                                    [size]: e.target.checked,
                                                  }),
                                                );
                                                if (e.target.checked) {
                                                  // Initialize with single variant if any
                                                  setSizeMultiVariants(
                                                    (prev) => ({
                                                      ...prev,
                                                      [size]: singleVariant
                                                        ? [singleVariant]
                                                        : [],
                                                    }),
                                                  );
                                                } else {
                                                  // Clear multi-variants
                                                  setSizeMultiVariants(
                                                    (prev) => {
                                                      const newState = {
                                                        ...prev,
                                                      };
                                                      delete newState[size];
                                                      return newState;
                                                    },
                                                  );
                                                }
                                              }}
                                              className="w-4 h-4 text-[#AD7F65] border-gray-300 rounded focus:ring-[#AD7F65]"
                                            />
                                            <span className="text-xs text-gray-600">
                                              Different variant in this size?
                                            </span>
                                          </label>

                                          {!hasMultipleVariants ? (
                                            /* Single variant dropdown */
                                            <select
                                              value={singleVariant}
                                              onChange={(e) => {
                                                setNewProduct((prev) => ({
                                                  ...prev,
                                                  sizeVariants: {
                                                    ...prev.sizeVariants,
                                                    [size]: e.target.value,
                                                  },
                                                }));
                                              }}
                                              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                                                theme === "dark"
                                                  ? "bg-[#1E1B18] border-gray-600 text-white"
                                                  : "bg-gray-50 border-gray-300"
                                              }`}
                                            >
                                              <option
                                                value=""
                                                className={
                                                  theme === "dark"
                                                    ? "bg-[#2A2724]"
                                                    : ""
                                                }
                                              >
                                                Select a color
                                              </option>
                                              {COMMON_COLORS.filter(
                                                (c) => c !== "Custom",
                                              ).map((color) => (
                                                <option
                                                  key={color}
                                                  value={color}
                                                  className={
                                                    theme === "dark"
                                                      ? "bg-[#2A2724]"
                                                      : ""
                                                  }
                                                >
                                                  {color}
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            /* Multiple variants UI */
                                            <div className="space-y-2">
                                              {/* Display current variants as chips */}
                                              <div className="flex flex-wrap gap-2 min-h-[30px]">
                                                {variants.map((v, index) => (
                                                  <span
                                                    key={index}
                                                    className="inline-flex items-center gap-1 bg-[#AD7F65] text-white text-xs px-3 py-1 rounded-full"
                                                  >
                                                    {v}
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setSizeMultiVariants(
                                                          (prev) => ({
                                                            ...prev,
                                                            [size]:
                                                              variants.filter(
                                                                (_, i) =>
                                                                  i !== index,
                                                              ),
                                                          }),
                                                        );
                                                      }}
                                                      className="hover:opacity-80"
                                                    >
                                                      <svg
                                                        className="w-3 h-3"
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                      >
                                                        <path
                                                          fillRule="evenodd"
                                                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                          clipRule="evenodd"
                                                        />
                                                      </svg>
                                                    </button>
                                                  </span>
                                                ))}
                                              </div>

                                              {/* Add variant dropdown */}
                                              <select
                                                value=""
                                                onChange={(e) => {
                                                  if (
                                                    e.target.value &&
                                                    !variants.includes(
                                                      e.target.value,
                                                    )
                                                  ) {
                                                    setSizeMultiVariants(
                                                      (prev) => ({
                                                        ...prev,
                                                        [size]: [
                                                          ...(prev[size] || []),
                                                          e.target.value,
                                                        ],
                                                      }),
                                                    );
                                                  }
                                                }}
                                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                                                  theme === "dark"
                                                    ? "bg-[#1E1B18] border-gray-600 text-white"
                                                    : "bg-gray-50 border-gray-300"
                                                }`}
                                              >
                                                <option
                                                  value=""
                                                  className={
                                                    theme === "dark"
                                                      ? "bg-[#2A2724]"
                                                      : ""
                                                  }
                                                >
                                                  + Add variant
                                                </option>
                                                {COMMON_COLORS.filter(
                                                  (c) =>
                                                    c !== "Custom" &&
                                                    !variants.includes(c),
                                                ).map((color) => (
                                                  <option
                                                    key={color}
                                                    value={color}
                                                    className={
                                                      theme === "dark"
                                                        ? "bg-[#2A2724]"
                                                        : ""
                                                    }
                                                  >
                                                    {color}
                                                  </option>
                                                ))}
                                              </select>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {newProduct.differentPricesPerSize && (
                                <div
                                  className={`space-y-2 mt-3 p-3 rounded-lg ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}
                                >
                                  <label
                                    className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                                  >
                                    Pricing per Size:
                                  </label>
                                  <div className="space-y-3">
                                    {newProduct.selectedSizes.map((size) => (
                                      <div
                                        key={size}
                                        className="grid grid-cols-2 gap-3"
                                      >
                                        <div>
                                          <label
                                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                                          >
                                            {size} Cost Price
                                          </label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={
                                              newProduct.sizeCostPrices?.[
                                                size
                                              ] || ""
                                            }
                                            onChange={(e) => {
                                              setNewProduct((prev) => ({
                                                ...prev,
                                                sizeCostPrices: {
                                                  ...prev.sizeCostPrices,
                                                  [size]: e.target.value,
                                                },
                                              }));
                                            }}
                                            placeholder="Enter cost price"
                                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                                              theme === "dark"
                                                ? "bg-[#2A2724] border-gray-600 text-white"
                                                : "bg-white border-gray-300"
                                            }`}
                                          />
                                        </div>
                                        <div>
                                          <label
                                            className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                                          >
                                            {size} Selling Price
                                          </label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={
                                              newProduct.sizePrices?.[size] ||
                                              ""
                                            }
                                            onChange={(e) =>
                                              handleSizePriceChange(
                                                size,
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Enter selling price"
                                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                                              theme === "dark"
                                                ? "bg-[#2A2724] border-gray-600 text-white"
                                                : "bg-white border-gray-300"
                                            }`}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {(!newProduct.selectedSizes ||
                          newProduct.selectedSizes.length === 0) && (
                          <div>
                            <label
                              className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                            >
                              Stock
                            </label>
                            <input
                              type="number"
                              name="currentStock"
                              value={newProduct.currentStock}
                              onChange={handleInputChange}
                              placeholder="Add Stock"
                              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                                theme === "dark"
                                  ? "bg-[#1E1B18] border-gray-600 text-white"
                                  : "bg-gray-50 border-gray-300"
                              }`}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {!newProduct.differentPricesPerSize && (
                  <div>
                    <h3 className="text-base font-semibold mb-3">Pricing</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                        >
                          Cost Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="costPrice"
                          value={newProduct.costPrice}
                          onChange={handleInputChange}
                          placeholder="Enter cost price"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                            theme === "dark"
                              ? "bg-[#1E1B18] border-gray-600 text-white"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        />
                      </div>
                      <div>
                        <label
                          className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
                        >
                          Selling Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="itemPrice"
                          value={newProduct.itemPrice}
                          onChange={handleInputChange}
                          required={!newProduct.differentPricesPerSize}
                          placeholder="Enter selling price"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                            theme === "dark"
                              ? "bg-[#1E1B18] border-gray-600 text-white"
                              : "bg-gray-50 border-gray-300"
                          }`}
                        />
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
                      // Check if product has zero stock
                      // When editing, use the actual product's current stock and sizes
                      const hasZeroStock = () => {
                        if (editingProduct) {
                          // When editing, check the actual product's stock
                          if (
                            editingProduct.sizes &&
                            typeof editingProduct.sizes === "object" &&
                            Object.keys(editingProduct.sizes).length > 0
                          ) {
                            // For products with sizes, check if all sizes have 0 stock
                            const allSizesZero = Object.values(
                              editingProduct.sizes,
                            ).every((sizeData) => {
                              if (
                                typeof sizeData === "object" &&
                                sizeData !== null &&
                                sizeData.quantity !== undefined
                              ) {
                                return (sizeData.quantity || 0) === 0;
                              }
                              return (
                                (typeof sizeData === "number"
                                  ? sizeData
                                  : 0) === 0
                              );
                            });
                            return allSizesZero;
                          }
                          // For products without sizes, check currentStock
                          return (editingProduct.currentStock || 0) === 0;
                        } else {
                          // When adding new product, check newProduct
                          if (
                            newProduct.selectedSizes &&
                            newProduct.selectedSizes.length > 0 &&
                            newProduct.sizeQuantities
                          ) {
                            // For products with sizes, check if all sizes have 0 stock
                            const allSizesZero = newProduct.selectedSizes.every(
                              (size) => {
                                const qty =
                                  newProduct.sizeQuantities[size] || 0;
                                return parseInt(qty) === 0;
                              },
                            );
                            return allSizesZero;
                          }
                          // For products without sizes, check currentStock
                          return parseInt(newProduct.currentStock || 0) === 0;
                        }
                      };

                      const isStockZero = hasZeroStock();
                      const isDisabled = editingProduct && isStockZero;

                      return (
                        <label
                          className={`flex items-center gap-3 ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              name="displayInTerminal"
                              checked={newProduct.displayInTerminal !== false}
                              onChange={handleInputChange}
                              disabled={isDisabled}
                              className="sr-only"
                            />
                            <div
                              className={`w-14 h-7 rounded-full transition-colors duration-200 ${
                                newProduct.displayInTerminal !== false
                                  ? "bg-[#AD7F65]"
                                  : "bg-gray-300"
                              } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                              <div
                                className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                                  newProduct.displayInTerminal !== false
                                    ? "translate-x-7"
                                    : "translate-x-1"
                                } mt-0.5`}
                              ></div>
                            </div>
                          </div>
                          <div>
                            <span
                              className={`text-sm font-medium ${isDisabled ? "text-gray-400 opacity-60" : theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                            >
                              Display in Terminal
                            </span>
                            <p
                              className={`text-xs ${isDisabled ? "text-gray-500 opacity-60" : theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
                            >
                              {isDisabled
                                ? "Add stock to enable this option"
                                : "Show this product in POS/terminal"}
                            </p>
                          </div>
                        </label>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex flex-col px-8 mt-6">
                <div>
                  <div
                    onClick={() => document.getElementById("fileInput").click()}
                    className={`w-3/4 mx-auto border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 cursor-pointer transition-all ${
                      theme === "dark"
                        ? "bg-[#1E1B18] border-gray-600 hover:bg-[#2A2724] hover:border-[#AD7F65]"
                        : "bg-gray-50 border-gray-300 hover:bg-gray-100 hover:border-[#AD7F65]"
                    }`}
                    style={{ height: "350px" }}
                  >
                    <input
                      id="fileInput"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewProduct((prev) => ({
                              ...prev,
                              itemImage: reader.result,
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    {newProduct.itemImage &&
                    newProduct.itemImage.trim() !== "" ? (
                      <div className="w-full h-full flex items-center justify-center p-4">
                        <img
                          src={newProduct.itemImage}
                          alt="Product Preview"
                          className="max-w-full max-h-full object-contain rounded-lg"
                          style={{ display: "block" }}
                        />
                      </div>
                    ) : (
                      <>
                        <div
                          className={`w-20 h-20 rounded-lg flex items-center justify-center mb-3 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-300"}`}
                        >
                          <svg
                            className={`w-10 h-10 ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <p
                          className={`text-sm mb-3 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                        >
                          Upload an Image
                        </p>
                        <p
                          className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}
                        >
                          Click to browse or paste URL below
                        </p>
                      </>
                    )}
                  </div>
                  {!newProduct.itemImage && (
                    <div className="mt-3">
                      <input
                        type="text"
                        name="itemImage"
                        value={newProduct.itemImage}
                        onChange={handleInputChange}
                        placeholder="Or paste image URL"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${
                          theme === "dark"
                            ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-300"
                            : "bg-white border-gray-300 placeholder-gray-400"
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-8 flex justify-center">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-12 py-3 text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all shadow-lg"
                    style={{
                      background:
                        "linear-gradient(135deg, #10B981 0%, #059669 100%)",
                    }}
                  >
                    {loading
                      ? editingProduct
                        ? "Updating..."
                        : "Adding..."
                      : editingProduct
                        ? "Update Product"
                        : "Add New Item"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <AddCategoryModal
        show={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onAdd={(newCategoryName) => {
          if (onCategoryAdd) {
            onCategoryAdd();
          }
          // Set the new category in the form
          setNewProduct((prev) => ({ ...prev, category: newCategoryName }));
        }}
      />

      <AddBrandModal
        show={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onAdd={(newBrandName) => {
          if (onBrandAdd) {
            onBrandAdd();
          }
          setNewProduct((prev) => ({ ...prev, brandName: newBrandName }));
        }}
      />
    </div>
  );
};

export default AddProductModal;
