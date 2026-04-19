import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ArchiveConfirmationModal from "../components/inventory/ArchiveConfirmationModal";
import EditConfirmationModal from "../components/inventory/EditConfirmationModal";
import Pagination from "../components/inventory/Pagination";
import ProductTable from "../components/inventory/ProductTable";
import StockInModal from "../components/inventory/StockInModal";
import StockOutModal from "../components/inventory/StockOutModal";
import SuccessModal from "../components/inventory/SuccessModal";
import ViewProductModal from "../components/inventory/ViewProductModal";

// Variant-only products use size key "__VARIANT_ONLY__" in AddProductModal — sizesList is built from variantQuantities keys.

const sumAllVariantQuantities = (variantQuantities) => {
  if (!variantQuantities || typeof variantQuantities !== "object") return 0;
  return Object.values(variantQuantities).reduce((sum, perSize) => {
    if (!perSize || typeof perSize !== "object") return sum;
    return sum + Object.values(perSize).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
  }, 0);
};

const hasAnyOpeningStockInForm = (np) => {
  if (!np) return false;
  const hasSizeQuantities =
    np.selectedSizes?.length > 0 &&
    Object.values(np.sizeQuantities || {}).some((qty) => parseInt(qty, 10) > 0);
  const hasStock = parseInt(np.currentStock, 10) > 0;
  const hasVariantQuantities =
    np.variantQuantities &&
    Object.keys(np.variantQuantities).length > 0 &&
    Object.values(np.variantQuantities).some(
      (sizeVariants) =>
        sizeVariants &&
        typeof sizeVariants === "object" &&
        Object.values(sizeVariants).some((qty) => parseInt(qty, 10) > 0)
    );
  return hasSizeQuantities || hasVariantQuantities || hasStock;
};

const preferredExportFieldOrder = [
  "_id",
  "sku",
  "itemName",
  "category",
  "subCategory",
  "brandName",
  "variant",
  "itemPrice",
  "costPrice",
  "currentStock",
  "unitOfMeasure",
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
  "updatedAt"];



const fieldToHeaderMap = {
  _id: "ID",
  sku: "SKU",
  itemName: "Item Name",
  category: "Category",
  subCategory: "SubCategory",
  brandName: "Brand",
  variant: "Variant",
  itemPrice: "Item Price",
  costPrice: "Cost Price",
  currentStock: "Current Stock",
  unitOfMeasure: "Unit of Measure",
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
  stockStatus: "Stock Status"
};

const ADD_PRODUCT_STORAGE_KEY = "addProductFormDraft";

