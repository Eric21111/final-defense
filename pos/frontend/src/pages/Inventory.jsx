import { memo, useEffect, useMemo, useState } from "react";
import { FaPlus, FaSearch } from "react-icons/fa";
import Header from "../components/shared/header";
import { API_BASE_URL } from "../config/api";
import { useDataCache } from "../context/DataCacheContext";
import { useTheme } from "../context/ThemeContext";

import accessoriesIcon from "../assets/inventory-icons/accesories.svg";
import allIcon from "../assets/inventory-icons/ALL.svg";
import bottomsIcon from "../assets/inventory-icons/Bottoms.svg";
import dressesIcon from "../assets/inventory-icons/dresses.svg";
import headWearIcon from "../assets/inventory-icons/head wear.svg";
import makeupIcon from "../assets/inventory-icons/make up.svg";
import shoesIcon from "../assets/inventory-icons/shoe.svg";
import topIcon from "../assets/inventory-icons/Top.svg";
import AddProductModal from "../components/inventory/AddProductModal";
import ConfirmAddProductModal from "../components/inventory/ConfirmAddProductModal";
import DeleteConfirmationModal from "../components/inventory/DeleteConfirmationModal";
import EditConfirmationModal from "../components/inventory/EditConfirmationModal";
import Pagination from "../components/inventory/Pagination";
import ProductTable from "../components/inventory/ProductTable";
import StockInModal from "../components/inventory/StockInModal";
import StockOutModal from "../components/inventory/StockOutModal";
import SuccessModal from "../components/inventory/SuccessModal";
import ViewProductModal from "../components/inventory/ViewProductModal";

const preferredExportFieldOrder = [
  "_id",
  "sku",
  "itemName",
  "category",
  "brandName",
  "variant",
  "itemPrice",
  "costPrice",
  "currentStock",
  "reorderNumber",
  "displayInTerminal",
  "terminalStatus",
  "selectedSizes",
  "sizeQuantities",
  "sizePrices",
  "sizes",
  "differentPricesPerSize",
  "foodSubtype",
  "supplierName",
  "supplierContact",
  "itemImage",
  "dateAdded",
  "lastUpdated",
  "createdAt",
  "updatedAt",
];

// Map database field names to human-readable CSV headers
const fieldToHeaderMap = {
  _id: "ID",
  sku: "SKU",
  itemName: "Item Name",
  category: "Category",
  brandName: "Brand",
  variant: "Variant",
  itemPrice: "Item Price",
  costPrice: "Cost Price",
  currentStock: "Current Stock",
  reorderNumber: "Reorder Level",
  displayInTerminal: "Display In Terminal",
  terminalStatus: "Terminal Status",
  selectedSizes: "Selected Sizes",
  sizeQuantities: "Size Quantities",
  sizePrices: "Size Prices",
  sizes: "Sizes",
  differentPricesPerSize: "Different Prices Per Size",
  foodSubtype: "Food Subtype",
  supplierName: "Supplier Name",
  supplierContact: "Supplier Contact",
  itemImage: "Image URL",
  dateAdded: "Date Added",
  lastUpdated: "Last Updated",
  createdAt: "Created At",
  updatedAt: "Updated At",
  stockStatus: "Stock Status",
};

const ADD_PRODUCT_STORAGE_KEY = "addProductFormDraft";

