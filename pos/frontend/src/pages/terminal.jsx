import { memo, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import Pagination from "../components/inventory/Pagination";
import Header from "../components/shared/header";
import CashPaymentModal from "../components/terminal/CashPaymentModal";
import CheckoutConfirmationModal from "../components/terminal/CheckoutConfirmationModal";
import DiscountModal from "../components/terminal/DiscountModal";
import DuplicateItemModal from "../components/terminal/DuplicateItemModal";
import OrderSummary from "../components/terminal/OrderSummary";
import ProductCard from "../components/terminal/ProductCard";
import ProductDetailsModal from "../components/terminal/ProductDetailsModal";
import QRCodePaymentModal from "../components/terminal/QRCodePaymentModal";
import RemoveItemPinModal from "../components/terminal/RemoveItemPinModal";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { useDataCache } from "../context/DataCacheContext";
import { useTheme } from "../context/ThemeContext";

import accessoriesIcon from "../assets/inventory-icons/accesories.svg";
import allIcon from "../assets/inventory-icons/ALL.svg";
import bottomsIcon from "../assets/inventory-icons/Bottoms.svg";
import dressesIcon from "../assets/inventory-icons/dresses.svg";
import makeupIcon from "../assets/inventory-icons/make up.svg";
import shoesIcon from "../assets/inventory-icons/shoe.svg";
import topIcon from "../assets/inventory-icons/Top.svg";

const Terminal = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const { getCachedData, setCachedData, isCacheValid, invalidateCache } =
    useDataCache();
  // Get userId from currentUser for transaction recording and cart identification
  const userId =
    currentUser?._id || currentUser?.id || currentUser?.email || "guest";
  // Use the user's ID so each employee has their own cart
  const cartId = userId;
  const [products, setProducts] = useState(
    () => getCachedData("products") || [],
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discountAmount, setDiscountAmount] = useState("");
  const [selectedDiscounts, setSelectedDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [productQuantities, setProductQuantities] = useState({});
  const [productSizes, setProductSizes] = useState({});
  const [productVariants, setProductVariants] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false);
  const [showQRPaymentModal, setShowQRPaymentModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [cartReadyForSync, setCartReadyForSync] = useState(false);
  const [showRemoveItemModal, setShowRemoveItemModal] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingDuplicateItem, setPendingDuplicateItem] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [sortOption, setSortOption] = useState("newest");
  const itemsPerPage = 10;

  const resolveItemSize = (item = {}) => {
    if (item.selectedSize) return item.selectedSize;
    if (item.sizes && typeof item.sizes === "object") {
      return Object.keys(item.sizes)[0] || "";
    }
    if (item.size) return item.size;
    return "";
  };

  const normalizeCartItem = (item = {}) => ({
    ...item,
    _id: item._id || item.productId || item.id,
    productId: item.productId || item._id || item.id,
    itemPrice: item.itemPrice || item.price || 0,
    quantity: item.quantity || 1,
    selectedSize: resolveItemSize(item),
    sizes:
      item.sizes ||
      productSizes[item._id || item.productId] ||
      productSizes[item.productId || item._id] ||
      {},
  });

  const defaultCategories = [
    { name: "All", icon: allIcon },
    { name: "Tops", icon: topIcon },
    { name: "Bottoms", icon: bottomsIcon },
    { name: "Dresses", icon: dressesIcon },
    { name: "Makeup", icon: makeupIcon },
    { name: "Shoes", icon: shoesIcon },
    { name: "Essentials", icon: accessoriesIcon },
  ];

  const [categories, setCategories] = useState(defaultCategories);

  // Icon mapping for categories
  const categoryIconMap = {
    Tops: topIcon,
    Bottoms: bottomsIcon,
    Dresses: dressesIcon,
    Makeup: makeupIcon,
    Essentials: accessoriesIcon,
    Shoes: shoesIcon,
  };

  // Fetch active categories from API
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        // Filter only active categories and map with icons
        const activeDbCategories = data.data
          .filter((cat) => cat.status === "active")
          .map((cat) => ({
            name: cat.name,
            icon: categoryIconMap[cat.name] || allIcon,
          }));

        // Merge default and DB categories, avoiding duplicates
        const mergedCategories = [...defaultCategories];
        const defaultNames = new Set(defaultCategories.map((c) => c.name));

        activeDbCategories.forEach((cat) => {
          if (!defaultNames.has(cat.name)) {
            mergedCategories.push(cat);
          }
        });

        setCategories(mergedCategories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      // Fallback is already handled by initial state, so we just set to defaultCategories again if needed
      setCategories(defaultCategories);
    }
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
  }, []);

  // Load cart from server first (database is source of truth), fallback to localStorage
  // Cart is specific to each user - identified by userId
  useEffect(() => {
    let isMounted = true;

    const loadCart = async () => {
      try {
        // First, try to load from server (database) using shared cart ID
        const response = await fetch(
          `${API_BASE_URL}/api/cart/${encodeURIComponent(cartId)}`,
        );
        const data = await response.json();

        if (isMounted && data.success) {
          // If server has cart items, use them (database is source of truth)
          if (data.data?.items?.length) {
            setCart(data.data.items.map(normalizeCartItem));
          } else {
            // Server has no items - check localStorage as fallback
            try {
              const savedCart = localStorage.getItem(`pos_cart_${cartId}`);
              if (savedCart) {
                const parsedCart = JSON.parse(savedCart);
                if (Array.isArray(parsedCart) && parsedCart.length > 0) {
                  setCart(
                    parsedCart.map((item) =>
                      normalizeCartItem({
                        ...item,
                        sizes:
                          item.sizes ||
                          productSizes[item._id || item.productId] ||
                          {},
                      }),
                    ),
                  );
                }
              }
            } catch (localError) {
              console.warn(
                "Unable to load saved cart from localStorage",
                localError,
              );
            }
          }
        }
      } catch (error) {
        console.warn(
          "Unable to load cart from server, trying localStorage",
          error,
        );
        // Fallback to localStorage if server fails
        try {
          const savedCart = localStorage.getItem(`pos_cart_${cartId}`);
          if (savedCart) {
            const parsedCart = JSON.parse(savedCart);
            if (Array.isArray(parsedCart)) {
              setCart(
                parsedCart.map((item) =>
                  normalizeCartItem({
                    ...item,
                    sizes:
                      item.sizes ||
                      productSizes[item._id || item.productId] ||
                      {},
                  }),
                ),
              );
            }
          }
        } catch (localError) {
          console.warn(
            "Unable to load saved cart from localStorage",
            localError,
          );
        }
      } finally {
        if (isMounted) {
          setCartReadyForSync(true);
        }
      }
    };

    loadCart();

    return () => {
      isMounted = false;
    };
  }, [cartId]);

  useEffect(() => {
    if (!cartReadyForSync) return;

    const saveCartToServer = async () => {
      try {
        await fetch(
          `${API_BASE_URL}/api/cart/${encodeURIComponent(cartId)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ items: cart }),
          },
        );
      } catch (error) {
        console.warn("Unable to save cart to server", error);
      }
    };

    saveCartToServer();
  }, [cart, cartId, cartReadyForSync]);

  // Save cart to localStorage (user-specific)
  useEffect(() => {
    if (!cartReadyForSync) return;
    try {
      localStorage.setItem(`pos_cart_${cartId}`, JSON.stringify(cart));
    } catch (error) {
      console.warn("Unable to persist cart", error);
    }
  }, [cart, cartId, cartReadyForSync]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter out products that should not be displayed in terminal
    // Show products where displayInTerminal is true or undefined (for backward compatibility)
    filtered = filtered.filter(
      (product) => product.displayInTerminal !== false,
    );

    // Automatically hide products with 0 stock (regardless of displayInTerminal setting)
    filtered = filtered.filter((product) => {
      // Check if product has sizes
      if (
        product.sizes &&
        typeof product.sizes === "object" &&
        Object.keys(product.sizes).length > 0
      ) {
        // For products with sizes, check if any size has stock > 0
        const hasStock = Object.values(product.sizes).some((sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined
          ) {
            return sizeData.quantity > 0;
          }
          return (typeof sizeData === "number" ? sizeData : 0) > 0;
        });
        return hasStock;
      }
      // For products without sizes, check currentStock
      return (product.currentStock || 0) > 0;
    });

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (product) => product.category === selectedCategory,
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "a-z":
          return (a.itemName || "").localeCompare(b.itemName || "");
        case "z-a":
          return (b.itemName || "").localeCompare(a.itemName || "");
        case "oldest":
          return (
            new Date(a.dateAdded || a.createdAt || 0) -
            new Date(b.dateAdded || b.createdAt || 0)
          );
        case "newest":
        default:
          return (
            new Date(b.dateAdded || b.createdAt || 0) -
            new Date(a.dateAdded || a.createdAt || 0)
          );
      }
    });

    return filtered;
  }, [products, selectedCategory, searchQuery, sortOption]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

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
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = async (product) => {
    // Open modal immediately with basic product data
    setSelectedProduct(product);
    setShowProductModal(true);

    // Initialize quantity, size, and variant if not set
    if (!productQuantities[product._id]) {
      setProductQuantities({ ...productQuantities, [product._id]: 1 });
    }
    // Don't auto-select size - let user pick
    if (!productSizes[product._id]) {
      setProductSizes({ ...productSizes, [product._id]: "" });
    }
    // Don't auto-select variant - let user pick
    if (!productVariants[product._id]) {
      setProductVariants({ ...productVariants, [product._id]: "" });
    }

    // Fetch full product details (including sizes) in the background
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${product._id}`,
      );
      const data = await response.json();
      if (data.success && data.data) {
        setSelectedProduct(data.data);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    }
  };

  const handleCloseProductModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  const updateProductQuantity = (productId, delta) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    const currentQuantity = productQuantities[productId] || 1;
    const newQuantity = currentQuantity + delta;

    // Get available stock for the selected size and variant
    const selectedSize = productSizes[productId];
    const selectedVariant = productVariants[productId] || "";
    let availableStock = 0;

    // Helper to get quantity from variant data (handles both number and object formats)
    const getVariantQty = (variantData) => {
      if (typeof variantData === 'number') return variantData;
      if (typeof variantData === 'object' && variantData !== null) {
        return variantData.quantity || 0;
      }
      return 0;
    };

    if (product.sizes && typeof product.sizes === "object" && selectedSize) {
      const sizeData = product.sizes[selectedSize];
      
      // Check if this size has variants and a variant is selected
      if (typeof sizeData === "object" && sizeData !== null && sizeData.variants && selectedVariant) {
        // Get stock for the specific variant
        const variantData = sizeData.variants[selectedVariant];
        availableStock = getVariantQty(variantData);
      } else if (typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined) {
        // Handle object with quantity (no variants or simple variants)
        availableStock = sizeData.quantity;
      } else if (typeof sizeData === "number") {
        // Handle number format
        availableStock = sizeData;
      }
    } else {
      availableStock = product.currentStock || 0;
    }

    // Clamp quantity between 1 and available stock
    const clampedQuantity = Math.max(1, Math.min(newQuantity, availableStock));

    setProductQuantities({
      ...productQuantities,
      [productId]: clampedQuantity,
    });
  };

  const handleVariantSelection = (productId, variant) => {
    // Update selected variant
    setProductVariants({ ...productVariants, [productId]: variant });
    
    // Clear the size selection when variant changes (user must re-select size)
    setProductSizes({ ...productSizes, [productId]: "" });
    
    // Reset quantity to 1
    setProductQuantities({ ...productQuantities, [productId]: 1 });
  };

  const handleSizeSelection = (productId, size) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    // Update selected size
    setProductSizes({ ...productSizes, [productId]: size });

    // Get the selected variant (if product has variants)
    const selectedVariant = productVariants[productId] || "";

    // Helper to get quantity from variant data (handles both number and object formats)
    const getVariantQty = (variantData) => {
      if (typeof variantData === 'number') return variantData;
      if (typeof variantData === 'object' && variantData !== null) {
        return variantData.quantity || 0;
      }
      return 0;
    };

    // Get available stock for the new size
    let availableStock = 0;
    if (product.sizes && typeof product.sizes === "object" && size) {
      const sizeData = product.sizes[size];
      
      // Check if this size has variants
      if (typeof sizeData === "object" && sizeData !== null && sizeData.variants && selectedVariant) {
        // Get stock for the specific variant (handle both number and object format)
        const variantData = sizeData.variants[selectedVariant];
        availableStock = getVariantQty(variantData);
      } else if (typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined) {
        // Handle object with quantity
        availableStock = sizeData.quantity;
      } else if (typeof sizeData === "number") {
        // Handle number format
        availableStock = sizeData;
      }
    } else {
      availableStock = product.currentStock || 0;
    }

    // Adjust quantity if it exceeds available stock for the new size
    const currentQuantity = productQuantities[productId] || 1;
    if (currentQuantity > availableStock && availableStock > 0) {
      setProductQuantities({
        ...productQuantities,
        [productId]: availableStock,
      });
    } else if (availableStock === 0) {
      // If new size has no stock, set quantity to 1 (will be disabled by button)
      setProductQuantities({
        ...productQuantities,
        [productId]: 1,
      });
    }
  };

  const addToCartFromExpanded = (product) => {
    const quantity = productQuantities[product._id] || 1;
    const size = productSizes[product._id] || "";
    const variant = productVariants[product._id] || "";

    // Helper to get quantity from variant data (handles both number and object formats)
    const getVariantQty = (variantData) => {
      if (typeof variantData === 'number') return variantData;
      if (typeof variantData === 'object' && variantData !== null) {
        return variantData.quantity || 0;
      }
      return 0;
    };

    // Check if product has variants per size (stored in sizes[size].variants)
    const hasVariantsPerSize = () => {
      if (product.sizes && typeof product.sizes === "object") {
        return Object.values(product.sizes).some((sizeData) => {
          return typeof sizeData === "object" && sizeData !== null && 
                 sizeData.variants && typeof sizeData.variants === "object" &&
                 Object.keys(sizeData.variants).length > 0;
        });
      }
      return false;
    };

    // Check if product has simple variants (comma-separated in product.variant field)
    const hasSimpleVariants = () => {
      if (product.variant && typeof product.variant === 'string') {
        const variants = product.variant.split(',').map(v => v.trim()).filter(v => v.length > 0);
        return variants.length > 1;
      }
      return false;
    };

    const productHasSizeVariants = hasVariantsPerSize();
    const productHasSimpleVariants = hasSimpleVariants();
    const productHasAnyVariants = productHasSizeVariants || productHasSimpleVariants;

    // Validate variant selection for products with variants
    if (productHasAnyVariants && !variant) {
      alert("Please select a variant before adding to cart");
      return;
    }

    // Validate size selection for products with sizes
    if (
      product.sizes &&
      typeof product.sizes === "object" &&
      Object.keys(product.sizes).length > 0
    ) {
      if (!size) {
        alert("Please select a size before adding to cart");
        return;
      }
    }

    // Get available stock and price (handle both formats: number or object with quantity/price)
    let availableStock = 0;
    let itemPrice = product.itemPrice || 0;

    if (product.sizes && typeof product.sizes === "object" && size) {
      const sizeData = product.sizes[size];
      if (typeof sizeData === "object" && sizeData !== null) {
        // Check if this size has variants (per-size variants)
        if (sizeData.variants && variant && !productHasSimpleVariants) {
          // Get stock for the specific variant (handle both number and object format)
          const variantData = sizeData.variants[variant];
          availableStock = getVariantQty(variantData);
          
          // Get price from variant data object first
          if (typeof variantData === 'object' && variantData !== null && variantData.price !== undefined) {
            itemPrice = variantData.price;
          } else if (sizeData.variantPrices && sizeData.variantPrices[variant] !== undefined) {
            // Use variant-specific price from variantPrices
            itemPrice = sizeData.variantPrices[variant];
          } else if (sizeData.price !== undefined) {
            itemPrice = sizeData.price;
          }
        } else {
          // For simple variants or no variants, use size quantity
          availableStock = sizeData.quantity || 0;
          // Use size-specific price if available, otherwise use default price
          itemPrice =
            sizeData.price !== undefined
              ? sizeData.price
              : product.itemPrice || 0;
        }
      } else {
        availableStock = typeof sizeData === "number" ? sizeData : 0;
      }
    } else {
      availableStock = product.currentStock || 0;
    }

    // Check if there's enough stock
    if (availableStock <= 0) {
      alert("This item is out of stock");
      return;
    }

    // For products with variants, also check variant in the existing item match
    const existingItem = productHasAnyVariants
      ? cart.find(
          (item) => item._id === product._id && item.selectedSize === size && item.selectedVariation === variant,
        )
      : cart.find(
          (item) => item._id === product._id && item.selectedSize === size,
        );

    // Calculate total quantity that would be in cart after adding
    const totalQuantityAfterAdd = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    // Validate total quantity doesn't exceed available stock
    if (totalQuantityAfterAdd > availableStock) {
      alert(
        `Only ${availableStock} item(s) available in stock. You already have ${existingItem?.quantity || 0} in cart.`,
      );
      return;
    }

    const productToAdd = {
      ...product,
      productId: product._id,
      selectedSize: size,
      selectedVariation: variant, // Add selected variant
      quantity: quantity,
      itemPrice: itemPrice, // Use size/variant-specific price if available
    };

    // If item already exists in cart, show confirmation modal
    if (existingItem) {
      setPendingDuplicateItem({
        product: productToAdd,
        existingQuantity: existingItem.quantity,
      });
      setShowDuplicateModal(true);
      return;
    }

    // Add new item to cart
    setCart([...cart, productToAdd]);
    setExpandedProductId(null);
    // Close the product modal
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  // Handle confirming duplicate item addition
  const handleConfirmDuplicateAdd = () => {
    if (!pendingDuplicateItem) return;

    const { product } = pendingDuplicateItem;

    setCart(
      cart.map((item) =>
        item._id === product._id && 
        item.selectedSize === product.selectedSize &&
        item.selectedVariation === product.selectedVariation
          ? { ...item, quantity: item.quantity + product.quantity }
          : item,
      ),
    );

    setShowDuplicateModal(false);
    setPendingDuplicateItem(null);
    setExpandedProductId(null);
    // Close the product modal
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  // Handle canceling duplicate item addition
  const handleCancelDuplicateAdd = () => {
    setShowDuplicateModal(false);
    setPendingDuplicateItem(null);
  };

  const addToCart = (product) => {
    const defaultSize =
      product.sizes && typeof product.sizes === "object"
        ? Object.keys(product.sizes)[0] || ""
        : product.size || "";

    // Get size-specific price if available
    let itemPrice = product.itemPrice || 0;
    if (product.sizes && typeof product.sizes === "object" && defaultSize) {
      const sizeData = product.sizes[defaultSize];
      if (
        typeof sizeData === "object" &&
        sizeData !== null &&
        sizeData.price !== undefined
      ) {
        itemPrice = sizeData.price;
      }
    }

    const existingItem = cart.find(
      (item) =>
        item._id === product._id &&
        (item.selectedSize || "") === (defaultSize || ""),
    );

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item._id === product._id &&
          (item.selectedSize || "") === (defaultSize || "")
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          productId: product._id,
          selectedSize: defaultSize,
          quantity: 1,
          itemPrice: itemPrice,
        },
      ]);
    }
  };

  const updateQuantity = (itemOrId, newQuantity) => {
    // Handle both item object and productId for backward compatibility
    const item =
      typeof itemOrId === "object"
        ? itemOrId
        : cart.find((i) => i._id === itemOrId);
    const productId = typeof itemOrId === "object" ? itemOrId._id : itemOrId;

    if (newQuantity <= 0) {
      // Show PIN modal before removing
      if (item) {
        handleRemoveItemClick(item);
      } else {
        removeFromCart(productId);
      }
    } else {
      setCart(
        cart.map((item) =>
          item._id === productId ? { ...item, quantity: newQuantity } : item,
        ),
      );
    }
  };

  const handleRemoveItemClick = (item) => {
    setItemToRemove(item);
    setShowRemoveItemModal(true);
  };

  const recordVoidedItem = async (item, voidReason) => {
    try {
      await fetch(`${API_BASE_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          performedById: currentUser?._id || currentUser?.id,
          performedByName: currentUser?.name,
          items: [
            {
              productId: item.productId || item._id,
              itemName: item.itemName,
              sku: item.sku,
              variant: item.variant,
              selectedSize: resolveItemSize(item) || null,
              quantity: item.quantity || 1,
              price: item.itemPrice || 0,
              itemImage: item.itemImage || "",
              voidReason: voidReason || null,
            },
          ],
          paymentMethod: "void",
          amountReceived: 0,
          changeGiven: 0,
          referenceNo: `VOID-${Date.now()}`,
          totalAmount: (item.itemPrice || 0) * (item.quantity || 1),
          status: "Voided",
          voidReason: voidReason || null,
        }),
      });
    } catch (error) {
      console.warn("Failed to record void transaction", error);
    }
  };

  const confirmRemoveItem = async (voidReason) => {
    console.log(
      "[confirmRemoveItem] Called with reason:",
      voidReason,
      "itemToRemove:",
      itemToRemove,
    );

    if (!itemToRemove) {
      console.warn("[confirmRemoveItem] No item to remove");
      setShowRemoveItemModal(false);
      setItemToRemove(null);
      return;
    }

    if (!voidReason) {
      console.warn("[confirmRemoveItem] No void reason provided");
      return;
    }

    // Store itemToRemove in a variable to avoid closure issues
    // Deep clone to ensure we have all properties
    const itemToVoid = JSON.parse(JSON.stringify(itemToRemove));

    try {
      let itemWasRemoved = false;
      let removedItemDetails = null;

      // Log the item to void for debugging
      console.log("[confirmRemoveItem] Item to void details:", {
        _id: itemToVoid._id,
        productId: itemToVoid.productId,
        id: itemToVoid.id,
        selectedSize: itemToVoid.selectedSize,
        size: itemToVoid.size,
        sizes: itemToVoid.sizes,
        resolvedSize: resolveItemSize(itemToVoid),
        fullItem: itemToVoid,
      });

      // Remove item from cart and verify it was actually removed
      flushSync(() => {
        setCart((prevCart) => {
          console.log(
            "[confirmRemoveItem] Current cart before removal (length:",
            prevCart.length,
            "):",
            prevCart.map((item) => ({
              _id: item._id,
              productId: item.productId,
              id: item.id,
              selectedSize: item.selectedSize,
              size: item.size,
              resolvedSize: resolveItemSize(item),
              quantity: item.quantity,
            })),
          );

          const initialLength = prevCart.length;
          const newCart = [];
          let foundMatch = false;

          // Use a more explicit loop to find and remove the item
          for (const item of prevCart) {
            // Normalize IDs for comparison (convert to string for comparison)
            const itemId = String(
              item._id || item.productId || item.id || "",
            ).trim();
            const voidId = String(
              itemToVoid._id || itemToVoid.productId || itemToVoid.id || "",
            ).trim();
            const sameProduct =
              itemId !== "" && voidId !== "" && itemId === voidId;

            // Compare sizes - use selectedSize first, then resolveItemSize as fallback
            const itemSize = String(
              item.selectedSize || item.size || resolveItemSize(item) || "",
            )
              .toLowerCase()
              .trim();
            const voidSize = String(
              itemToVoid.selectedSize ||
                itemToVoid.size ||
                resolveItemSize(itemToVoid) ||
                "",
            )
              .toLowerCase()
              .trim();
            const sameSize =
              itemSize === voidSize || (itemSize === "" && voidSize === "");

            // Item should be removed if both product and size match
            const shouldRemove = sameProduct && sameSize;

            if (shouldRemove) {
              console.log(
                "[confirmRemoveItem] ✓ MATCH FOUND - Removing item:",
                {
                  itemId,
                  voidId,
                  itemSelectedSize: item.selectedSize,
                  voidSelectedSize: itemToVoid.selectedSize,
                  itemSize,
                  voidSize,
                  sameProduct,
                  sameSize,
                },
              );
              foundMatch = true;
              removedItemDetails = { ...item };
              // Don't add this item to newCart (effectively removing it)
              continue;
            }

            // Keep this item in the cart
            newCart.push(item);
          }

          const finalLength = newCart.length;
          itemWasRemoved = foundMatch && initialLength > finalLength;

          // Double-check: verify the item is actually not in the new cart
          const itemStillInCart = newCart.some((item) => {
            const itemId = String(
              item._id || item.productId || item.id || "",
            ).trim();
            const voidId = String(
              itemToVoid._id || itemToVoid.productId || itemToVoid.id || "",
            ).trim();
            const sameProduct =
              itemId !== "" && voidId !== "" && itemId === voidId;

            const itemSize = String(
              item.selectedSize || item.size || resolveItemSize(item) || "",
            )
              .toLowerCase()
              .trim();
            const voidSize = String(
              itemToVoid.selectedSize ||
                itemToVoid.size ||
                resolveItemSize(itemToVoid) ||
                "",
            )
              .toLowerCase()
              .trim();
            const sameSize =
              itemSize === voidSize || (itemSize === "" && voidSize === "");

            return sameProduct && sameSize;
          });

          // Item was removed if we found a match, length decreased, AND item is not in new cart
          itemWasRemoved =
            foundMatch && initialLength > finalLength && !itemStillInCart;

          console.log("[confirmRemoveItem] Cart update result:", {
            foundMatch,
            oldLength: initialLength,
            newLength: finalLength,
            lengthDecreased: initialLength > finalLength,
            itemStillInCart,
            itemWasRemoved,
            removedItem: removedItemDetails,
            newCartItems: newCart.map((item) => ({
              _id: item._id,
              productId: item.productId,
              selectedSize: item.selectedSize,
              resolvedSize: resolveItemSize(item),
              quantity: item.quantity,
            })),
          });

          // Force a re-render by returning the new cart
          // This ensures OrderSummary receives the updated cart
          return newCart;
        });
      });

      // Verify the cart was actually updated by checking the current cart state
      // Use a small delay to ensure state has updated
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Double-check the cart state after update
      const verifyCartUpdate = () => {
        return new Promise((resolve) => {
          // Use a callback to get the latest cart state
          setCart((currentCart) => {
            const itemStillExists = currentCart.some((item) => {
              const itemId = String(
                item._id || item.productId || item.id || "",
              ).trim();
              const voidId = String(
                itemToVoid._id || itemToVoid.productId || itemToVoid.id || "",
              ).trim();
              const sameProduct =
                itemId !== "" && voidId !== "" && itemId === voidId;

              const itemSize = String(
                item.selectedSize || item.size || resolveItemSize(item) || "",
              )
                .toLowerCase()
                .trim();
              const voidSize = String(
                itemToVoid.selectedSize ||
                  itemToVoid.size ||
                  resolveItemSize(itemToVoid) ||
                  "",
              )
                .toLowerCase()
                .trim();
              const sameSize =
                itemSize === voidSize || (itemSize === "" && voidSize === "");

              return sameProduct && sameSize;
            });

            resolve(!itemStillExists);
            return currentCart; // Don't modify, just check
          });
        });
      };

      const verifiedRemoved = await verifyCartUpdate();

      if (!verifiedRemoved) {
        itemWasRemoved = false;
        console.error(
          "[confirmRemoveItem] ❌ Verification failed: Item still exists in cart after update!",
        );
      }

      // Only proceed if item was actually removed from cart
      if (!itemWasRemoved || !verifiedRemoved) {
        console.error(
          "[confirmRemoveItem] ❌ Item was NOT removed from cart! Aborting void transaction.",
        );
        console.error("[confirmRemoveItem] Debug info:", {
          itemToVoid: {
            _id: itemToVoid._id,
            productId: itemToVoid.productId,
            id: itemToVoid.id,
            selectedSize: itemToVoid.selectedSize,
            size: itemToVoid.size,
            resolvedSize: resolveItemSize(itemToVoid),
          },
          currentCart: cart.map((item) => ({
            _id: item._id,
            productId: item.productId,
            id: item.id,
            selectedSize: item.selectedSize,
            size: item.size,
            resolvedSize: resolveItemSize(item),
          })),
        });
        alert(
          "Failed to remove item from cart. The item may have already been removed or the IDs do not match. Please check the console for details.",
        );
        // CRITICAL: Don't record void transaction if item wasn't removed
        // This ensures void transactions are only logged when items are actually removed
        return;
      }

      // CRITICAL CHECK: Verify itemWasRemoved is true before proceeding
      if (itemWasRemoved !== true) {
        console.error(
          "[confirmRemoveItem] ❌ Safety check failed: itemWasRemoved is not true! Aborting.",
        );
        return;
      }

      // Item was successfully removed - now record the void transaction
      console.log(
        "[confirmRemoveItem] ✅ Item removed successfully, recording void transaction...",
      );
      recordVoidedItem(itemToVoid, voidReason)
        .then(() => {
          console.log(
            "[confirmRemoveItem] Void transaction recorded successfully",
          );
          // Close modal and clear item only after void is recorded
          setShowRemoveItemModal(false);
          setItemToRemove(null);
          console.log("[confirmRemoveItem] Modal closed and item cleared");
        })
        .catch((error) => {
          console.error(
            "[confirmRemoveItem] Error recording void transaction:",
            error,
          );
          // Even if recording fails, item is already removed from cart
          // So we should still close the modal
          setShowRemoveItemModal(false);
          setItemToRemove(null);
          alert(
            "Item removed from cart, but failed to record void transaction. Please check logs.",
          );
        });
    } catch (error) {
      console.error("[confirmRemoveItem] Error:", error);
      alert("Failed to void item. Please try again.");
      // Make sure modal stays open on error so user can retry
    }
  };

  const removeFromCart = (item) => {
    // This function is called from OrderSummary
    // Show PIN verification modal first
    handleRemoveItemClick(item);
  };

  // Direct remove function that doesn't trigger PIN modal
  // Used by OrderSummary for bulk void operations where PIN is already verified
  const removeFromCartDirect = (item) => {
    setCart((prevCart) => {
      const itemId = String(item._id || item.productId || item.id || "").trim();
      const itemSize = String(item.selectedSize || item.size || "")
        .toLowerCase()
        .trim();

      return prevCart.filter((cartItem) => {
        const cartItemId = String(
          cartItem._id || cartItem.productId || cartItem.id || "",
        ).trim();
        const cartItemSize = String(
          cartItem.selectedSize || cartItem.size || "",
        )
          .toLowerCase()
          .trim();

        // Keep items that don't match
        const sameProduct = cartItemId === itemId;
        const sameSize =
          cartItemSize === itemSize || (cartItemSize === "" && itemSize === "");

        return !(sameProduct && sameSize);
      });
    });
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.itemPrice * item.quantity, 0);
  }, [cart]);

  // Validate discount function - must be defined before useMemo hooks
  const validateDiscountForCart = (discountItem, cartItems) => {
    if (!discountItem || !cartItems || cartItems.length === 0) {
      return { valid: false, message: "Cart is empty" };
    }

    // Use appliesToType for logic checks (original value: 'all', 'category', 'products')
    const appliesToType = discountItem.appliesToType || discountItem.appliesTo;

    // If discount applies to all products, it's always valid
    if (appliesToType === "all") {
      return { valid: true };
    }

    // If discount applies to a specific category
    if (appliesToType === "category" && discountItem.category) {
      const hasMatchingItem = cartItems.some((item) => {
        // First check if item has category field
        let itemCategory = item.category;

        // If not, try to find it from products array
        if (!itemCategory) {
          const productId = item._id || item.productId || item.id;
          const product = products.find((p) => {
            const pId = p._id || p.id;
            return pId && productId && pId.toString() === productId.toString();
          });
          itemCategory = product?.category;
        }

        // Check if item's category matches the discount category
        return itemCategory === discountItem.category;
      });

      if (!hasMatchingItem) {
        return {
          valid: false,
          message: `This discount only applies to items in the "${discountItem.category}" category.`,
        };
      }
      return { valid: true };
    }

    // If discount applies to specific products
    if (
      appliesToType === "products" &&
      discountItem.productIds &&
      discountItem.productIds.length > 0
    ) {
      const hasMatchingItem = cartItems.some((item) => {
        const itemId = item._id || item.productId || item.id;
        return discountItem.productIds.some((pid) => {
          const pidStr = pid.toString ? pid.toString() : pid;
          const itemIdStr = itemId.toString ? itemId.toString() : itemId;
          return pidStr === itemIdStr;
        });
      });

      if (!hasMatchingItem) {
        return {
          valid: false,
          message:
            "This discount only applies to specific products. Your cart does not contain any eligible items.",
        };
      }
      return { valid: true };
    }

    return { valid: false, message: "Discount configuration is invalid" };
  };

  // Auto-validate and remove invalid discounts when cart changes
  useEffect(() => {
    if (selectedDiscounts.length > 0 && cart.length > 0) {
      const validDiscounts = selectedDiscounts.filter((discount) => {
        const validation = validateDiscountForCart(discount, cart);
        return validation.valid;
      });

      if (validDiscounts.length !== selectedDiscounts.length) {
        setSelectedDiscounts(validDiscounts);
        if (validDiscounts.length === 0) {
          setDiscountAmount("");
        }
      }
    }
  }, [cart, selectedDiscounts, products]);

  // Calculate total discount from all selected discounts
  const discount = useMemo(() => {
    if (selectedDiscounts.length === 0) {
      return parseFloat(discountAmount) || 0;
    }

    let totalDiscount = 0;

    for (const selectedDiscount of selectedDiscounts) {
      // Validate discount against current cart - if invalid, skip
      const validation = validateDiscountForCart(selectedDiscount, cart);
      if (!validation.valid) {
        continue;
      }

      // Safely check discountValue
      const discountValueStr = selectedDiscount.discountValue || "";

      try {
        let totalEligibleAmount = 0;
        const appliesToType =
          selectedDiscount.appliesToType || selectedDiscount.appliesTo;

        // Calculate eligible amount based on discount type
        if (appliesToType === "all") {
          totalEligibleAmount = subtotal;
        } else if (appliesToType === "category" && selectedDiscount.category) {
          totalEligibleAmount = cart.reduce((sum, item) => {
            // Find item category
            let itemCategory = item.category;
            if (!itemCategory) {
              const productId = item._id || item.productId || item.id;
              const product = products.find((p) => {
                const pId = p._id || p.id;
                return (
                  pId && productId && pId.toString() === productId.toString()
                );
              });
              itemCategory = product?.category;
            }

            if (itemCategory === selectedDiscount.category) {
              return sum + item.itemPrice * item.quantity;
            }
            return sum;
          }, 0);
        } else if (
          appliesToType === "products" &&
          selectedDiscount.productIds &&
          selectedDiscount.productIds.length > 0
        ) {
          totalEligibleAmount = cart.reduce((sum, item) => {
            const itemId = item._id || item.productId || item.id;
            const isEligible = selectedDiscount.productIds.some((pid) => {
              const pidStr = pid.toString ? pid.toString() : pid;
              const itemIdStr = itemId.toString ? itemId.toString() : itemId;
              return pidStr === itemIdStr;
            });

            if (isEligible) {
              return sum + item.itemPrice * item.quantity;
            }
            return sum;
          }, 0);
        }

        // Recalculate discount based on selected discount and ELIGIBLE amount
        if (
          typeof discountValueStr === "string" &&
          discountValueStr.includes("%")
        ) {
          const percentage = parseFloat(
            discountValueStr.replace("% OFF", "").replace(/\s/g, ""),
          );
          if (!isNaN(percentage)) {
            totalDiscount += (totalEligibleAmount * percentage) / 100;
          }
        } else if (
          typeof discountValueStr === "string" &&
          (discountValueStr.includes("P") || discountValueStr.includes("₱"))
        ) {
          const amount = parseFloat(discountValueStr.replace(/[P₱\sOFF]/g, ""));
          if (!isNaN(amount)) {
            // For fixed amount, generally applied once if conditions met
            // Could limit to eligible amount if needed: Math.min(amount, totalEligibleAmount)
            totalDiscount += amount;
          }
        }
      } catch (error) {
        console.error("Error calculating discount:", error);
      }
    }

    return totalDiscount || parseFloat(discountAmount) || 0;
  }, [discountAmount, selectedDiscounts, subtotal, cart, products]);

  const total = useMemo(() => {
    return subtotal - discount;
  }, [subtotal, discount]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    setShowCheckoutModal(true);
  };

  const confirmCheckout = () => {
    setShowCheckoutModal(false);
    alert("Proceeding to checkout...");
  };

  const handleCashPayment = () => {
    setShowCashPaymentModal(true);
  };

  const mapCartItemsForStockUpdate = () =>
    cart.map((item) => ({
      _id: item.productId || item._id,
      sku: item.sku || null,
      size: resolveItemSize(item) || null,
      quantity: item.quantity || 1,
    }));

  const mapCartItemsForTransaction = () =>
    cart.map((item) => ({
      productId: item.productId || item._id,
      itemName: item.itemName,
      sku: item.sku,
      variant: item.variant,
      selectedSize: resolveItemSize(item) || null,
      quantity: item.quantity || 1,
      price: item.itemPrice || 0,
      itemImage: item.itemImage || "",
    }));

  const finalizeTransaction = async (meta = {}) => {
    if (!cart.length) return null;

    // Store cart snapshot for restoration on error
    const cartSnapshot = [...cart];

    try {
      // Step 1: Record the transaction FIRST (before updating stock)
      const transactionResponse = await fetch(
        `${API_BASE_URL}/api/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            items: mapCartItemsForTransaction(),
            paymentMethod: meta.paymentMethod || "cash",
            amountReceived: meta.amountReceived,
            changeGiven: meta.change,
            referenceNo: meta.referenceNo,
            receiptNo: meta.receiptNo,
            totalAmount: total,
            performedById: currentUser?._id || currentUser?.id,
            performedByName: currentUser?.name,
            status: "Completed",
            appliedDiscountIds: selectedDiscounts.map((d) => d._id),
          }),
        },
      );

      // Check transaction result FIRST
      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            `Transaction recording failed: ${transactionResponse.status} ${transactionResponse.statusText}`,
        );
      }

      const transactionData = await transactionResponse.json();
      if (!transactionData.success) {
        throw new Error(
          transactionData.message ||
            transactionData.error ||
            "Failed to record transaction",
        );
      }

      // Step 2: Transaction succeeded - NOW update stock
      // Clear cart after successful transaction
      setCart([]);
      setSelectedDiscounts([]);
      setDiscountAmount("");

      // Invalidate cache so next fetch gets fresh data
      invalidateCache("products");
      invalidateCache("transactions");

      const stockUpdateResponse = await fetch(
        `${API_BASE_URL}/api/products/update-stock`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: mapCartItemsForStockUpdate(),
            performedByName:
              currentUser?.name ||
              `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim() ||
              "System",
            performedById: currentUser?._id || currentUser?.id || "",
          }),
        },
      );

      // Check stock update result
      if (!stockUpdateResponse.ok) {
        const errorData = await stockUpdateResponse.json().catch(() => ({}));
        console.error("Stock update failed after transaction:", errorData);
        // Don't restore cart - transaction already succeeded
        // Just log the error and continue
      } else {
        const stockData = await stockUpdateResponse.json();
        if (!stockData.success) {
          console.error("Stock update failed after transaction:", stockData);
          // Don't restore cart - transaction already succeeded
        }
      }

      // Success - products will refresh on next view automatically due to cache invalidation
      fetchProducts().catch((err) =>
        console.warn("Background product refresh failed:", err),
      );

      // Return the transaction data including the receipt number
      return transactionData.data;
    } catch (error) {
      console.error("Error finalizing transaction:", error);
      // Restore cart on error (transaction failed, stock was NOT updated)
      setCart(cartSnapshot);
      const errorMessage = error.message || "Unknown error occurred";
      alert(
        `Transaction failed: ${errorMessage}\n\nYour cart has been restored. Please try again.`,
      );
      throw error;
    }
  };

  const handleCashProceed = async (amountReceived, change, receiptNo) => {
    console.log("handleCashProceed received receiptNo:", receiptNo);
    setShowCashPaymentModal(false);
    return await finalizeTransaction({
      paymentMethod: "cash",
      amountReceived,
      change,
      receiptNo,
    });
  };

  const handleQRPayment = () => {
    setShowQRPaymentModal(true);
  };

  /**
   * Called by QRCodePaymentModal when GCash payment is confirmed via webhook.
   * The transaction is already created in the backend by the payment controller,
   * so we just need to clear cart, invalidate caches, and refresh products.
   */
  const handleGCashTransactionComplete = (paymentData) => {
    console.log("[GCash] Transaction complete:", paymentData);

    // Clear cart — transaction already saved in backend by gcashPaymentController
    setCart([]);
    setSelectedDiscounts([]);
    setDiscountAmount("");

    // Invalidate caches
    invalidateCache("products");
    invalidateCache("transactions");

    // Stock is updated asynchronously on the server after webhook confirmation,
    // so we need a short delay before refreshing to get updated stock values.
    setTimeout(() => {
      fetchProducts().catch((err) =>
        console.warn("Background product refresh failed:", err),
      );
    }, 1500);

    // Second refresh to catch any slower stock updates
    setTimeout(() => {
      invalidateCache("products");
      fetchProducts().catch((err) =>
        console.warn("Second product refresh failed:", err),
      );
    }, 4000);

    // Close QR modal
    setShowQRPaymentModal(false);
  };

  const handleSelectDiscount = (discountItem) => {
    try {
      // Validate discount item exists
      if (!discountItem) {
        console.error("No discount item provided");
        alert("Invalid discount selected. Please try again.");
        return;
      }

      // Check if discount is already selected
      const alreadySelected = selectedDiscounts.some(
        (d) => d._id === discountItem._id,
      );
      if (alreadySelected) {
        alert("This discount is already applied.");
        return;
      }

      // Validate discount against current cart
      const validation = validateDiscountForCart(discountItem, cart);

      if (!validation.valid) {
        alert(validation.message);
        return;
      }

      // Add to selected discounts array
      setSelectedDiscounts((prev) => [...prev, discountItem]);

      // Update discount amount (will be recalculated by useMemo)
      setDiscountAmount("");
    } catch (error) {
      console.error("Error selecting discount:", error);
      alert("An error occurred while applying the discount. Please try again.");
    }
  };

  const handleRemoveDiscount = (discountId) => {
    if (discountId) {
      // Remove specific discount by ID
      setSelectedDiscounts((prev) => prev.filter((d) => d._id !== discountId));
    } else {
      // Clear all discounts (backward compatibility)
      setSelectedDiscounts([]);
    }
    setDiscountAmount("");
  };

  return (
    <>
      <div
        className={`relative flex flex-col h-screen ${theme === "dark" ? "bg-[#121212]" : "bg-[#F5F5F5]"}`}
      >
        <div
          className={`absolute top-0 left-0 right-[420px] px-6 py-4 z-40 transition-colors duration-300 flex flex-col gap-4 ${theme === "dark" ? "bg-[#121212]" : "bg-[#F5F5F5]"}`}
          style={{ paddingRight: "24px" }}
        >
          <Header
            pageName="Terminal"
            showSearch={true}
            showFilter={true}
            searchValue={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
            profileBackground=""
            showBorder={false}
            hidePageName={true}
            centerProfile={false}
            profileMinWidth="220px"
            profilePadding="px-4"
            profileGap="gap-3"
            sortOption={sortOption}
            onSortChange={setSortOption}
          />

          {/* Categories Chips */}
          <div className="grid grid-cols-7 gap-3 pb-2 w-full">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex items-center justify-center px-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border truncate ${
                  selectedCategory === cat.name
                    ? "bg-[#AD7F65] text-white border-[#AD7F65] shadow-md"
                    : theme === "dark"
                      ? "bg-[#2A2724] text-gray-300 border-gray-600 hover:bg-[#352F2A]"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
                title={cat.name}
              >
                <span className="truncate w-full text-center">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className="flex-1 overflow-auto p-6"
            style={{
              paddingTop: `${130 + Math.ceil(categories.length / 7) * 50}px`,
            }}
          >
            <div>
              <h2
                className={`text-lg font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}
              >
                Products
              </h2>
              {loading ? (
                <div
                  className={`text-center py-10 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                >
                  Loading...
                </div>
              ) : filteredProducts.length === 0 ? (
                <div
                  className={`text-center py-10 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
                >
                  No products found
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-4 items-start">
                  {paginatedProducts.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      onToggleExpand={() => handleProductClick(product)}
                    />
                  ))}
                </div>
              )}
            </div>
            {filteredProducts.length >= itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredProducts.length / itemsPerPage)}
                onPageChange={setCurrentPage}
              />
            )}
          </div>

          <div
            className={`w-[420px] border-l-0 p-4 relative ${theme === "dark" ? "bg-[#121212]" : "bg-gray-50"}`}
          >
            <OrderSummary
              cart={cart}
              products={products}
              removeFromCart={removeFromCart}
              removeFromCartDirect={removeFromCartDirect}
              updateQuantity={updateQuantity}
              discountAmount={discountAmount}
              setDiscountAmount={setDiscountAmount}
              selectedDiscounts={selectedDiscounts}
              onRemoveDiscount={handleRemoveDiscount}
              calculateSubtotal={() => subtotal}
              calculateDiscount={() => discount}
              calculateTotal={() => total}
              handleCheckout={handleCheckout}
              onCashPayment={handleCashPayment}
              onQRPayment={handleQRPayment}
              onOpenDiscountModal={() => setShowDiscountModal(true)}
              onSelectDiscount={handleSelectDiscount}
            />
          </div>
        </div>
      </div>

      <CheckoutConfirmationModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onConfirm={confirmCheckout}
      />

      <CashPaymentModal
        isOpen={showCashPaymentModal}
        onClose={() => setShowCashPaymentModal(false)}
        totalAmount={total}
        subtotalAmount={subtotal}
        discountAmount={discount}
        selectedDiscounts={selectedDiscounts}
        onProceed={handleCashProceed}
        cartItems={cart}
        cashierName={currentUser?.name}
      />

      <QRCodePaymentModal
        isOpen={showQRPaymentModal}
        onClose={() => setShowQRPaymentModal(false)}
        totalAmount={total}
        subtotalAmount={subtotal}
        discountAmount={discount}
        selectedDiscounts={selectedDiscounts}
        cartItems={cart}
        userId={userId}
        performedById={currentUser?._id || currentUser?.id}
        performedByName={currentUser?.name}
        onTransactionComplete={handleGCashTransactionComplete}
      />

      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        onSelectDiscount={handleSelectDiscount}
        cart={cart}
        products={products}
        selectedDiscounts={selectedDiscounts}
      />

      <RemoveItemPinModal
        isOpen={showRemoveItemModal}
        onClose={() => {
          setShowRemoveItemModal(false);
          setItemToRemove(null);
        }}
        onConfirm={confirmRemoveItem}
        item={itemToRemove}
      />

      <DuplicateItemModal
        isOpen={showDuplicateModal}
        onClose={handleCancelDuplicateAdd}
        onConfirm={handleConfirmDuplicateAdd}
        item={pendingDuplicateItem?.product}
        existingQuantity={pendingDuplicateItem?.existingQuantity || 0}
      />

      <ProductDetailsModal
        isOpen={showProductModal}
        onClose={handleCloseProductModal}
        product={selectedProduct}
        productQuantity={
          selectedProduct ? productQuantities[selectedProduct._id] || 1 : 1
        }
        onDecrement={() =>
          selectedProduct && updateProductQuantity(selectedProduct._id, -1)
        }
        onIncrement={() =>
          selectedProduct && updateProductQuantity(selectedProduct._id, 1)
        }
        onAdd={() => selectedProduct && addToCartFromExpanded(selectedProduct)}
        selectedSize={selectedProduct ? productSizes[selectedProduct._id] : ""}
        onSelectSize={(size) =>
          selectedProduct && handleSizeSelection(selectedProduct._id, size)
        }
        selectedVariant={selectedProduct ? productVariants[selectedProduct._id] : ""}
        onSelectVariant={(variant) =>
          selectedProduct && handleVariantSelection(selectedProduct._id, variant)
        }
      />
    </>
  );
};

export default memo(Terminal);