const Inventory = () => {
  const { theme } = useTheme();
  const { cache, getCachedData, setCachedData, isCacheValid, invalidateCache } =
    useDataCache();
  const [products, setProducts] = useState(
    () => getCachedData("products") || []
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const productsListFetchGenRef = useRef(0);
  const productsListLoadingDepthRef = useRef(0);

  const adjustInventoryProductsLoading = (delta) => {
    productsListLoadingDepthRef.current += delta;
    if (productsListLoadingDepthRef.current < 0) {
      productsListLoadingDepthRef.current = 0;
    }
    setLoading(productsListLoadingDepthRef.current > 0);
  };
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
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [productToArchive, setProductToArchive] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [sortBy, setSortBy] = useState("sku-new");
  const [showImportResultModal, setShowImportResultModal] = useState(false);
  const [importResult, setImportResult] = useState({
    successCount: 0,
    errorCount: 0,
    errors: []
  });
  const itemsPerPage = 6;
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isExportSelectionMode, setIsExportSelectionMode] = useState(false);

  const defaultProductState = {
    sku: "",
    itemName: "",
    category: "",
    subCategory: "",
    unitOfMeasure: "pcs",
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
    foodSubtype: "",
    displayInTerminal: true,
    expirationDate: "",
    expirationThresholdDays: "",
    dateReceived: ""
  };


  const [newProduct, setNewProduct] = useState(() => {
    try {
      const savedDraft = localStorage.getItem(ADD_PRODUCT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);

        return { ...defaultProductState, ...parsed };
      }
    } catch (error) {
      console.error("Error loading product draft from localStorage:", error);
    }
    return defaultProductState;
  });

  const [selectedMainCategory, setSelectedMainCategory] = useState("All");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");

  const defaultCategories = [
    { name: "All", icon: allIcon }
  ];

  const categoryStructureOptions = [
    "Tops", "Bottoms", "Dresses", "Outerwear",
    "Beverages", "Snacks", "Meals", "Desserts", "Ingredients", "Other",
    "Face", "Eyes", "Lips", "Nails", "SkinCare", "Others",
    "Jewelry", "Bags", "Head Wear", "Glasses/Sunglasses", 
    "Sneakers", "Boots", "Sandals", 
    "Daily Essentials", "Personal Care", "Home Essentials"
  ];

  const categoryStructure = {
    "Apparel - Men": ["Tops", "Bottoms", "Outerwear"],
    "Apparel - Women": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Apparel - Kids": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Apparel - Unisex": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Foods": ["Beverages", "Snacks", "Meals", "Desserts", "Ingredients", "Other"],
    "Makeup": ["Face", "Eyes", "Lips", "Nails", "SkinCare", "Others"],
    "Accessories": ["Jewelry", "Bags", "Head Wear", "Glasses/Sunglasses", "Others"],
    "Shoes": ["Sneakers", "Boots", "Sandals", "Others"],
    "Essentials": ["Daily Essentials", "Personal Care", "Home Essentials", "Others"],
  };

  const getParentCategoryForLegacy = (name) => {
    for (const [parent, subs] of Object.entries(categoryStructure)) {
      if (subs.includes(name)) return parent;
    }
    return null;
  };

  const [mainCategories, setMainCategories] = useState(defaultCategories);
  const [subCategories, setSubCategories] = useState([]);
  const [categories, setCategories] = useState([{ name: "All", icon: allIcon }]);
  const [brandPartners, setBrandPartners] = useState([]);


  useEffect(() => {
    if (!editingProduct && showAddModal) {
      try {

        const hasData =
          newProduct.itemName ||
          newProduct.variant ||
          newProduct.itemPrice ||
          newProduct.costPrice ||
          newProduct.currentStock ||
          newProduct.itemImage ||
          newProduct.selectedSizes && newProduct.selectedSizes.length > 0;

        if (hasData) {
          localStorage.setItem(
            ADD_PRODUCT_STORAGE_KEY,
            JSON.stringify(newProduct)
          );
        }
      } catch (error) {
        console.error("Error saving product draft to localStorage:", error);
      }
    }
  }, [newProduct, editingProduct, showAddModal]);

  const addProductHasOpeningStock = useMemo(
    () => hasAnyOpeningStockInForm(newProduct),
    [newProduct]
  );

  const categoryIconMap = {
    Tops: topIcon,
    Bottoms: bottomsIcon,
    Dresses: dressesIcon,
    Makeup: makeupIcon,
    Accessories: accessoriesIcon,
    Essentials: accessoriesIcon,
    Shoes: shoesIcon,
    "Head Wear": headWearIcon
  };


  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const activeDbCats = data.data.filter((cat) => cat.status === "active");

        const dbMainCats = activeDbCats
          .filter(c => c.type !== 'subcategory' && !categoryStructureOptions.includes(c.name))
          .map(cat => ({ name: cat.name, icon: categoryIconMap[cat.name] || allIcon }));

        const rawSubCats = activeDbCats
          .filter(c => c.type === 'subcategory' || categoryStructureOptions.includes(c.name));

        const dbSubCats = [];

        for (const [parent, subs] of Object.entries(categoryStructure)) {
          subs.forEach(subName => {
            const dbSub = rawSubCats.find(s => s.name === subName);
            if (dbSub) {
              dbSubCats.push({ name: dbSub.name, parentCategory: parent });
            }
          });
        }

        rawSubCats.forEach(sub => {
          if (!categoryStructureOptions.includes(sub.name)) {
            dbSubCats.push({ name: sub.name, parentCategory: sub.parentCategory });
          }
        });

        const mergedMainCategories = [...defaultCategories];
        const defaultNames = new Set(defaultCategories.map((c) => c.name));

        dbMainCats.forEach((cat) => {
          if (!defaultNames.has(cat.name)) {
            mergedMainCategories.push(cat);
          }
        });

        setMainCategories(mergedMainCategories);
        setSubCategories(dbSubCats);

        // Fetch categories for AddProductModal specifically
        const activeCategories = data.data.
          filter((cat) => cat.status === "active" && cat.name !== "Others").
          map((cat) => ({
            name: cat.name,
            icon: categoryIconMap[cat.name] || allIcon,
            parentCategory: cat.parentCategory || null
          }));

        const withEssentials = activeCategories.some((cat) => cat.name === "Essentials")
          ? activeCategories
          : [...activeCategories, { name: "Essentials", icon: categoryIconMap.Essentials, parentCategory: null }];

        setCategories([{ name: "All", icon: allIcon, parentCategory: null }, ...withEssentials]);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      setMainCategories(defaultCategories);
      setSubCategories([]);
      
      setCategories([
        { name: "All", icon: allIcon, parentCategory: null },
        { name: "Tops", icon: topIcon, parentCategory: null },
        { name: "Bottoms", icon: bottomsIcon, parentCategory: null },
        { name: "Dresses", icon: dressesIcon, parentCategory: null },
        { name: "Makeup", icon: makeupIcon, parentCategory: null },
        { name: "Accessories", icon: accessoriesIcon, parentCategory: null },
        { name: "Essentials", icon: accessoriesIcon, parentCategory: null },
        { name: "Shoes", icon: shoesIcon, parentCategory: null },
        { name: "Head Wear", icon: headWearIcon, parentCategory: null }]
      );
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
    Essentials: "ESS",
    Shoes: "SHO",
    "Head Wear": "HDW",
    Foods: "FOD"
  };

  const getNextIncrementalCode = () => {

    const numericCodes = products.
      map((p) => {
        const match = p.sku?.match(/-(\d{5})-?/);
        return match ? parseInt(match[1]) : 0;
      }).
      filter((num) => num > 0);


    const maxCode = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;


    return String(maxCode + 1).padStart(5, "0");
  };

  const getColorCode = (variant) => {
    if (!variant || variant.trim() === "") {
      return "XXX";
    }

    const cleaned = variant.replace(/\s+/g, "").toUpperCase();
    return cleaned.substring(0, 3).padEnd(3, "X");
  };

  const generateSKU = (category, subCategory, variant) => {
    const base = subCategory || category;
    const categoryCode = categoryCodeMap[base] || "OTH";


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


  useEffect(() => {
    const cachedProducts = getCachedData("products");
    if (!cachedProducts || !isCacheValid("products")) {
      fetchProducts();
    } else {
      setProducts(cachedProducts);
    }
    fetchCategories();
    fetchBrandPartners();
    // Intentionally mount-only: `getCachedData` changes when any cache slice changes,
    // which would retrigger this effect and duplicate product requests.
     
  }, []);

  const getSkuNumber = (sku = "") => {
    const matches = sku.match(/\d+/g);
    if (!matches || matches.length === 0) return -Infinity;
    return parseInt(matches[matches.length - 1], 10);
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;


    if (selectedMainCategory !== "All") {
      const matchMain = selectedMainCategory.toLowerCase().trim();
      
      if (selectedSubCategory && selectedSubCategory !== "All") {
        const matchSub = selectedSubCategory.toLowerCase().trim();
        filtered = filtered.filter((product) => {
          const pCat = (product.category || "").toLowerCase().trim();
          const pSubCat = (product.subCategory || "").toLowerCase().trim();
          return pCat === matchMain && pSubCat === matchSub;
        });
      } else {
        filtered = filtered.filter((product) => {
          const pCat = (product.category || "").toLowerCase().trim();
          return pCat === matchMain;
        });
      }
    }


    if (filterBrand !== "All") {
      filtered = filtered.filter(
        (product) => product.brandName === filterBrand
      );
    }


    if (filterStatus !== "All") {
      filtered = filtered.filter((product) => {
        const reorderLevel = product.reorderNumber || 10;
        if (filterStatus === "In Stock") {
          return product.currentStock > reorderLevel;
        } else if (filterStatus === "Low Stock") {
          return (
            product.currentStock > 0 && product.currentStock <= reorderLevel);

        } else if (filterStatus === "Out of Stock") {
          return product.currentStock === 0;
        }
        return true;
      });
    }


    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (product.category && product.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (product.subCategory && product.subCategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
          product.brandName &&
          product.brandName.
            toLowerCase().
            includes(searchQuery.toLowerCase())
      );
    }


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
        index === self.findIndex((p) => p._id === product._id)
    );

    return uniqueProducts;
  }, [
    products,
    selectedMainCategory,
    selectedSubCategory,
    filterBrand,
    filterStatus,
    searchQuery,
    sortBy]
  );

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
      ...new Set(products.map((p) => p.brandName).filter(Boolean))].
      sort();
  }, [products]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredProducts, currentPage, itemsPerPage]);
  const paginatedProductIds = useMemo(
    () => paginatedProducts.map((product) => product._id),
    [paginatedProducts]
  );
  const allVisibleSelected =
    paginatedProductIds.length > 0 &&
    paginatedProductIds.every((id) => selectedProductIds.includes(id));
  const someVisibleSelected = paginatedProductIds.some((id) =>
    selectedProductIds.includes(id)
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMainCategory, selectedSubCategory, filterBrand, filterStatus, searchQuery, sortBy]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredProducts.length / itemsPerPage)
    );
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [filteredProducts.length, itemsPerPage, currentPage]);

  useEffect(() => {
    setSelectedProductIds((prev) =>
      prev.filter((id) =>
        filteredProducts.some((product) => product._id === id)
      )
    );
  }, [filteredProducts]);

  const fetchProducts = async (opts) => {
    const silent = typeof opts === "boolean" ? opts : opts?.silent;
    const myGen = ++productsListFetchGenRef.current;
    const controller = new AbortController();
    const timeoutMs = 90000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let adjustedLoading = false;
    try {
      if (!silent) {
        adjustedLoading = true;
        adjustInventoryProductsLoading(1);
      }
      // 1) Paged list path — avoids a single huge response when catalog is large.
      const PAGE_LIMIT = 500;
      const mergeUniqueById = (prevList, nextList) => {
        const prevArr = Array.isArray(prevList) ? prevList : [];
        const nextArr = Array.isArray(nextList) ? nextList : [];
        const map = new Map();
        prevArr.forEach((p) => {
          const id = String(p?._id || p?.id || "");
          if (id) map.set(id, p);
        });
        nextArr.forEach((p) => {
          const id = String(p?._id || p?.id || "");
          if (id) map.set(id, p);
        });
        return Array.from(map.values());
      };

      let page = 1;
      let combined = [];
      let firstPageDone = false;
      while (true) {
        const response = await fetch(
          `${API_BASE_URL}/api/products?fields=minimal&limit=${PAGE_LIMIT}&page=${page}`,
          {
            cache: "no-store",
            signal: controller.signal
          }
        );

        if (myGen !== productsListFetchGenRef.current) {
          return;
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => "");
          throw new Error(errBody || `HTTP ${response.status}`);
        }

        const data = await response.json();

        if (myGen !== productsListFetchGenRef.current) {
          return;
        }

        if (!data?.success) break;
        const chunk = Array.isArray(data.data) ? data.data : [];
        if (chunk.length === 0) break;

        combined = mergeUniqueById(combined, chunk);

        if (!firstPageDone) {
          firstPageDone = true;
          setProducts(combined);
          if (!silent && adjustedLoading) {
            adjustInventoryProductsLoading(-1);
            adjustedLoading = false;
          }
        } else {
          setProducts((prev) => mergeUniqueById(prev, chunk));
        }

        if (chunk.length < PAGE_LIMIT) break;
        page += 1;
        if (page > 200) break;
      }

      if (firstPageDone) {
        setCachedData("products", combined);
      } else if (!silent) {
        alert("Could not load products.");
      }

      clearTimeout(timeoutId);

      // 2) Background: full documents with images (can be MBs) — must not block UI (stock-in
      // "Adding..." awaited this entire chain before).
      // Now that images are URLs, this is much cheaper; keep it as background hydration.
      if (firstPageDone && myGen === productsListFetchGenRef.current) {
        const fullController = new AbortController();
        const fullTimeout = setTimeout(() => fullController.abort(), 120000);
        const PAGE2_LIMIT = 500;
        (async () => {
          try {
            let p = 1;
            let all = [];
            while (true) {
              const fullRes = await fetch(
                `${API_BASE_URL}/api/products?limit=${PAGE2_LIMIT}&page=${p}`,
                { cache: "no-store", signal: fullController.signal }
              );
              if (myGen !== productsListFetchGenRef.current) return;
              if (!fullRes.ok) return;
              const fullData = await fullRes.json().catch(() => ({}));
              if (!fullData?.success) return;
              const chunk = Array.isArray(fullData.data) ? fullData.data : [];
              if (!chunk.length) break;
              all = mergeUniqueById(all, chunk);
              if (chunk.length < PAGE2_LIMIT) break;
              p += 1;
              if (p > 200) break;
            }
            if (myGen === productsListFetchGenRef.current && all.length) {
              setProducts(all);
              setCachedData("products", all);
            }
          } catch (imgErr) {
            if (imgErr?.name !== "AbortError") {
              console.warn("Background product fetch (full detail) failed:", imgErr);
            }
          } finally {
            clearTimeout(fullTimeout);
          }
        })();
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        if (myGen !== productsListFetchGenRef.current) {
          return;
        }
        if (!silent) {
          alert(
            "Loading products timed out. If this keeps happening, check that the server is running and try again."
          );
        }
        return;
      }
      console.error("Error fetching products:", error);
      if (!silent) {
        alert(
          "Failed to fetch products. Make sure the backend server is running."
        );
      }
    } finally {
      clearTimeout(timeoutId);
      if (adjustedLoading) {
        adjustInventoryProductsLoading(-1);
      }
    }
  };

  const fetchProductsRef = useRef(fetchProducts);
  fetchProductsRef.current = fetchProducts;

  useEffect(() => {
    const syncProducts = () => {
      invalidateCache("products");
      fetchProductsRef.current({ silent: true });
    };
    window.addEventListener("pos-invalidate-products", syncProducts);
    const onStorage = (e) => {
      if (e.key === "pos-products-bump" && e.newValue != null) {
        syncProducts();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pos-invalidate-products", syncProducts);
      window.removeEventListener("storage", onStorage);
    };
  }, [invalidateCache]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === "checkbox" ? checked : value;


    if (name === "displayInTerminal" && type === "checkbox") {
      setNewProduct((prev) => ({
        ...prev,
        displayInTerminal: checked
      }));
      return;
    }

    setNewProduct((prev) => {
      const updatedProduct = {
        ...prev,
        [name]: inputValue
      };

      if (!editingProduct && (name === "category" || name === "subCategory" || name === "variant")) {
        const category = name === "category" ? inputValue : prev.category;
        const subCategory = name === "subCategory" ? inputValue : prev.subCategory;
        const variant = name === "variant" ? inputValue : prev.variant;
        updatedProduct.sku = generateSKU(category, subCategory, variant);
      }

      return updatedProduct;
    });
  };

  const handleSizeToggle = (size) => {
    setNewProduct((prev) => {
      const isSelected = prev.selectedSizes.includes(size);
      const newSelectedSizes = isSelected ?
        prev.selectedSizes.filter((s) => s !== size) :
        [...prev.selectedSizes, size];

      const newSizeQuantities = { ...prev.sizeQuantities };
      const newSizePrices = { ...prev.sizePrices };
      if (isSelected) {
        delete newSizeQuantities[size];
        delete newSizePrices[size];
      } else {
        newSizeQuantities[size] = "";
        if (prev.differentPricesPerSize) {

          newSizePrices[size] = prev.itemPrice || "";
        }
      }

      return {
        ...prev,
        selectedSizes: newSelectedSizes,
        sizeQuantities: newSizeQuantities,
        sizePrices: newSizePrices
      };
    });
  };

  const handleSizeQuantityChange = (size, quantity) => {
    setNewProduct((prev) => ({
      ...prev,
      sizeQuantities: {
        ...prev.sizeQuantities,
        [size]: parseInt(quantity) || 0
      }
    }));
  };

  const handleSizePriceChange = (size, price) => {
    setNewProduct((prev) => ({
      ...prev,
      sizePrices: {
        ...prev.sizePrices,
        [size]: price
      }
    }));
  };

  const resetProductForm = (clearStorage = true) => {
    const defaultCategory = "Tops";
    const defaultSubCategory = "";
    const defaultVariant = "";
    setNewProduct({
      sku: generateSKU(defaultCategory, defaultSubCategory, defaultVariant),
      itemName: "",
      category: "",
      subCategory: "",
      unitOfMeasure: "pcs",
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
      expirationDate: "",
      expirationThresholdDays: "",
      dateReceived: ""
    });
    setEditingProduct(null);


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


    if (!editingProduct) {
      const hasVariantQuantities =
        newProduct.variantQuantities &&
        Object.keys(newProduct.variantQuantities).length > 0 &&
        Object.values(newProduct.variantQuantities).some((sizeVariants) =>
          sizeVariants &&
          typeof sizeVariants === "object" &&
          Object.values(sizeVariants).some((qty) => parseInt(qty) > 0)
        );

      const hasAnyVariantPricing = newProduct.selectedSizes?.some(
        (size) => newProduct.differentPricesPerVariant?.[size]
      );


      const hasVariantPrices = newProduct.variantPrices &&
        Object.keys(newProduct.variantPrices).length > 0 &&
        Object.values(newProduct.variantPrices).some((sizeVariants) =>
          sizeVariants && Object.values(sizeVariants).some((price) => parseFloat(price) > 0)
        );


      const hasVariantQuantitiesForConfirm = hasVariantQuantities;


      if (hasAnyVariantPricing || hasVariantPrices || hasVariantQuantitiesForConfirm) {


        setShowConfirmModal(true);
        return;
      }


      setShowConfirmModal(true);
    } else {
      setProductToEdit(editingProduct);
      setShowEditModal(true);
    }
  };

  const confirmAddProduct = async () => {
    setShowConfirmModal(false);

    const variantQtySum = sumAllVariantQuantities(newProduct.variantQuantities);
    const sizeQtySum = Object.values(newProduct.sizeQuantities || {}).reduce(
      (sum, qty) => sum + (parseInt(qty, 10) || 0),
      0
    );
    const totalStock =
      variantQtySum > 0
        ? variantQtySum
        : (newProduct.selectedSizes || []).length > 0
          ? sizeQtySum
          : parseInt(newProduct.currentStock, 10) || 0;

    try {
      setLoading(true);
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const performedByName =
        currentUser.name ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
        "System";
      const performedById = currentUser._id || currentUser.id || "";
      const url = editingProduct ?
        `${API_BASE_URL}/api/products/${editingProduct._id}` :
        `${API_BASE_URL}/api/products`;

      const method = editingProduct ? "PUT" : "POST";



      let defaultItemPrice = parseFloat(newProduct.itemPrice) || 0;


      if (!defaultItemPrice && newProduct.differentPricesPerSize && newProduct.selectedSizes?.length > 0) {
        const firstSizePrice = newProduct.sizePrices?.[newProduct.selectedSizes[0]];
        if (firstSizePrice) {
          defaultItemPrice = parseFloat(firstSizePrice) || 0;
        }
      }


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
        handledBy: performedByName,
        handledById: performedById,
        performedByName,
        performedById,
        itemPrice: defaultItemPrice,
        costPrice: parseFloat(newProduct.costPrice) || 0,
        reorderNumber: parseInt(newProduct.reorderNumber) || 0,
        expirationDate: newProduct.expirationDate || null,
        expirationThresholdDays: newProduct.expirationDate
          ? Math.max(0, parseInt(newProduct.expirationThresholdDays) || 30)
          : 0,
        displayInTerminal: newProduct.displayInTerminal !== false
      };


      if (!editingProduct) {
        payload.currentStock = totalStock;
        const selected = newProduct.selectedSizes || [];
        const sizesList =
          selected.length > 0
            ? selected
            : Object.keys(newProduct.variantQuantities || {}).length > 0
              ? Object.keys(newProduct.variantQuantities)
              : [];

        if (sizesList.length > 0) {

          const hasVariantQuantities = newProduct.variantQuantities &&
            Object.keys(newProduct.variantQuantities).length > 0;


          const hasVariantPrices = newProduct.variantPrices &&
            Object.keys(newProduct.variantPrices).length > 0;


          if (
            newProduct.differentPricesPerSize &&
            Object.keys(newProduct.sizePrices).length > 0) {
            const sizesWithPrices = {};
            sizesList.forEach((size) => {
              const sizePrice = parseFloat(newProduct.sizePrices[size]);


              let variantValue = "";
              if (newProduct.differentVariantsPerSize) {

                if (newProduct.multipleVariantsPerSize?.[size]) {

                  variantValue = newProduct.sizeMultiVariants?.[size] || [];
                } else {

                  variantValue = newProduct.sizeVariants?.[size] || "";
                }
              } else {

                variantValue = newProduct.variant || "";
              }


              if (hasVariantQuantities && newProduct.variantQuantities[size]) {
                sizesWithPrices[size] = {
                  quantity: Object.values(newProduct.variantQuantities[size]).reduce((sum, q) => sum + (parseInt(q) || 0), 0),
                  price: sizePrice || defaultItemPrice || 0,
                  variant: variantValue,
                  variants: newProduct.variantQuantities[size]
                };

                if (hasVariantPrices && newProduct.variantPrices[size]) {
                  sizesWithPrices[size].variantPrices = newProduct.variantPrices[size];
                }
              } else {
                sizesWithPrices[size] = {
                  quantity: newProduct.sizeQuantities[size] || 0,
                  price: sizePrice || defaultItemPrice || 0,
                  variant: variantValue
                };
              }
            });
            payload.sizes = sizesWithPrices;
          } else {

            const sizesObject = {};


            const hasVariantCostPrices = newProduct.variantCostPrices &&
              Object.keys(newProduct.variantCostPrices).length > 0;

            sizesList.forEach((size) => {

              let variantValue = "";
              if (newProduct.differentVariantsPerSize) {

                if (newProduct.multipleVariantsPerSize?.[size]) {

                  variantValue = newProduct.sizeMultiVariants?.[size] || [];
                } else {

                  variantValue = newProduct.sizeVariants?.[size] || "";
                }
              } else {

                variantValue = newProduct.variant || "";
              }


              const sizePrice = parseFloat(newProduct.sizePrices?.[size]) || 0;
              const sizeCostPrice = parseFloat(newProduct.sizeCostPrices?.[size]) || 0;


              if (hasVariantQuantities && newProduct.variantQuantities[size]) {
                sizesObject[size] = {
                  quantity: Object.values(newProduct.variantQuantities[size]).reduce((sum, q) => sum + (parseInt(q) || 0), 0),
                  variant: variantValue,
                  variants: newProduct.variantQuantities[size]
                };

                if (hasVariantPrices && newProduct.variantPrices[size]) {
                  sizesObject[size].variantPrices = newProduct.variantPrices[size];

                  if (hasVariantCostPrices && newProduct.variantCostPrices[size]) {
                    sizesObject[size].variantCostPrices = newProduct.variantCostPrices[size];
                  }
                } else {

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
                  variant: variantValue
                };

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
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 413) {
          alert(
            "Image file is too large. Please use a smaller image or compress it before uploading."
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
        if (data.data) {
          setProducts((prev) => {
            const next = [data.data, ...(prev || [])];
            setCachedData("products", next);
            return next;
          });
          await fetchProducts({ silent: true });
        } else {
          invalidateCache("products");
          await fetchProducts({ silent: true });
        }
        setSuccessMessage("The item was added successfully!");
        setShowSuccessModal(true);
      } else {
        alert(
          data.message ||
          `Failed to ${editingProduct ? "update" : "add"} product`
        );
      }
    } catch (error) {
      console.error("Error saving product:", error);
      alert(
        "Failed to save product. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Array.isArray(cache?.products) && cache.products.length) {
      setProducts(cache.products);
    }
  }, [cache?.products]);

  const handleEditClick = (product) => {
    setEditingProduct(product);

    const existingSizes = product.sizes ? Object.keys(product.sizes) : [];
    let existingSizeQuantities = {};
    let existingSizePrices = {};
    let hasDifferentPrices = false;


    if (product.sizes) {
      existingSizes.forEach((size) => {
        if (
          typeof product.sizes[size] === "object" &&
          product.sizes[size] !== null) {
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
      category: product.category || "",
      subCategory: product.subCategory || "",
      unitOfMeasure: product.unitOfMeasure || "pcs",
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
      expirationDate: product.expirationDate ?
        new Date(product.expirationDate).toISOString().slice(0, 10) :
        "",
      expirationThresholdDays:
        product.expirationThresholdDays !== undefined &&
        product.expirationThresholdDays !== null
          ? String(product.expirationThresholdDays)
          : "",
      displayInTerminal:
        product.displayInTerminal !== undefined ?
          product.displayInTerminal :
          true
    });

    setShowAddModal(true);
  };

  const confirmEditProduct = async () => {
    setShowEditModal(false);

    if (!editingProduct) return;

    try {
      setLoading(true);
      const url = `${API_BASE_URL}/api/products/${editingProduct._id}`;




      const displayInTerminalValue =
        newProduct.displayInTerminal === false ? false : true;

      const payload = {
        ...newProduct,
        itemPrice: parseFloat(newProduct.itemPrice) || 0,
        costPrice: parseFloat(newProduct.costPrice) || 0,
        reorderNumber: parseInt(newProduct.reorderNumber) || 0,
        expirationDate: newProduct.expirationDate || null,
        expirationThresholdDays: newProduct.expirationDate
          ? Math.max(0, parseInt(newProduct.expirationThresholdDays) || 30)
          : 0,
        displayInTerminal: displayInTerminalValue
      };

      console.log(
        "[confirmEditProduct] newProduct.displayInTerminal:",
        newProduct.displayInTerminal
      );
      console.log(
        "[confirmEditProduct] Sending displayInTerminal:",
        payload.displayInTerminal
      );


      delete payload.currentStock;
      delete payload.selectedSizes;
      delete payload.sizeQuantities;
      delete payload.sizePrices;
      delete payload.differentPricesPerSize;


      if (payload.editableSizePrices && Object.keys(payload.editableSizePrices).length > 0) {

        const updatedSizes = { ...editingProduct.sizes };

        Object.entries(payload.editableSizePrices).forEach(([size, sizeData]) => {
          if (updatedSizes[size]) {
            if (sizeData.hasVariants && sizeData.variants) {

              const currentSizeData = updatedSizes[size];
              const currentVariants = currentSizeData.variants || {};
              const currentVariantPrices = currentSizeData.variantPrices || {};
              const currentVariantCostPrices = currentSizeData.variantCostPrices || {};

              Object.entries(sizeData.variants).forEach(([variant, variantData]) => {
                const newPrice = parseFloat(variantData.price) || 0;
                const newCostPrice = parseFloat(variantData.costPrice) || 0;


                if (currentVariants[variant] !== undefined) {
                  if (typeof currentVariants[variant] === 'number') {

                    currentVariantPrices[variant] = newPrice;
                    currentVariantCostPrices[variant] = newCostPrice;
                  } else if (typeof currentVariants[variant] === 'object') {

                    currentVariants[variant] = {
                      ...currentVariants[variant],
                      price: newPrice,
                      costPrice: newCostPrice
                    };
                  }
                }
              });


              updatedSizes[size] = {
                ...currentSizeData,
                variants: currentVariants,
                variantPrices: Object.keys(currentVariantPrices).length > 0 ? currentVariantPrices : currentSizeData.variantPrices,
                variantCostPrices: Object.keys(currentVariantCostPrices).length > 0 ? currentVariantCostPrices : currentSizeData.variantCostPrices
              };
            } else {

              updatedSizes[size] = {
                ...updatedSizes[size],
                price: parseFloat(sizeData.price) || 0,
                costPrice: parseFloat(sizeData.costPrice) || 0
              };
            }
          }
        });


        payload.sizes = updatedSizes;
        delete payload.editableSizePrices;
      } else {

        delete payload.sizes;
      }

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 413) {
          alert(
            "Image file is too large. Please use a smaller image or compress it before uploading."
          );
          return;
        }
        const errorText = await response.text();
        let errorMessage = "Failed to update product";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;

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
        await fetchProducts({ silent: true });
        setSuccessMessage("The item was edited successfully!");
        setShowSuccessModal(true);
        setProductToEdit(null);
      } else {
        alert(data.message || "Failed to update product");
      }
    } catch (error) {
      console.error("Error updating product:", error);
      alert(
        "Failed to update product. Please check your connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleViewProduct = useCallback(async (product) => {
    setViewingProduct(product);
    setShowViewModal(true);


    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${product._id}`
      );
      const data = await response.json();
      if (data.success && data.data) {
        setViewingProduct(data.data);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    }
  }, []);

  const handleDeleteClick = (product) => {
    setProductToDelete(product._id);
    setShowDeleteModal(true);
  };

  const handleArchiveClick = (product) => {
    setProductToArchive(product._id);
    setShowArchiveModal(true);
  };

  const confirmArchiveProduct = async () => {
    if (!productToArchive) return;

    const archiveId = String(productToArchive);
    setShowArchiveModal(false);

    try {
      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );
      const archivedByName =
        currentUser.name ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
        "Owner";
      const archivedById = currentUser._id || currentUser.id || "";

      const response = await fetch(
        `${API_BASE_URL}/api/products/${archiveId}/archive`,
        {
          method: "PATCH",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archivedByName, archivedById })
        }
      );

      const data = await response.json();

      if (data.success) {
        setProducts((prev) =>
          prev.filter((p) => String(p._id || p.id) !== archiveId)
        );
        setShowSuccessModal(true);
        setSuccessMessage("The item was archived successfully!");
        invalidateCache("products");
        await fetchProducts({ silent: true });
      } else {
        alert(data.message || "Failed to archive product");
      }
    } catch (error) {
      console.error("Error archiving product:", error);
      alert("Failed to archive product. Please try again.");
    } finally {
      setProductToArchive(null);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setShowDeleteModal(false);

    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/products/${productToDelete}`,
        {
          method: "DELETE"
        }
      );

      const data = await response.json();

      if (data.success) {
        setShowSuccessModal(true);
        setSuccessMessage("The item was deleted successfully!");
        invalidateCache("products");
        await fetchProducts({ silent: true });
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
        stockModalType === "in" ?
          editingProduct.currentStock + amount :
          Math.max(0, editingProduct.currentStock - amount);



      const response = await fetch(
        `${API_BASE_URL}/api/products/${editingProduct._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            currentStock: newStock
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        alert(
          `Stock ${stockModalType === "in" ? "added" : "removed"} successfully!`
        );
        setShowStockModal(false);
        setEditingProduct(null);
        setStockAmount("");
        invalidateCache("products");
        await fetchProducts({ silent: true });
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


      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );
      const handledBy =
        currentUser.name ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
        "System";
      const handledById = currentUser._id || currentUser.id || "";

      if (stockData.noSizes) {
        const response = await fetch(`${API_BASE_URL}/api/products/${editingProduct._id}/stock-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...stockData,
            handledBy,
            handledById
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          alert(data.message || "Failed to update stock");
          return;
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/products/${editingProduct._id}/stock-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...stockData,
            handledBy,
            handledById
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          alert(data.message || "Failed to update stock");
          return;
        }
      }

      setShowStockModal(false);
      setEditingProduct(null);
      setStockAmount("");
      setSuccessMessage("Stock added successfully!");
      setShowSuccessModal(true);
      invalidateCache("products");
      fetchProducts({ silent: true }).catch((err) =>
        console.warn("Background product refresh failed after stock-in:", err)
      );
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


      const currentUser = JSON.parse(
        localStorage.getItem("currentUser") || "{}"
      );
      const handledBy =
        currentUser.name ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
        "System";
      const handledById = currentUser._id || currentUser.id || "";


      const movementType =
        stockData.reason === "Damaged" ||
          stockData.reason === "Lost" ||
          stockData.reason === "Expired" ?
          "Pull-Out" :
          "Stock-Out";

      let totalQuantityRemoved = 0;

      if (stockData.noSizes) {
        totalQuantityRemoved = stockData.quantity || 0;
        const response = await fetch(`${API_BASE_URL}/api/products/${editingProduct._id}/stock-out`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...stockData,
            handledBy,
            handledById
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          alert(data.message || "Failed to update stock");
          return;
        }
      } else {
        if (stockData.hasVariants && stockData.variantQuantities) {
          stockData.selectedSizes?.forEach((size) => {
            const variantQtys = stockData.variantQuantities[size] || {};
            totalQuantityRemoved += Object.values(variantQtys).reduce((sum, q) => sum + (parseInt(q) || 0), 0);
          });
        } else {
          stockData.selectedSizes?.forEach((size) => {
            totalQuantityRemoved += parseInt(stockData.sizes?.[size]) || 0;
          });
        }

        const response = await fetch(`${API_BASE_URL}/api/products/${editingProduct._id}/stock-out`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...stockData,
            handledBy,
            handledById
          })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          alert(data.message || "Failed to update stock");
          return;
        }
      }

      // Keep existing archive behavior on stock-out reasons
      const archiveReasons = ["Damaged", "Defective", "Expired"];
      if (archiveReasons.includes(stockData.reason)) {
        const sizesString = stockData.selectedSizes ?
          stockData.selectedSizes.join(", ") :
          "";

        try {
          await fetch(`${API_BASE_URL}/api/archive`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
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
                stockData.reason === "Defective" ?
                  "Defective" :
                  stockData.reason,
              archivedBy: handledBy,
              archivedById: handledById,
              source: "stock-out",
              notes: `Stock out - ${stockData.reason}. Sizes: ${sizesString}`
            })
          });
        } catch (archiveError) {
          console.error("Error archiving item:", archiveError);
        }
      }

      setShowStockModal(false);
      setEditingProduct(null);
      setStockAmount("");
      setSuccessMessage("Stock removed successfully!");
      setShowSuccessModal(true);
      invalidateCache("products");
      fetchProducts({ silent: true }).catch((err) =>
        console.warn("Background product refresh failed after stock-out:", err)
      );
    } catch (error) {
      console.error("Error updating stock:", error);
      alert("Failed to update stock. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /*
   * NOTE:
   * The old client-side batching logic for stock-in/out was intentionally replaced by
   * server-side endpoints to prevent concurrent overwrite bugs and keep FIFO rules consistent.
   */

  /*
   * The rest of this file still uses `handleStockOutConfirm` in the StockOutModal below.
   */

  /* eslint-disable no-unreachable */
  /* eslint-enable no-unreachable */

  /*
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
  */

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
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
      prev.includes(productId) ?
        prev.filter((id) => id !== productId) :
        [...prev, productId]
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

    handleExportToCSV();
  };

  const handleCancelExportSelection = () => {
    setIsExportSelectionMode(false);
    setSelectedProductIds([]);
  };

  const handleExportToCSV = () => {
    try {


      const productsToExport =
        selectedProductIds.length > 0 ?
          filteredProducts.filter((product) =>
            selectedProductIds.includes(product._id)
          ) :
          filteredProducts;

      if (productsToExport.length === 0) {
        alert("No products to export.");
        return;
      }


      const headers = [
        "sku",
        "itemName",
        "category",
        "subCategory",
        "brandName",
        "variantSummary",
        "batchCount",
        "itemPrice",
        "costPrice",
        "currentStock",
        "unitOfMeasure",
        "reorderNumber",
        "stockStatus",
        "displayInTerminal",
        "dateAdded"
      ];

      const buildVariantSummary = (product) => {
        const sizes = product?.sizes;
        if (!sizes || typeof sizes !== "object") {
          return product?.variant || "N/A";
        }
        const sizeKeys = Object.keys(sizes);
        if (sizeKeys.length === 0) return product?.variant || "N/A";

        const variantSet = new Set();
        sizeKeys.forEach((sizeKey) => {
          const sizeData = sizes[sizeKey];
          if (sizeData && typeof sizeData === "object" && sizeData.variants && typeof sizeData.variants === "object") {
            Object.keys(sizeData.variants).forEach((v) => {
              if (v) variantSet.add(v);
            });
          }
        });

        const sizeCount = sizeKeys.length;
        const variantCount = variantSet.size;
        if (variantCount > 0) return `${variantCount} variants x ${sizeCount} sizes`;
        return `${sizeCount} sizes`;
      };

      const countBatchRows = (product) => {
        const sizes = product?.sizes;
        if (!sizes || typeof sizes !== "object") return 0;
        let count = 0;
        Object.values(sizes).forEach((sizeData) => {
          if (!sizeData || typeof sizeData !== "object") return;
          if (Array.isArray(sizeData.batches)) {
            count += sizeData.batches.filter((b) => !!b && !b.batchSlotPadding).length;
          }
          if (sizeData.variants && typeof sizeData.variants === "object") {
            Object.values(sizeData.variants).forEach((vData) => {
              if (vData && typeof vData === "object" && Array.isArray(vData.batches)) {
                count += vData.batches.filter((b) => !!b && !b.batchSlotPadding).length;
              }
            });
          }
        });
        return count;
      };

      const rows = productsToExport.map((product) => {
        const status = getStockStatus(
          product.currentStock,
          product.reorderNumber
        );
        const variantSummary = buildVariantSummary(product);
        const batchCount = countBatchRows(product);
        return headers.map((field) => {
          let value = "";
          switch (field) {
            case "stockStatus":
              value = status.label;
              break;
            case "variantSummary":
              value = variantSummary;
              break;
            case "batchCount":
              value = batchCount;
              break;
            case "displayInTerminal":
              value = product.displayInTerminal !== false ? "Yes" : "No";
              break;
            case "dateAdded":
              value = formatDate(product.dateAdded);
              break;
            default:
              value = product[field];
              break;
          }
          return formatCsvValue(value);
        });
      });


      const humanReadableHeaders = headers.map(
        (field) => fieldToHeaderMap[field] || field
      );


      const csvContent = [
        humanReadableHeaders.join(","),
        ...rows.map((row) =>
          row.
            map((cell) => {

              const cellStr = String(cell ?? "");
              if (
                cellStr.includes(",") ||
                cellStr.includes('"') ||
                cellStr.includes("\n")) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            }).
            join(",")
        )].
        join("\n");


      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `inventory_export_${new Date().toISOString().split("T")[0]}.csv`
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


      const headers = lines[0].
        split(",").
        map((h) => h.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1);

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        try {

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


          const sizesValue = values[headers.indexOf("Sizes")] || "";
          let parsedSizes = null;


          if (sizesValue && sizesValue.trim() !== "") {
            try {
              parsedSizes = JSON.parse(sizesValue);
            } catch (e) {
              console.warn("Failed to parse sizes JSON:", e);
            }
          }


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
            sizes: parsedSizes
          };


          if (skuFromCsv) {
            product.sku = skuFromCsv;
          }


          if (!product.itemName || !product.itemPrice) {
            errors.push(
              `Row ${i + 2}: Missing required fields (Item Name or Price)`
            );
            errorCount++;
            continue;
          }


          const response = await fetch(`${API_BASE_URL}/api/products`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(product)
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


      setImportResult({ successCount, errorCount, errors });
      setShowImportResultModal(true);


      if (successCount > 0) {
        invalidateCache("products");
        await fetchProducts({ silent: true });
      }


      event.target.value = "";
    } catch (error) {
      console.error("Error importing CSV:", error);
      alert(
        "Failed to import CSV file. Please check the file format and try again."
      );
      event.target.value = "";
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`p-8 min-h-screen ${theme === "dark" ? "bg-[#1E1B18]" : "bg-[#F9FAFB]"}`}>

      <Header pageName="Product & Stocks" showBorder={false} />

      <div className="mb-6 mt-8 flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="flex gap-4 flex-wrap">
          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}>

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
                viewBox="0 0 20 20">

                <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}>

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
                viewBox="0 0 20 20">

                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}>

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
                viewBox="0 0 20 20">

                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd" />

              </svg>
            </div>
          </div>

          <div
            className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
            style={{ minWidth: "200px" }}>

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
                viewBox="0 0 20 20">

                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd" />

              </svg>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleExportButtonClick}
            className={`rounded-2xl shadow-md flex flex-col items-center justify-center px-5 py-4 transition-colors ${isExportSelectionMode ?
              "border border-[#AD7F65] bg-[#AD7F65]/5" :
              theme === "dark" ?
                "bg-[#2A2724] hover:bg-[#352F2A]" :
                "bg-white hover:bg-gray-50"}`
            }
            style={{ minWidth: "100px" }}>

            <svg
              className={`w-8 h-8 mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

            </svg>
            <div
              className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>

              {isExportSelectionMode ? "Export Selected" : "Export"}
            </div>
          </button>
          {isExportSelectionMode &&
            <button
              onClick={handleCancelExportSelection}
              className={`rounded-2xl shadow-md px-4 py-2 text-xs font-medium border transition-colors ${theme === "dark" ?
                "bg-[#2A2724] border-gray-600 text-gray-400 hover:bg-[#352F2A]" :
                "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`
              }>

              Cancel
            </button>
          }

          <button
            onClick={() => document.getElementById("csv-file-input").click()}
            className={`rounded-2xl shadow-md flex flex-col items-center justify-center px-5 py-4 transition-colors ${theme === "dark" ?
              "bg-[#2A2724] hover:bg-[#352F2A]" :
              "bg-white hover:bg-gray-50"}`
            }
            style={{ minWidth: "100px" }}>

            <svg
              className={`w-8 h-8 mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24">

              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />

            </svg>
            <div
              className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>

              Import
            </div>
          </button>
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            onChange={handleImportFromCSV}
            style={{ display: "none" }} />

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
              className={`w-full h-10 pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === "dark" ?
                "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" :
                "bg-white border-gray-300"}`
              } />

          </div>

          <div className="flex gap-2">
            <select
              value={selectedMainCategory}
              onChange={(e) => {
                setSelectedMainCategory(e.target.value);
                setSelectedSubCategory("");
              }}
              className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === "dark" ?
                "bg-[#2A2724] border-gray-600 text-white" :
                "bg-white border-gray-300"}`
              }>

              {mainCategories.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name === "All" ? "By Category" : cat.name}
                </option>
              ))}
            </select>
            
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              disabled={selectedMainCategory === "All"}
              className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${
                selectedMainCategory === "All" ? "opacity-50 cursor-not-allowed text-gray-400" : ""
              } ${theme === "dark" ?
                "bg-[#2A2724] border-gray-600 text-white" :
                "bg-white border-gray-300"}`
              }>
              
              <option value="">
                {selectedMainCategory === "All" ? "Select Main First" : "All Subcategories"}
              </option>
              
              {subCategories
                .filter((sub) => sub.parentCategory === selectedMainCategory)
                .map((sub) => (
                  <option key={`sub-${sub.name}`} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
            </select>
          </div>

          <select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === "dark" ?
              "bg-[#2A2724] border-gray-600 text-white" :
              "bg-white border-gray-300"}`
            }>

            <option value="All">By Brand</option>
            {uniqueBrands.map((brand) =>
              <option key={brand} value={brand}>
                {brand}
              </option>
            )}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === "dark" ?
              "bg-[#2A2724] border-gray-600 text-white" :
              "bg-white border-gray-300"}`
            }>

            <option value="All">By Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`h-10 px-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${theme === "dark" ?
              "bg-[#2A2724] border-gray-600 text-white" :
              "bg-white border-gray-300"}`
            }>

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
              background: "linear-gradient(135deg, #10B981 0%, #059669 100%)"
            }}>

            <FaPlus /> Add New Item
          </button>
        </div>
      </div>

      <ProductTable
        loading={loading}
        filteredProducts={paginatedProducts}
        handleEditProduct={handleEditClick}
        handleDeleteProduct={handleDeleteClick}
        handleArchiveProduct={handleArchiveClick}
        handleViewProduct={handleViewProduct}
        handleStockUpdate={handleStockUpdate}
        selectedProductIds={selectedProductIds}
        onToggleSelect={handleToggleProductSelection}
        onToggleSelectAll={handleToggleSelectAllVisible}
        showSelection={isExportSelectionMode}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected} />


      {filteredProducts.length >= itemsPerPage &&
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredProducts.length / itemsPerPage)}
          onPageChange={setCurrentPage} />

      }

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
        onCategoryAdd={fetchCategories}
        onBrandAdd={fetchBrandPartners} />


      <ConfirmAddProductModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmAddProduct}
        productName={newProduct.itemName}
        noStockWarning={!addProductHasOpeningStock}
        onCategoryAdd={fetchCategories}
        onBrandAdd={fetchBrandPartners} />


      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        message={successMessage || "The item was added successfully!"} />


      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setProductToDelete(null);
        }}
        onConfirm={confirmDeleteProduct}
        itemName={
          productToDelete ?
            filteredProducts.find((p) => p._id === productToDelete)?.itemName :
            ""
        } />


      <ArchiveConfirmationModal
        isOpen={showArchiveModal}
        onClose={() => {
          setShowArchiveModal(false);
          setProductToArchive(null);
        }}
        onConfirm={confirmArchiveProduct}
        itemName={
          productToArchive ?
            filteredProducts.find((p) => p._id === productToArchive)?.itemName :
            ""
        } />


      <EditConfirmationModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setProductToEdit(null);
        }}
        onConfirm={confirmEditProduct}
        itemName={productToEdit?.itemName || editingProduct?.itemName || ""} />


      <ViewProductModal
        showViewModal={showViewModal}
        setShowViewModal={setShowViewModal}
        viewingProduct={viewingProduct}
        formatDate={formatDate} />


      {showStockModal && stockModalType === "in" &&
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
          brandPartners={brandPartners} />

      }

      {showStockModal && stockModalType === "out" &&
        <StockOutModal
          isOpen={showStockModal}
          onClose={() => {
            setShowStockModal(false);
            setEditingProduct(null);
            setStockAmount("");
          }}
          product={editingProduct}
          onConfirm={handleStockOutConfirm}
          loading={loading} />

      }

      {showImportResultModal &&
        <div className="fixed inset-0 flex items-center justify-center z-9999 p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-[#2D2D2D] rounded-2xl w-full max-w-2xl p-8 text-white shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">localhost:5173 says</h2>
            <div className="space-y-4 mb-6">
              <p className="text-lg">Import completed!</p>
              <div className="space-y-2">
                <p>Successful: {importResult.successCount}</p>
                <p>Failed: {importResult.errorCount}</p>
              </div>
              {importResult.errors.length > 0 &&
                <div className="mt-4">
                  <p className="mb-2">Showing first 5 errors:</p>
                  <div className="bg-black/30 rounded-lg p-4 max-h-60 overflow-y-auto">
                    {importResult.errors.slice(0, 5).map((error, idx) =>
                      <p key={idx} className="text-sm mb-1">
                        {error}
                      </p>
                    )}
                  </div>
                </div>
              }
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowImportResultModal(false)}
                className="px-8 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-colors">

                OK
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default memo(Inventory);