const Inventory = () => {
  const { theme } = useTheme();
  const { getCachedData, setCachedData, isCacheValid, invalidateCache } =
    useDataCache();
  const [products, setProducts] = useState(
    () => getCachedData("products") || [],
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockModalType, setStockModalType] = useState("in");
  const [stockAmount, setStockAmount] = useState("");
  const [viewingProduct, setViewingProduct] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy] = useState("sku-new");
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [importResult, setImportResult] = useState({
    successCount: 0,
    errorCount: 0,
    errors: [],
  });
  const itemsPerPage = 6;
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isExportSelectionMode, setIsExportSelectionMode] = useState(false);

  const defaultProductState = {
    sku: "",
    itemName: "",
    category: "Tops",
    brandName: "Default",
    variant: "",
    size: "",
    itemPrice: "",
    costPrice: "",
    currentStock: "",
    reorderNumber: "",
    supplierName: "",
    supplierContact: "",
    itemImage: "",
    selectedSizes: [],
    sizeQuantities: {},
    sizePrices: {},
    sizeCostPrices: {},
    differentPricesPerSize: false,
    foodSubtype: "", // Subtype for Foods category
    displayInTerminal: true, // Display in POS/terminal by default
  };

  // Load saved draft from localStorage on initial render
  const [newProduct, setNewProduct] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(ADD_PRODUCT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        // Merge with defaults to ensure all fields exist
        return { ...defaultProductState, ...parsed };
      }
    } catch (error) {
      console.error("Error loading product draft from localStorage:", error);
    }
    return defaultProductState;
  });

  const [categories, setCategories] = useState([
    { name: "All", icon: allIcon },
  ]);
  const [brandPartners, setBrandPartners] = useState([]);

  // Save form data to localStorage whenever newProduct changes (only when not editing)
  useEffect(() => {
    if (!editingProduct && showAddModal) {
      try {
        // Don't save if form is essentially empty (just defaults)
        const hasData =
          newProduct.itemName ||
          newProduct.variant ||
          newProduct.itemPrice ||
          newProduct.costPrice ||
          newProduct.currentStock ||
          newProduct.itemImage ||
          (newProduct.selectedSizes && newProduct.selectedSizes.length > 0);

        if (hasData) {
          localStorage.setItem(
            ADD_PRODUCT_STORAGE_KEY,
            JSON.stringify(newProduct),
          );
        }
      } catch (error) {
        console.error("Error saving product draft to localStorage:", error);
      }
    }
  }, [newProduct, editingProduct, showAddModal]);

  // Icon mapping for categories
  const categoryIconMap = {
    Tops: topIcon,
    Bottoms: bottomsIcon,
    Dresses: dressesIcon,
    Makeup: makeupIcon,
    Accessories: accessoriesIcon,
    Shoes: shoesIcon,
    "Head Wear": headWearIcon,
  };

  // Fetch active categories from API
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        // Filter only active categories, exclude "Others", and map with icons
        const activeCategories = data.data
          .filter((cat) => cat.status === "active" && cat.name !== "Others")
          .map((cat) => ({
            name: cat.name,
            icon: categoryIconMap[cat.name] || allIcon,
          }));

        // Add 'All' at the beginning
        setCategories([{ name: "All", icon: allIcon }, ...activeCategories]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      // Fallback to default categories if API fails
      setCategories([
        { name: "All", icon: allIcon },
        { name: "Tops", icon: topIcon },
        { name: "Bottoms", icon: bottomsIcon },
        { name: "Dresses", icon: dressesIcon },
        { name: "Makeup", icon: makeupIcon },
        { name: "Accessories", icon: accessoriesIcon },
        { name: "Shoes", icon: shoesIcon },
        { name: "Head Wear", icon: headWearIcon },
      ]);
    }
  };

  const fetchBrandPartners = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/brand-partners`);
      const data = await response.json();
      if (data.success) {
        setBrandPartners(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching brand partners:", error);
    }
  };

  const categoryCodeMap = {
    Tops: "TOP",
    Bottoms: "BOT",
    Dresses: "DRS",
    Makeup: "MUA",
    Accessories: "MUA",
    Shoes: "SHO",
    "Head Wear": "HDW",
    Foods: "FOD",
  };

  const getNextIncrementalCode = () => {
    // Extract all numeric codes from existing SKUs
    const numericCodes = products
      .map((p) => {
        const match = p.sku?.match(/-(\d{5})-?/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((num) => num > 0);

    // Get the highest number, or start from 0
    const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;

    // Increment and pad with zeros to 5 digits
    return String(maxCode + 1).padStart(5, "0");
  };

  const getColorCode = (variant) => {
    if (!variant || variant.trim() === "") {
      return "XXX";
    }

    const cleaned = variant.replace(/\s+/g, "").toUpperCase();
    return cleaned.substring(0, 3).padEnd(3, "X");
  };

  const generateSKU = (category, variant) => {
    const categoryCode = categoryCodeMap[category] || "OTH";

    // Generate random alphanumeric string (6 characters)
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomCode = "";
    for (let i = 0; i < 6; i++) {
      randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (!variant || variant.trim() === "") {
      return `${categoryCode}-${randomCode}`;
    }

    const colorCode = getColorCode(variant);
    return `${categoryCode}-${randomCode}-${colorCode}`;
  };

  // Only fetch if cache is empty or invalid
  useEffect(() => {
    const cachedProducts = getCachedData("products");
    if (!cachedProducts || !isCacheValid("products")) {
      fetchProducts();
    } else {
      setProducts(cachedProducts);
    }
    fetchCategories();
    fetchBrandPartners();
  }, []);

  const getSkuNumber = (sku = "") => {
    const matches = sku.match(/\d+/g);
    if (!matches || matches.length === 0) return -Infinity;
    return parseInt(matches[matches.length - 1], 10);
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by category
    if (filterCategory !== "All") {
      filtered = filtered.filter(
        (product) => product.category === filterCategory,
      );
    }

    // Filter by brand
    if (filterBrand !== "All") {
      filtered = filtered.filter(
        (product) => product.brandName === filterBrand,
      );
    }

    // Filter by status
    if (filterStatus !== "All") {
      filtered = filtered.filter((product) => {
        const reorderLevel = product.reorderNumber || 10;
        if (filterStatus === "In Stock") {
          return product.currentStock > reorderLevel;
        } else if (filterStatus === "Low Stock") {
          return (
            product.currentStock > 0 && product.currentStock <= reorderLevel
          );
        } else if (filterStatus === "Out of Stock") {
          return product.currentStock === 0;
        }
        return true;
      });
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.brandName &&
            product.brandName
              .toLowerCase()
              .includes(searchQuery.toLowerCase())),
      );
    }

    // Sort products
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "sku-new":
          return getSkuNumber(b.sku) - getSkuNumber(a.sku);
        case "sku-old":
          return getSkuNumber(a.sku) - getSkuNumber(b.sku);
        case "name":
          return a.itemName.localeCompare(b.itemName);
        case "price-low":
          return a.itemPrice - b.itemPrice;
        case "price-high":
          return b.itemPrice - a.itemPrice;
        case "stock-low":
          return a.currentStock - b.currentStock;
        case "stock-high":
          return b.currentStock - a.currentStock;
        case "date-new":
          return new Date(b.dateAdded) - new Date(a.dateAdded);
        case "date-old":
          return new Date(a.dateAdded) - new Date(b.dateAdded);
        default:
          return 0;
      }
    });

    const uniqueProducts = filtered.filter(
      (product, index, self) =>
        index === self.findIndex((p) => p._id === product._id),
    );

    return uniqueProducts;
  }, [
    products,
    filterCategory,
    filterBrand,
    filterStatus,
    searchQuery,
    sortBy,
  ]);

  const stockStats = useMemo(() => {
    const totalItems = products.length;
    const outOfStockItems = products.filter((p) => p.currentStock === 0).length;
    const lowStockItems = products.filter((p) => {
      const reorderLevel = p.reorderNumber || 10;
      return p.currentStock > 0 && p.currentStock <= reorderLevel;
    }).length;

    const inStockItems = products.filter((p) => {
      const reorderLevel = p.reorderNumber || 10;
      return p.currentStock > reorderLevel;
    }).length;
    return { totalItems, lowStockItems, outOfStockItems, inStockItems };
  }, [products]);

  const uniqueBrands = useMemo(() => {
    return [
      ...new Set(products.map((p) => p.brandName).filter(Boolean)),
    ].sort();
  }, [products]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [filteredProducts, currentPage, itemsPerPage]);
  const paginatedProductIds = useMemo(
    () => paginatedProducts.map((product) => product._id),
    [paginatedProducts],
  );
  const allVisibleSelected =
    paginatedProductIds.length > 0 &&
    paginatedProductIds.every((id) => selectedProductIds.includes(id));
  const someVisibleSelected = paginatedProductIds.some((id) =>
    selectedProductIds.includes(id),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, filterBrand, filterStatus, searchQuery, sortBy]);

  useEffect(() => {
    setSelectedProductIds((prev) =>
      prev.filter((id) =>
        filteredProducts.some((product) => product._id === id),
      ),
    );
  }, [filteredProducts]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.data);
        setCachedData("products", data.data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      alert(
        "Failed to fetch products. Make sure the backend server is running.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === "checkbox" ? checked : value;

    // Explicitly handle displayInTerminal checkbox
    if (name === "displayInTerminal" && type === "checkbox") {
      setNewProduct((prev) => ({
        ...prev,
        displayInTerminal: checked,
      }));
      return;
    }

    setNewProduct((prev) => {
      const updatedProduct = {
        ...prev,
        [name]: inputValue,
      };

      if (!editingProduct && (name === "category" || name === "variant")) {
        const category = name === "category" ? inputValue : prev.category;
        const variant = name === "variant" ? inputValue : prev.variant;
        updatedProduct.sku = generateSKU(category, variant);
      }

      return updatedProduct;
    });
  };

  const handleSizeToggle = (size) => {
    setNewProduct((prev) => {
      const isSelected = prev.selectedSizes.includes(size);
      const newSelectedSizes = isSelected
        ? prev.selectedSizes.filter((s) => s !== size)
        : [...prev.selectedSizes, size];

      const newSizeQuantities = { ...prev.sizeQuantities };
      const newSizePrices = { ...prev.sizePrices };
      if (isSelected) {
        delete newSizeQuantities[size];
        delete newSizePrices[size];
      } else {
        newSizeQuantities[size] = "";
        if (prev.differentPricesPerSize) {
          // Initialize with default price when adding a new size
          newSizePrices[size] = prev.itemPrice || "";
        }
      }

      return {
        ...prev,
        selectedSizes: newSelectedSizes,
        sizeQuantities: newSizeQuantities,
        sizePrices: newSizePrices,
      };
    });
  };

  const handleSizeQuantityChange = (size, quantity) => {
    setNewProduct((prev) => ({
      ...prev,
      sizeQuantities: {
        ...prev.sizeQuantities,
        [size]: parseInt(quantity) || 0,
      },
    }));
  };

  const handleSizePriceChange = (size, price) => {
    setNewProduct((prev) => ({
      ...prev,
      sizePrices: {
        ...prev.sizePrices,
        [size]: price,
      },
    }));
  };

  const resetProductForm = (clearStorage = true) => {
    const defaultCategory = "Tops";
    const defaultVariant = "";
    setNewProduct({
      sku: generateSKU(defaultCategory, defaultVariant),
      itemName: "",
      category: defaultCategory,
      brandName: "Default",
      variant: defaultVariant,
      size: "",
      itemPrice: "",
      costPrice: "",
      currentStock: "",
      reorderNumber: "",
      supplierName: "",
      supplierContact: "",
      itemImage: "",
      selectedSizes: [],
      sizeQuantities: {},
      sizePrices: {},
      differentPricesPerSize: false,
      foodSubtype: "",
      displayInTerminal: true,
    });
    setEditingProduct(null);

    // Clear localStorage draft when form is reset
    if (clearStorage) {
      try {
        localStorage.removeItem(ADD_PRODUCT_STORAGE_KEY);
      } catch (error) {
        console.error("Error clearing product draft from localStorage:", error);
      }
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();

    // Only validate stock/sizes when adding new product
    if (!editingProduct) {
      const hasSizeQuantities =
        newProduct.selectedSizes?.length > 0 &&
        Object.values(newProduct.sizeQuantities || {}).some((qty) => qty > 0);
      const hasStock = parseInt(newProduct.currentStock) > 0;

      if (!hasSizeQuantities && !hasStock) {
        alert(
          "Please either select sizes with quantities or provide a stock value.",
        );
        return;
      }

      // Check if any size has different prices per variant enabled
      const hasAnyVariantPricing = newProduct.selectedSizes?.some(
        (size) => newProduct.differentPricesPerVariant?.[size]
      );

      // Check if variant prices exist (they might be synced even if differentPricesPerVariant isn't yet)
      const hasVariantPrices = newProduct.variantPrices && 
        Object.keys(newProduct.variantPrices).length > 0 &&
        Object.values(newProduct.variantPrices).some(sizeVariants => 
          Object.values(sizeVariants || {}).some(price => price > 0)
        );

      // If we have variant prices filled in, skip global price validation
      if (hasAnyVariantPricing || hasVariantPrices) {
        // Variant pricing is being used - no global price needed
        // Just proceed to confirmation
        setShowConfirmModal(true);
        return;
      }

      // Validate size prices if different prices per size is enabled
      if (
        newProduct.differentPricesPerSize &&
        newProduct.selectedSizes?.length > 0
      ) {
        const invalidSizes = newProduct.selectedSizes.filter((size) => {
          const price = newProduct.sizePrices?.[size];
          return !price || price === "" || parseFloat(price) <= 0;
        });

        if (invalidSizes.length > 0) {
          alert(
            `Please enter prices for all selected sizes: ${invalidSizes.join(", ")}`,
          );
          return;
        }
      } else if (!newProduct.differentPricesPerSize) {
        // Only require itemPrice if different prices per size is not enabled
        if (!newProduct.itemPrice || parseFloat(newProduct.itemPrice) <= 0) {
          alert("Please enter a selling price.");
          return;
        }
      }

      setShowConfirmModal(true);
    } else {
      setProductToEdit(editingProduct);
      setShowEditModal(true);
    }
  };

  const confirmAddProduct = async () => {
    setShowConfirmModal(false);

    const totalStock =
      newProduct.selectedSizes?.length > 0
        ? Object.values(newProduct.sizeQuantities || {}).reduce(
            (sum, qty) => sum + (parseInt(qty) || 0),
            0,
          )
        : parseInt(newProduct.currentStock) || 0;

    try {
      setLoading(true);
      const url = editingProduct
        ? `${API_BASE_URL}/api/products/${editingProduct._id}`
        : `${API_BASE_URL}/api/products`;

      const method = editingProduct ? "PUT" : "POST";

      // Prepare payload - exclude sizes and stock when editing
      // Get default itemPrice - use first available price from various sources
      let defaultItemPrice = parseFloat(newProduct.itemPrice) || 0;
      
      // If no itemPrice, try to get from size prices
      if (!defaultItemPrice && newProduct.differentPricesPerSize && newProduct.selectedSizes?.length > 0) {
        const firstSizePrice = newProduct.sizePrices?.[newProduct.selectedSizes[0]];
        if (firstSizePrice) {
          defaultItemPrice = parseFloat(firstSizePrice) || 0;
        }
      }
      
      // If still no itemPrice, try to get from variant prices
      if (!defaultItemPrice && newProduct.variantPrices) {
        const firstSizeWithVariantPrices = Object.keys(newProduct.variantPrices)[0];
        if (firstSizeWithVariantPrices) {
          const firstVariantPrice = Object.values(newProduct.variantPrices[firstSizeWithVariantPrices])[0];
          if (firstVariantPrice) {
            defaultItemPrice = parseFloat(firstVariantPrice) || 0;
          }
        }
      }

      const payload = {
        ...newProduct,
        itemPrice: defaultItemPrice,
        costPrice: parseFloat(newProduct.costPrice) || 0,
        reorderNumber: parseInt(newProduct.reorderNumber) || 0,
        displayInTerminal: newProduct.displayInTerminal !== false,
      };

      // Only include stock and sizes when adding new product
      if (!editingProduct) {
        payload.currentStock = totalStock;
        if (newProduct.selectedSizes.length > 0) {
          // Check if we have variant quantities (quantity per variant per size)
          const hasVariantQuantities = newProduct.variantQuantities && 
            Object.keys(newProduct.variantQuantities).length > 0;
          
          // Check if we have variant prices (different prices per variant)
          const hasVariantPrices = newProduct.variantPrices && 
            Object.keys(newProduct.variantPrices).length > 0;

          // If different prices per size, include size prices in sizes object
          if (
            newProduct.differentPricesPerSize &&
            Object.keys(newProduct.sizePrices).length > 0
          ) {
            const sizesWithPrices = {};
            newProduct.selectedSizes.forEach((size) => {
              const sizePrice = parseFloat(newProduct.sizePrices[size]);

              // Determine variant value for this size
              let variantValue = "";
              if (newProduct.differentVariantsPerSize) {
                // Check if this size has multiple variants
                if (newProduct.multipleVariantsPerSize?.[size]) {
                  // Use array of variants
                  variantValue = newProduct.sizeMultiVariants?.[size] || [];
                } else {
                  // Use single variant
                  variantValue = newProduct.sizeVariants?.[size] || "";
                }
              } else {
                // Use global variant
                variantValue = newProduct.variant || "";
              }

              // If we have variant quantities, store them in the variants field
              if (hasVariantQuantities && newProduct.variantQuantities[size]) {
                sizesWithPrices[size] = {
                  quantity: Object.values(newProduct.variantQuantities[size]).reduce((sum, q) => sum + (parseInt(q) || 0), 0),
                  price: sizePrice || defaultItemPrice || 0,
                  variant: variantValue,
                  variants: newProduct.variantQuantities[size], // { "Blue": 5, "White": 7 }
                };
                // Add variant prices if different prices per variant is enabled for this size
                if (hasVariantPrices && newProduct.differentPricesPerVariant?.[size] && newProduct.variantPrices[size]) {
                  sizesWithPrices[size].variantPrices = newProduct.variantPrices[size]; // { "Blue": 100, "White": 120 }
                }
              } else {
                sizesWithPrices[size] = {
                  quantity: newProduct.sizeQuantities[size] || 0,
                  price: sizePrice || defaultItemPrice || 0,
                  variant: variantValue,
                };
              }
            });
            payload.sizes = sizesWithPrices;
          } else {
            // No different prices per size checkbox, but may have variants with inline prices
            const sizesObject = {};
            
            // Check if we have variant cost prices
            const hasVariantCostPrices = newProduct.variantCostPrices && 
              Object.keys(newProduct.variantCostPrices).length > 0;
            
            newProduct.selectedSizes.forEach((size) => {
              // Determine variant value for this size
              let variantValue = "";
              if (newProduct.differentVariantsPerSize) {
                // Check if this size has multiple variants
                if (newProduct.multipleVariantsPerSize?.[size]) {
                  // Use array of variants
                  variantValue = newProduct.sizeMultiVariants?.[size] || [];
                } else {
                  // Use single variant
                  variantValue = newProduct.sizeVariants?.[size] || "";
                }
              } else {
                // Use global variant
                variantValue = newProduct.variant || "";
              }

              // Get size price and cost price (from inline inputs in size div)
              const sizePrice = parseFloat(newProduct.sizePrices?.[size]) || 0;
              const sizeCostPrice = parseFloat(newProduct.sizeCostPrices?.[size]) || 0;

              // If we have variant quantities, store them in the variants field
              if (hasVariantQuantities && newProduct.variantQuantities[size]) {
                sizesObject[size] = {
                  quantity: Object.values(newProduct.variantQuantities[size]).reduce((sum, q) => sum + (parseInt(q) || 0), 0),
                  variant: variantValue,
                  variants: newProduct.variantQuantities[size], // { "Blue": 5, "White": 7 }
                };
                // Add variant prices if different prices per variant is enabled for this size
                if (hasVariantPrices && newProduct.differentPricesPerVariant?.[size] && newProduct.variantPrices[size]) {
                  sizesObject[size].variantPrices = newProduct.variantPrices[size]; // { "Blue": 100, "White": 120 }
                  // Add variant cost prices if available
                  if (hasVariantCostPrices && newProduct.variantCostPrices[size]) {
                    sizesObject[size].variantCostPrices = newProduct.variantCostPrices[size]; // { "Blue": 50, "White": 60 }
                  }
                } else {
                  // Use the inline size prices if no variant prices
                  if (sizePrice > 0) {
                    sizesObject[size].price = sizePrice;
                  }
                  if (sizeCostPrice > 0) {
                    sizesObject[size].costPrice = sizeCostPrice;
                  }
                }
              } else {
                sizesObject[size] = {
                  quantity: newProduct.sizeQuantities[size] || 0,
                  variant: variantValue,
                };
                // Include size prices if set
                if (sizePrice > 0) {
                  sizesObject[size].price = sizePrice;
                }
                if (sizeCostPrice > 0) {
                  sizesObject[size].costPrice = sizeCostPrice;
                }
              }
            });
            payload.sizes = sizesObject;
          }
        } else {
          payload.sizes = null;
        }
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 413) {
          alert(
            "Image file is too large. Please use a smaller image or compress it before uploading.",
          );
          return;
        }
        const errorText = await response.text();
        let errorMessage = `Failed to ${editingProduct ? "update" : "add"} product`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = `Server error (${response.status}): ${errorText.substring(0, 100)}`;
        }
        alert(errorMessage);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setShowAddModal(false);
        resetProductForm();
        fetchProducts();
        setSuccessMessage("The item was added successfully!");
        setShowSuccessModal(true);
      } else {
        alert(
          data.message ||
            `Failed to ${editingProduct ? "update" : "add"} product`,
        );
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert(
        "Failed to save product. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (product) => {
    setEditingProduct(product);

    const existingSizes = product.sizes ? Object.keys(product.sizes) : [];
    let existingSizeQuantities = {};
    let existingSizePrices = {};
    let hasDifferentPrices = false;

    // Check if sizes contain price information (object with quantity and price)
    if (product.sizes) {
      existingSizes.forEach((size) => {
        if (
          typeof product.sizes[size] === "object" &&
          product.sizes[size] !== null
        ) {
          existingSizeQuantities[size] = product.sizes[size].quantity || 0;
          if (product.sizes[size].price !== undefined) {
            existingSizePrices[size] = product.sizes[size].price;
            hasDifferentPrices = true;
          }
        } else {
          existingSizeQuantities[size] = product.sizes[size] || 0;
        }
      });
    }

    setNewProduct({
      sku: product.sku || "",
      itemName: product.itemName || "",
      category: product.category || "Tops",
      brandName: product.brandName || "Default",
      variant: product.variant || "",
      size: product.size || "",
      itemPrice: product.itemPrice || "",
      costPrice: product.costPrice || "",
      currentStock: product.currentStock || "",
      reorderNumber: product.reorderNumber || "",
      supplierName: product.supplierName || "",
      supplierContact: product.supplierContact || "",
      itemImage: product.itemImage || "",
      selectedSizes: existingSizes,
      sizeQuantities: existingSizeQuantities,
      sizePrices: existingSizePrices,
      differentPricesPerSize: hasDifferentPrices,
      foodSubtype: product.foodSubtype || "",
      displayInTerminal:
        product.displayInTerminal !== undefined
          ? product.displayInTerminal
          : true,
    });

    setShowAddModal(true);
  };

  const confirmEditProduct = async () => {
    setShowEditModal(false);

    if (!editingProduct) return;

    try {
      setLoading(true);
      const url = `${API_BASE_URL}/api/products/${editingProduct._id}`;

      // Prepare payload - exclude sizes and stock when editing
      // Ensure displayInTerminal is explicitly set: true = show in terminal, false = don't show
      // Explicitly handle the boolean value - if it's explicitly false, use false, otherwise default to true
      const displayInTerminalValue =
        newProduct.displayInTerminal === false ? false : true;

      const payload = {
        ...newProduct,
        itemPrice: parseFloat(newProduct.itemPrice) || 0,
        costPrice: parseFloat(newProduct.costPrice) || 0,
        reorderNumber: parseInt(newProduct.reorderNumber) || 0,
        displayInTerminal: displayInTerminalValue,
      };

      console.log(
        "[confirmEditProduct] newProduct.displayInTerminal:",
        newProduct.displayInTerminal,
      );
      console.log(
        "[confirmEditProduct] Sending displayInTerminal:",
        payload.displayInTerminal,
      );

      // Remove stock and size-related fields from payload
      delete payload.currentStock;
      delete payload.sizes;
      delete payload.selectedSizes;
      delete payload.sizeQuantities;
      delete payload.sizePrices;
      delete payload.differentPricesPerSize;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 413) {
          alert(
            "Image file is too large. Please use a smaller image or compress it before uploading.",
          );
          return;
        }
        const errorText = await response.text();
        let errorMessage = "Failed to update product";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          // Include detailed error if available
          if (errorData.error && errorData.error !== errorData.message) {
            errorMessage += `: ${errorData.error}`;
          }
        } catch (e) {
          errorMessage = `Server error (${response.status}): ${errorText.substring(0, 100)}`;
        }
        console.error("Product update error:", errorMessage);
        alert(errorMessage);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setShowAddModal(false);
        resetProductForm();
        invalidateCache("products");
        fetchProducts();
        setSuccessMessage("The item was edited successfully!");
        setShowSuccessModal(true);
        setProductToEdit(null);
      } else {
        alert(data.message || "Failed to update product");
      }
    } catch (error) {
      console.error("Error updating product:", error);
      alert(
        "Failed to update product. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleViewProduct = async (product) => {
    setViewingProduct(product);
    setShowViewModal(true);

    // Fetch full product details (including sizes) in the background
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${product._id}`,
      );
      const data = await response.json();
      if (data.success && data.data) {
        setViewingProduct(data.data);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    }
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product._id);
    setShowDeleteModal(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setShowDeleteModal(false);

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/products/${productToDelete}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (data.success) {
        setShowSuccessModal(true);
        setSuccessMessage("The item was deleted successfully!");
        invalidateCache("products");
        fetchProducts();
      } else {
        alert(data.message || "Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      alert("Failed to delete product. Please try again.");
    } finally {
      setLoading(false);
      setProductToDelete(null);
    }
  };

  const handleStockUpdate = async (product, type) => {
    setEditingProduct(product);
    setStockModalType(type);
    setStockAmount("");
    setShowStockModal(true);
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();

    if (!stockAmount || parseInt(stockAmount) <= 0) {
      alert("Please enter a valid quantity");
      return;
    }

    try {
      setLoading(true);
      const amount = parseInt(stockAmount);
      const newStock =
        stockModalType === "in"
          ? editingProduct.currentStock + amount
          : Math.max(0, editingProduct.currentStock - amount);

      // Don't explicitly set displayInTerminal - let backend auto-update it based on stock
      // Backend will set it to false if stock reaches 0
      const response = await fetch(
        `${API_BASE_URL}/api/products/${editingProduct._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentStock: newStock,
          }),
        },
      );

      const data = await response.json();

      if (data.success) {
        alert(
          `Stock ${stockModalType === "in" ? "added" : "removed"} successfully!`,
        );
        setShowStockModal(false);
        setEditingProduct(null);
        setStockAmount("");
        invalidateCache("products");
        fetchProducts();
      } else {
        alert(data.message || "Failed to update stock");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStockInConfirm = async (stockData) => {
    if (!editingProduct) return;

    try {
      setLoading(true);

      // Get current user info
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}",
      );
      const handledBy =
        currentUser.name ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
        "System";
      const handledById = currentUser._id || currentUser.id || "";

      let response;

      if (stockData.noSizes) {
        // Product without sizes - simple quantity update
        const newStock =
          (editingProduct.currentStock || 0) + stockData.quantity;

        response = await fetch(
          `${API_BASE_URL}/api/products/${editingProduct._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentStock: newStock,
              stockMovementType: "Stock-In",
              stockMovementReason: stockData.reason || "Restock",
              handledBy: handledBy,
              handledById: handledById,
            }),
          },
        );
      } else {
        // Product with sizes
        const updatedSizes = { ...(editingProduct.sizes || {}) };

        // Helper to get quantity from size data
        const getSizeQty = (sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined
          ) {
            return sizeData.quantity;
          }
          return typeof sizeData === "number" ? sizeData : 0;
        };

        // Helper to get price from size data
        const getSizePrice = (sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.price !== undefined
          ) {
            return sizeData.price;
          }
          return null;
        };

        // Check if we're adding stock with variant quantities
        if (stockData.hasVariants && stockData.variantQuantities) {
          // Update variant quantities for each size
          stockData.selectedSizes.forEach((size) => {
            const currentSizeData = updatedSizes[size] || {};
            const currentVariants = (typeof currentSizeData === "object" && currentSizeData.variants) || {};
            const currentVariantPrices = (typeof currentSizeData === "object" && currentSizeData.variantPrices) || {};
            const addVariantQtys = stockData.variantQuantities[size] || {};
            
            // Helper to get current variant quantity (handles both number and object formats)
            const getVariantQty = (variantData) => {
              if (typeof variantData === "number") return variantData;
              if (typeof variantData === "object" && variantData !== null) {
                return variantData.quantity || 0;
              }
              return 0;
            };
            
            // Create new variants object with updated quantities
            const newVariants = { ...currentVariants };
            const newVariantPrices = { ...currentVariantPrices };
            
            Object.entries(addVariantQtys).forEach(([variant, addQty]) => {
              if (addQty > 0) {
                const currentQty = getVariantQty(newVariants[variant]);
                // Always store as a simple number for consistency
                newVariants[variant] = currentQty + addQty;
                
                // Add prices for new variants if provided
                if (stockData.newVariantPrices && stockData.newVariantPrices[variant]) {
                  newVariantPrices[variant] = stockData.newVariantPrices[variant].price || editingProduct.itemPrice || 0;
                }
              }
            });

            // Calculate new total quantity for this size
            const newTotalQty = Object.values(newVariants).reduce(
              (sum, v) => sum + getVariantQty(v), 0
            );

            updatedSizes[size] = {
              ...currentSizeData,
              quantity: newTotalQty,
              variants: newVariants,
              variantPrices: Object.keys(newVariantPrices).length > 0 ? newVariantPrices : currentSizeData.variantPrices,
            };
          });
        } else {
          // Standard size-only stock in (no variants)
          stockData.selectedSizes.forEach((size) => {
            const currentSizeData = updatedSizes[size];
            const currentQty = getSizeQty(currentSizeData);
            const currentPrice = getSizePrice(currentSizeData);
            const addQty = stockData.sizes[size] || 0;
            const newQty = currentQty + addQty;

            // Preserve price structure if it exists
            if (
              currentPrice !== null ||
              (typeof currentSizeData === "object" && currentSizeData !== null)
            ) {
              updatedSizes[size] = {
                ...currentSizeData,
                quantity: newQty,
                price:
                  currentPrice !== null
                    ? currentPrice
                    : editingProduct.itemPrice || 0,
              };
            } else {
              updatedSizes[size] = newQty;
            }
          });
        }

        const totalStock = Object.values(updatedSizes).reduce(
          (sum, sizeData) => sum + getSizeQty(sizeData),
          0,
        );

        // Calculate size quantities that were added
        const sizeQuantitiesAdded = {};
        if (stockData.hasVariants && stockData.variantQuantities) {
          stockData.selectedSizes.forEach((size) => {
            const variantQtys = stockData.variantQuantities[size] || {};
            const totalForSize = Object.values(variantQtys).reduce((sum, q) => sum + (parseInt(q) || 0), 0);
            if (totalForSize > 0) {
              sizeQuantitiesAdded[size] = totalForSize;
            }
          });
        } else {
          stockData.selectedSizes.forEach((size) => {
            const addQty = stockData.sizes[size] || 0;
            if (addQty > 0) {
              sizeQuantitiesAdded[size] = addQty;
            }
          });
        }

        response = await fetch(
          `${API_BASE_URL}/api/products/${editingProduct._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentStock: totalStock,
              sizes: updatedSizes,
              stockMovementType: "Stock-In",
              stockMovementReason: stockData.reason || "Restock",
              handledBy: handledBy,
              handledById: handledById,
              stockMovementSizeQuantities:
                Object.keys(sizeQuantitiesAdded).length > 0
                  ? sizeQuantitiesAdded
                  : null,
            }),
          },
        );
      }

      const data = await response.json();

      if (data.success) {
        setShowStockModal(false);
        setEditingProduct(null);
        setStockAmount("");
        setSuccessMessage("Stock added successfully!");
        setShowSuccessModal(true);
        invalidateCache("products");
        fetchProducts();
      } else {
        alert(data.message || "Failed to update stock");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStockOutConfirm = async (stockData) => {
    if (!editingProduct) return;

    try {
      setLoading(true);

      // Get current user info
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}",
      );
      const handledBy =
        currentUser.name ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
        "System";
      const handledById = currentUser._id || currentUser.id || "";

      // Determine type based on reason
      const movementType =
        stockData.reason === "Damaged" ||
        stockData.reason === "Lost" ||
        stockData.reason === "Expired"
          ? "Pull-Out"
          : "Stock-Out";

      let response;
      let sizeQuantitiesRemoved = {};
      let totalQuantityRemoved = 0;

      if (stockData.noSizes) {
        // Product without sizes - simple quantity update
        const newStock = Math.max(
          0,
          (editingProduct.currentStock || 0) - stockData.quantity,
        );
        totalQuantityRemoved = stockData.quantity;

        response = await fetch(
          `${API_BASE_URL}/api/products/${editingProduct._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentStock: newStock,
              stockMovementType: movementType,
              stockMovementReason: stockData.reason || "Sold",
              handledBy: handledBy,
              handledById: handledById,
            }),
          },
        );
      } else {
        // Product with sizes
        const updatedSizes = { ...(editingProduct.sizes || {}) };

        // Helper to get quantity from size data
        const getSizeQty = (sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined
          ) {
            return sizeData.quantity;
          }
          return typeof sizeData === "number" ? sizeData : 0;
        };

        // Helper to get price from size data
        const getSizePrice = (sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.price !== undefined
          ) {
            return sizeData.price;
          }
          return null;
        };

        // Check if we're removing stock with variant quantities
        if (stockData.hasVariants && stockData.variantQuantities) {
          // Update variant quantities for each size
          stockData.selectedSizes.forEach((size) => {
            const currentSizeData = updatedSizes[size] || {};
            const currentVariants = (typeof currentSizeData === "object" && currentSizeData.variants) || {};
            const removeVariantQtys = stockData.variantQuantities[size] || {};
            
            // Helper to get current variant quantity (handles both number and object formats)
            const getVariantQty = (variantData) => {
              if (typeof variantData === "number") return variantData;
              if (typeof variantData === "object" && variantData !== null) {
                return variantData.quantity || 0;
              }
              return 0;
            };
            
            // Create new variants object with updated quantities
            const newVariants = { ...currentVariants };
            Object.entries(removeVariantQtys).forEach(([variant, removeQty]) => {
              if (removeQty > 0 && newVariants[variant] !== undefined) {
                const currentQty = getVariantQty(newVariants[variant]);
                // Always store as a simple number for consistency
                newVariants[variant] = Math.max(0, currentQty - removeQty);
              }
            });

            // Calculate new total quantity for this size
            const newTotalQty = Object.values(newVariants).reduce(
              (sum, v) => sum + getVariantQty(v), 0
            );

            updatedSizes[size] = {
              ...currentSizeData,
              quantity: newTotalQty,
              variants: newVariants,
            };
          });

          // Calculate removed quantities for stock movement
          stockData.selectedSizes.forEach((size) => {
            const variantQtys = stockData.variantQuantities[size] || {};
            const totalForSize = Object.values(variantQtys).reduce((sum, q) => sum + (parseInt(q) || 0), 0);
            if (totalForSize > 0) {
              sizeQuantitiesRemoved[size] = totalForSize;
              totalQuantityRemoved += totalForSize;
            }
          });
        } else {
          // Standard size-only stock out (no variants)
          stockData.selectedSizes.forEach((size) => {
            const currentSizeData = updatedSizes[size];
            const currentQty = getSizeQty(currentSizeData);
            const currentPrice = getSizePrice(currentSizeData);
            const removeQty = stockData.sizes[size] || 0;
            const newQty = Math.max(0, currentQty - removeQty);

            // Preserve price structure if it exists
            if (
              currentPrice !== null ||
              (typeof currentSizeData === "object" && currentSizeData !== null)
            ) {
              updatedSizes[size] = {
                ...currentSizeData,
                quantity: newQty,
                price:
                  currentPrice !== null
                    ? currentPrice
                    : editingProduct.itemPrice || 0,
              };
            } else {
              updatedSizes[size] = newQty;
            }
          });

          // Calculate size quantities that were removed
          stockData.selectedSizes.forEach((size) => {
            const removeQty = stockData.sizes[size] || 0;
            if (removeQty > 0) {
              sizeQuantitiesRemoved[size] = removeQty;
              totalQuantityRemoved += removeQty;
            }
          });
        }

        const totalStock = Object.values(updatedSizes).reduce(
          (sum, sizeData) => sum + getSizeQty(sizeData),
          0,
        );

        response = await fetch(
          `${API_BASE_URL}/api/products/${editingProduct._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentStock: totalStock,
              sizes: updatedSizes,
              stockMovementType: movementType,
              stockMovementReason: stockData.reason || "Sold",
              handledBy: handledBy,
              handledById: handledById,
              stockMovementSizeQuantities:
                Object.keys(sizeQuantitiesRemoved).length > 0
                  ? sizeQuantitiesRemoved
                  : null,
            }),
          },
        );
      }

      const data = await response.json();

      if (data.success) {
        // Archive items if reason is Damaged, Defective, or Expired
        const archiveReasons = ["Damaged", "Defective", "Expired"];
        if (archiveReasons.includes(stockData.reason)) {
          // Create archive entries
          const sizesString = stockData.selectedSizes
            ? stockData.selectedSizes.join(", ")
            : "";

          try {
            await fetch(`${API_BASE_URL}/api/archive`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                productId: editingProduct._id,
                itemName: editingProduct.itemName,
                sku: editingProduct.sku,
                variant: editingProduct.variant || "",
                selectedSize: sizesString,
                category: editingProduct.category,
                brandName: editingProduct.brandName || "",
                itemPrice: editingProduct.itemPrice || 0,
                costPrice: editingProduct.costPrice || 0,
                quantity: totalQuantityRemoved,
                itemImage: editingProduct.itemImage || "",
                reason:
                  stockData.reason === "Defective"
                    ? "Defective"
                    : stockData.reason,
                archivedBy: handledBy,
                archivedById: handledById,
                source: "stock-out",
                notes: `Stock out - ${stockData.reason}. Sizes: ${sizesString}`,
              }),
            });
          } catch (archiveError) {
            console.error("Error archiving item:", archiveError);
            // Don't fail the whole operation if archiving fails
          }
        }

        setShowStockModal(false);
        setEditingProduct(null);
        setStockAmount("");
        setSuccessMessage("Stock removed successfully!");
        setShowSuccessModal(true);
        invalidateCache("products");
        fetchProducts();
      } else {
        alert(data.message || "Failed to update stock");
      }
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStockStatus = (currentStock, reorderNumber = 10) => {
    if (currentStock === 0) {
      return { label: "Out of Stock", color: "bg-red-100 text-red-700" };
    } else if (currentStock <= reorderNumber) {
      return { label: "Low Stock", color: "bg-yellow-100 text-yellow-700" };
    } else {
      return { label: "In Stock", color: "bg-green-100 text-green-700" };
    }
  };

  const formatCsvValue = (value) => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch (error) {
        return "";
      }
    }
    return String(value);
  };

  const handleToggleProductSelection = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const handleToggleSelectAllVisible = () => {
    setSelectedProductIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !paginatedProductIds.includes(id));
      }
      const merged = new Set(prev);
      paginatedProductIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  };

  const handleExportButtonClick = () => {
    // Export all products automatically without requiring selection
    handleExportToCSV();
  };

  const handleCancelExportSelection = () => {
    setIsExportSelectionMode(false);
    setSelectedProductIds([]);
  };

  const handleExportToCSV = () => {
    try {
      // Export all filtered products automatically (no selection required)
      // If user has selected specific products, export those; otherwise export all filtered products
      const productsToExport =
        selectedProductIds.length > 0
          ? filteredProducts.filter((product) =>
              selectedProductIds.includes(product._id),
            )
          : filteredProducts;

      if (productsToExport.length === 0) {
        alert("No products to export.");
        return;
      }

      // Fields to exclude from export
      const excludedFields = ["__v"];

      const dynamicFields = new Set();
      productsToExport.forEach((product) => {
        Object.keys(product || {}).forEach((key) => {
          // Exclude SKU and other internal fields
          if (!excludedFields.includes(key)) {
            dynamicFields.add(key);
          }
        });
      });

      // Filter out excluded fields from preferred order
      const filteredPreferredOrder = preferredExportFieldOrder.filter(
        (field) => !excludedFields.includes(field),
      );

      const orderedFields = filteredPreferredOrder.filter((field) =>
        dynamicFields.has(field),
      );
      const remainingFields = Array.from(dynamicFields)
        .filter((field) => !orderedFields.includes(field))
        .sort();
      const headers = [...orderedFields, ...remainingFields, "stockStatus"];

      const rows = productsToExport.map((product) => {
        const status = getStockStatus(
          product.currentStock,
          product.reorderNumber,
        );
        return headers.map((field) => {
          if (field === "stockStatus") {
            return status.label;
          }
          const value =
            field === "dateAdded" || field === "lastUpdated"
              ? formatDate(product[field])
              : product[field];
          return formatCsvValue(value);
        });
      });

      // Convert field names to human-readable headers
      const humanReadableHeaders = headers.map(
        (field) => fieldToHeaderMap[field] || field,
      );

      // Convert to CSV format
      const csvContent = [
        humanReadableHeaders.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              // Escape cells that contain commas, quotes, or newlines
              const cellStr = String(cell ?? "");
              if (
                cellStr.includes(",") ||
                cellStr.includes('"') ||
                cellStr.includes("\n")
              ) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            })
            .join(","),
        ),
      ].join("\n");

      // Create blob and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `inventory_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert(`${productsToExport.length} products exported successfully!`);
      setIsExportSelectionMode(false);
      setSelectedProductIds([]);
    } catch (error) {
      console.error("Error exporting inventory:", error);
      alert("Failed to export inventory. Please try again.");
    }
  };

  const handleImportFromCSV = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length < 2) {
        alert("CSV file is empty or invalid");
        return;
      }

      // Parse CSV
      const headers = lines[0]
        .split(",")
        .map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        try {
          // Parse CSV row (handle quoted values)
          const values = [];
          let currentValue = "";
          let insideQuotes = false;

          for (let char of rows[i]) {
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === "," && !insideQuotes) {
              values.push(currentValue.trim().replace(/^"|"$/g, ""));
              currentValue = "";
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^"|"$/g, ""));

          // Map values to product object
          const sizesValue = values[headers.indexOf("Sizes")] || "";
          let parsedSizes = null;

          // Try to parse sizes JSON
          if (sizesValue && sizesValue.trim() !== "") {
            try {
              parsedSizes = JSON.parse(sizesValue);
            } catch (e) {
              console.warn("Failed to parse sizes JSON:", e);
            }
          }

          // Get SKU from CSV if available, otherwise let backend auto-generate
          const skuFromCsv = values[headers.indexOf("SKU")]?.trim();

          const product = {
            itemName: values[headers.indexOf("Item Name")] || "",
            category: values[headers.indexOf("Category")] || "Foods",
            brandName: values[headers.indexOf("Brand")] || "Default",
            variant: values[headers.indexOf("Variant")] || "",
            itemPrice: parseFloat(values[headers.indexOf("Item Price")]) || 0,
            costPrice: parseFloat(values[headers.indexOf("Cost Price")]) || 0,
            currentStock:
              parseInt(values[headers.indexOf("Current Stock")]) || 0,
            reorderNumber:
              parseInt(values[headers.indexOf("Reorder Level")]) || 10,
            supplierName: values[headers.indexOf("Supplier Name")] || "",
            supplierContact: values[headers.indexOf("Supplier Contact")] || "",
            itemImage: values[headers.indexOf("Image URL")] || "",
            sizes: parsedSizes,
          };

          // Only include SKU if it exists in CSV
          if (skuFromCsv) {
            product.sku = skuFromCsv;
          }

          // Validate required fields
          if (!product.itemName || !product.itemPrice) {
            errors.push(
              `Row ${i + 2}: Missing required fields (Item Name or Price)`,
            );
            errorCount++;
            continue;
          }

          // Send to backend
          const response = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(product),
          });

          const data = await response.json();

          if (data.success) {
            successCount++;
          } else {
            errors.push(`Row ${i + 2}: ${data.message}`);
            errorCount++;
          }
        } catch (rowError) {
          errors.push(`Row ${i + 2}: ${rowError.message}`);
          errorCount++;
        }
      }

      // Show results in modal
      setImportResult({ successCount, errorCount, errors });
      setShowImportResultModal(true);

      // Refresh products list
      if (successCount > 0) {
        invalidateCache("products");
        fetchProducts();
      }

      // Reset file input
      event.target.value = "";
    } catch (error) {
      console.error("Error importing CSV:", error);
      alert(
        "Failed to import CSV file. Please check the file format and try again.",
      );
      event.target.value = "";
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-8 min-h-screen ${theme === "dark" ? "bg-[#1E1B18]" : "bg-[#F5F5F5]"}`}
    >
      <Header pageName="Product & Stocks" showBorder={false} />

      <div className="mb-6 mt-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex gap-4 flex-wrap">
          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500"></div>
            <div className="ml-2">
              <div className="text-3xl font-bold text-blue-500">
                {stockStats.totalItems.toLocaleString()}
              </div>
              <div className="text-xs text-blue-400 mt-0.5">Total Items</div>
            </div>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-500"></div>
            <div className="ml-2">
              <div className="text-3xl font-bold text-green-500">
                {stockStats.inStockItems.toLocaleString()}
              </div>
              <div className="text-xs text-green-400 mt-0.5">In Stock</div>
            </div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-orange-500"></div>
            <div className="ml-2">
              <div className="text-3xl font-bold text-orange-500">
                {stockStats.lowStockItems}
              </div>
              <div className="text-xs text-orange-400 mt-0.5">Low Stock</div>
            </div>
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-orange-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500"></div>
            <div className="ml-2">
              <div className="text-3xl font-bold text-red-500">
                {stockStats.outOfStockItems}
              </div>
              <div className="text-xs text-red-400 mt-0.5">Out-of-Stock</div>
            </div>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleExportButtonClick}
            className={`rounded-2xl shadow-md flex flex-col items-center justify-center px-5 py-4 transition-colors ${
              isExportSelectionMode
                ? "border border-[#AD7F65] bg-[#AD7F65]/5"
                : theme === "dark"
                  ? "bg-[#2A2724] hover:bg-[#352F2A]"
                  : "bg-white hover:bg-gray-50"
            }`}
            style={{ minWidth: "100px" }}
          >
            <svg
              className={`w-8 h-8 mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <div
              className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
            >
              {isExportSelectionMode ? "Export Selected" : "Export"}
            </div>
          </button>
          {isExportSelectionMode && (
            <button
              onClick={handleCancelExportSelection}
              className={`rounded-2xl shadow-md px-4 py-2 text-xs font-medium border transition-colors ${
                theme === "dark"
                  ? "bg-[#2A2724] border-gray-600 text-gray-400 hover:bg-[#352F2A]"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              Cancel
            </button>
          )}

          <button
            onClick={() => document.getElementById("csv-file-input").click()}
            className={`rounded-2xl shadow-md flex flex-col items-center justify-center px-5 py-4 transition-colors ${
              theme === "dark"
                ? "bg-[#2A2724] hover:bg-[#352F2A]"
                : "bg-white hover:bg-gray-50"
            }`}
            style={{ minWidth: "100px" }}
          >
            <svg
              className={`w-8 h-8 mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div
              className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
            >
              Import
            </div>
          </button>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleImportFromCSV}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="relative" style={{ width: "300px" }}>
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search For..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-10 pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${
                theme === "dark"
                  ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500"
                  : "bg-white border-gray-300"
              }`}
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${
              theme === "dark"
                ? "bg-[#2A2724] border-gray-600 text-white"
                : "bg-white border-gray-300"
            }`}
          >
            <option value="All">By Category</option>
            {categories
              .filter((c) => c.name !== "All")
              .map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
          </select>

          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${
              theme === "dark"
                ? "bg-[#2A2724] border-gray-600 text-white"
                : "bg-white border-gray-300"
            }`}
          >
            <option value="All">By Brand</option>
            {uniqueBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${
              theme === "dark"
                ? "bg-[#2A2724] border-gray-600 text-white"
                : "bg-white border-gray-300"
            }`}
          >
            <option value="All">By Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${
              theme === "dark"
                ? "bg-[#2A2724] border-gray-600 text-white"
                : "bg-white border-gray-300"
            }`}
          >
            <option value="sku-new">SKU: Newest First</option>
            <option value="sku-old">SKU: Oldest First</option>
            <option value="name">Sort By Name</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="stock-low">Stock: Low to High</option>
            <option value="stock-high">Stock: High to Low</option>
            <option value="date-new">Date: Newest First</option>
            <option value="date-old">Date: Oldest First</option>
          </select>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              resetProductForm();
              setShowAddModal(true);
            }}
            className="px-6 py-2 text-white rounded-lg hover:opacity-90 flex items-center gap-2 font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            }}
          >
            <FaPlus /> Add New Item
          </button>
        </div>
      </div>

      <ProductTable
        loading={loading}
        filteredProducts={paginatedProducts}
        handleEditProduct={handleEditClick}
        handleDeleteProduct={handleDeleteClick}
        handleViewProduct={handleViewProduct}
        handleStockUpdate={handleStockUpdate}
        selectedProductIds={selectedProductIds}
        onToggleSelect={handleToggleProductSelection}
        onToggleSelectAll={handleToggleSelectAllVisible}
        showSelection={isExportSelectionMode}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
      />

      {filteredProducts.length >= itemsPerPage && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredProducts.length / itemsPerPage)}
          onPageChange={setCurrentPage}
        />
      )}

      <AddProductModal
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        editingProduct={editingProduct}
        setEditingProduct={setEditingProduct}
        newProduct={newProduct}
        setNewProduct={setNewProduct}
        handleAddProduct={handleAddProduct}
        handleInputChange={handleInputChange}
        handleSizeToggle={handleSizeToggle}
        handleSizeQuantityChange={handleSizeQuantityChange}
        handleSizePriceChange={handleSizePriceChange}
        resetProductForm={resetProductForm}
        loading={loading}
        categories={categories}
        brandPartners={brandPartners}
      />

      <ConfirmAddProductModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmAddProduct}
        productName={newProduct.itemName}
        onCategoryAdd={fetchCategories}
        onBrandAdd={fetchBrandPartners}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage || "The item was added successfully!"}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDeleteProduct}
        itemName={
          productToDelete
            ? filteredProducts.find((p) => p._id === productToDelete)?.itemName
            : ""
        }
      />

      <EditConfirmationModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setProductToEdit(null);
        }}
        onConfirm={confirmEditProduct}
        itemName={productToEdit?.itemName || editingProduct?.itemName || ""}
      />

      <ViewProductModal
        showViewModal={showViewModal}
        setShowViewModal={setShowViewModal}
        viewingProduct={viewingProduct}
        formatDate={formatDate}
      />

      {showStockModal && stockModalType === "in" && (
        <StockInModal
          isOpen={showStockModal}
          onClose={() => {
            setShowStockModal(false);
            setEditingProduct(null);
            setStockAmount("");
          }}
          product={editingProduct}
          onConfirm={handleStockInConfirm}
          loading={loading}
        />
      )}

      {showStockModal && stockModalType === "out" && (
        <StockOutModal
          isOpen={showStockModal}
          onClose={() => {
            setShowStockModal(false);
            setEditingProduct(null);
            setStockAmount("");
          }}
          product={editingProduct}
          onConfirm={handleStockOutConfirm}
          loading={loading}
        />
      )}

      {showImportResultModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#2D2D2D] rounded-2xl w-full max-w-2xl p-8 text-white shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">localhost:5173 says</h2>
            <div className="space-y-4 mb-6">
              <p className="text-lg">Import completed!</p>
              <div className="space-y-2">
                <p>Successful: {importResult.successCount}</p>
                <p>Failed: {importResult.errorCount}</p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2">Showing first 5 errors:</p>
                  <div className="bg-black/30 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((error, idx) => (
                      <p key={idx} className="text-sm mb-1">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowImportResultModal(false)}
                className="px-8 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Inventory);
