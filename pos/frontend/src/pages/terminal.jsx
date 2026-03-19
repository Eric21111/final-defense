import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const { cache, getCachedData, setCachedData, isCacheValid, invalidateCache } =
    useDataCache();

  const userId =
    currentUser?._id || currentUser?.id || currentUser?.email || "guest";

  const cartId = userId;
  const [products, setProducts] = useState(
    () => getCachedData("products") || []
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
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);
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
    selectedVariation: item.selectedVariation || item.variant || '',
    sizes:
      item.sizes ||
      productSizes[item._id || item.productId] ||
      productSizes[item.productId || item._id] ||
      {}
  });

  const defaultCategories = [
    { name: "All", icon: allIcon },
    { name: "Tops", icon: topIcon },
    { name: "Bottoms", icon: bottomsIcon },
    { name: "Dresses", icon: dressesIcon },
    { name: "Makeup", icon: makeupIcon },
    { name: "Shoes", icon: shoesIcon },
    { name: "Essentials", icon: accessoriesIcon }];


  const [categories, setCategories] = useState(defaultCategories);


  const categoryIconMap = {
    Tops: topIcon,
    Bottoms: bottomsIcon,
    Dresses: dressesIcon,
    Makeup: makeupIcon,
    Essentials: accessoriesIcon,
    Shoes: shoesIcon
  };


  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/categories`);
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {

        const activeDbCategories = data.data.
          filter((cat) => cat.status === "active").
          map((cat) => ({
            name: cat.name,
            icon: categoryIconMap[cat.name] || allIcon
          }));


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

      setCategories(defaultCategories);
    }
  };


  useEffect(() => {
    const cachedProducts = getCachedData("products");
    if (!cachedProducts || !isCacheValid("products")) {
      fetchProducts();
    } else {
      setProducts(cachedProducts);
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (Array.isArray(cache?.products) && cache.products.length) {
      setProducts(cache.products);
    }
  }, [cache?.products]);



  useEffect(() => {
    let isMounted = true;

    const loadCart = async () => {
      try {

        const response = await fetch(
          `${API_BASE_URL}/api/cart/${encodeURIComponent(cartId)}`
        );
        const data = await response.json();

        if (isMounted && data.success) {

          if (data.data?.items?.length) {
            setCart(data.data.items.map(normalizeCartItem));
          } else {

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
                          {}
                      })
                    )
                  );
                }
              }
            } catch (localError) {
              console.warn(
                "Unable to load saved cart from localStorage",
                localError
              );
            }
          }
        }
      } catch (error) {
        console.warn(
          "Unable to load cart from server, trying localStorage",
          error
        );

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
                      {}
                  })
                )
              );
            }
          }
        } catch (localError) {
          console.warn(
            "Unable to load saved cart from localStorage",
            localError
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
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ items: cart })
          }
        );
      } catch (error) {
        console.warn("Unable to save cart to server", error);
      }
    };

    saveCartToServer();
  }, [cart, cartId, cartReadyForSync]);


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



    filtered = filtered.filter(
      (product) => product.displayInTerminal !== false
    );


    filtered = filtered.filter((product) => {

      if (
        product.sizes &&
        typeof product.sizes === "object" &&
        Object.keys(product.sizes).length > 0) {

        const hasStock = Object.values(product.sizes).some((sizeData) => {
          if (
            typeof sizeData === "object" &&
            sizeData !== null &&
            sizeData.quantity !== undefined) {
            return sizeData.quantity > 0;
          }
          return (typeof sizeData === "number" ? sizeData : 0) > 0;
        });
        return hasStock;
      }

      return (product.currentStock || 0) > 0;
    });

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (product) => product.category === selectedCategory
      );
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (product) =>
          product.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          product.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }


    filtered = [...filtered].sort((a, b) => {
      switch (sortOption) {
        case "a-z":
          return (a.itemName || "").localeCompare(b.itemName || "");
        case "z-a":
          return (b.itemName || "").localeCompare(a.itemName || "");
        case "oldest":
          return (
            new Date(a.dateAdded || a.createdAt || 0) -
            new Date(b.dateAdded || b.createdAt || 0));

        case "newest":
        default:
          return (
            new Date(b.dateAdded || b.createdAt || 0) -
            new Date(a.dateAdded || a.createdAt || 0));

      }
    });

    return filtered;
  }, [products, selectedCategory, searchQuery, sortOption]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const fetchProducts = async (background = false) => {
    try {
      if (!background) setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/products`);
      const data = await response.json();

      if (data.success) {
        setProducts(data.data);
        setCachedData("products", data.data);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      if (!background) setLoading(false);
    }
  };


  const productMap = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const pId = String(p._id || p.id);
      if (pId) {
        map.set(pId, p);
      }
    });
    return map;
  }, [products]);

  const handleProductClick = useCallback(async (product) => {

    setSelectedProduct(product);
    setShowProductModal(true);


    if (!productQuantities[product._id]) {
      setProductQuantities({ ...productQuantities, [product._id]: 1 });
    }

    if (!productSizes[product._id]) {
      setProductSizes({ ...productSizes, [product._id]: "" });
    }

    if (!productVariants[product._id]) {
      setProductVariants({ ...productVariants, [product._id]: "" });
    }


    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${product._id}`
      );
      const data = await response.json();
      if (data.success && data.data) {
        setSelectedProduct(data.data);
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    }
  }, [productQuantities, productSizes, productVariants]);

  const handleCloseProductModal = useCallback(() => {
    setShowProductModal(false);
    setSelectedProduct(null);
  }, []);

  const updateProductQuantity = (productId, delta) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;

    const currentQuantity = productQuantities[productId] || 1;
    const newQuantity = currentQuantity + delta;


    const selectedSize = productSizes[productId];
    const selectedVariant = productVariants[productId] || "";
    let availableStock = 0;


    const getVariantQty = (variantData) => {
      if (typeof variantData === 'number') return variantData;
      if (typeof variantData === 'object' && variantData !== null) {
        return variantData.quantity || 0;
      }
      return 0;
    };

    if (product.sizes && typeof product.sizes === "object" && selectedSize) {
      const sizeData = product.sizes[selectedSize];


      if (typeof sizeData === "object" && sizeData !== null && sizeData.variants && selectedVariant) {

        const variantData = sizeData.variants[selectedVariant];
        availableStock = getVariantQty(variantData);
      } else if (typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined) {

        availableStock = sizeData.quantity;
      } else if (typeof sizeData === "number") {

        availableStock = sizeData;
      }
    } else {
      availableStock = product.currentStock || 0;
    }


    const clampedQuantity = Math.max(1, Math.min(newQuantity, availableStock));

    setProductQuantities({
      ...productQuantities,
      [productId]: clampedQuantity
    });
  };

  const handleVariantSelection = (productId, variant) => {

    setProductVariants({ ...productVariants, [productId]: variant });


    setProductSizes({ ...productSizes, [productId]: "" });


    setProductQuantities({ ...productQuantities, [productId]: 1 });
  };

  const handleSizeSelection = (productId, size) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;


    setProductSizes({ ...productSizes, [productId]: size });


    const selectedVariant = productVariants[productId] || "";


    const getVariantQty = (variantData) => {
      if (typeof variantData === 'number') return variantData;
      if (typeof variantData === 'object' && variantData !== null) {
        return variantData.quantity || 0;
      }
      return 0;
    };


    let availableStock = 0;
    if (product.sizes && typeof product.sizes === "object" && size) {
      const sizeData = product.sizes[size];


      if (typeof sizeData === "object" && sizeData !== null && sizeData.variants && selectedVariant) {

        const variantData = sizeData.variants[selectedVariant];
        availableStock = getVariantQty(variantData);
      } else if (typeof sizeData === "object" && sizeData !== null && sizeData.quantity !== undefined) {

        availableStock = sizeData.quantity;
      } else if (typeof sizeData === "number") {

        availableStock = sizeData;
      }
    } else {
      availableStock = product.currentStock || 0;
    }


    const currentQuantity = productQuantities[productId] || 1;
    if (currentQuantity > availableStock && availableStock > 0) {
      setProductQuantities({
        ...productQuantities,
        [productId]: availableStock
      });
    } else if (availableStock === 0) {

      setProductQuantities({
        ...productQuantities,
        [productId]: 1
      });
    }
  };

  const addToCartFromExpanded = (product) => {
    const quantity = productQuantities[product._id] || 1;
    const size = productSizes[product._id] || "";
    const variant = productVariants[product._id] || "";


    const getVariantQty = (variantData) => {
      if (typeof variantData === 'number') return variantData;
      if (typeof variantData === 'object' && variantData !== null) {
        return variantData.quantity || 0;
      }
      return 0;
    };


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


    const hasSimpleVariants = () => {
      if (product.variant && typeof product.variant === 'string') {
        const variants = product.variant.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
        return variants.length > 1;
      }
      return false;
    };

    const productHasSizeVariants = hasVariantsPerSize();
    const productHasSimpleVariants = hasSimpleVariants();
    const productHasAnyVariants = productHasSizeVariants || productHasSimpleVariants;


    if (productHasAnyVariants && !variant) {
      alert("Please select a variant before adding to cart");
      return;
    }


    if (
      product.sizes &&
      typeof product.sizes === "object" &&
      Object.keys(product.sizes).length > 0) {
      if (!size) {
        alert("Please select a size before adding to cart");
        return;
      }
    }


    let availableStock = 0;
    let itemPrice = product.itemPrice || 0;

    if (product.sizes && typeof product.sizes === "object" && size) {
      const sizeData = product.sizes[size];
      if (typeof sizeData === "object" && sizeData !== null) {

        if (sizeData.variants && variant && !productHasSimpleVariants) {

          const variantData = sizeData.variants[variant];
          availableStock = getVariantQty(variantData);


          if (typeof variantData === 'object' && variantData !== null && variantData.price !== undefined) {
            itemPrice = variantData.price;
          } else if (sizeData.variantPrices && sizeData.variantPrices[variant] !== undefined) {

            itemPrice = sizeData.variantPrices[variant];
          } else if (sizeData.price !== undefined) {
            itemPrice = sizeData.price;
          }
        } else {

          availableStock = sizeData.quantity || 0;

          itemPrice =
            sizeData.price !== undefined ?
              sizeData.price :
              product.itemPrice || 0;
        }
      } else {
        availableStock = typeof sizeData === "number" ? sizeData : 0;
      }
    } else {
      availableStock = product.currentStock || 0;
    }


    if (availableStock <= 0) {
      alert("This item is out of stock");
      return;
    }


    const existingItem = productHasAnyVariants ?
      cart.find(
        (item) => item._id === product._id && item.selectedSize === size && item.selectedVariation === variant
      ) :
      cart.find(
        (item) => item._id === product._id && item.selectedSize === size
      );


    const totalQuantityAfterAdd = existingItem ?
      existingItem.quantity + quantity :
      quantity;


    if (totalQuantityAfterAdd > availableStock) {
      alert(
        `Only ${availableStock} item(s) available in stock. You already have ${existingItem?.quantity || 0} in cart.`
      );
      return;
    }

    const productToAdd = {
      ...product,
      productId: product._id,
      selectedSize: size,
      selectedVariation: variant,
      quantity: quantity,
      itemPrice: itemPrice
    };


    if (existingItem) {
      setPendingDuplicateItem({
        product: productToAdd,
        existingQuantity: existingItem.quantity
      });
      setShowDuplicateModal(true);
      return;
    }


    setCart([...cart, productToAdd]);
    setExpandedProductId(null);

    setShowProductModal(false);
    setSelectedProduct(null);
  };


  const handleConfirmDuplicateAdd = () => {
    if (!pendingDuplicateItem) return;

    const { product } = pendingDuplicateItem;

    setCart(
      cart.map((item) =>
        item._id === product._id &&
          item.selectedSize === product.selectedSize &&
          item.selectedVariation === product.selectedVariation ?
          { ...item, quantity: item.quantity + product.quantity } :
          item
      )
    );

    setShowDuplicateModal(false);
    setPendingDuplicateItem(null);
    setExpandedProductId(null);

    setShowProductModal(false);
    setSelectedProduct(null);
  };


  const handleCancelDuplicateAdd = () => {
    setShowDuplicateModal(false);
    setPendingDuplicateItem(null);
  };

  const addToCart = (product) => {
    const defaultSize =
      product.sizes && typeof product.sizes === "object" ?
        Object.keys(product.sizes)[0] || "" :
        product.size || "";


    let itemPrice = product.itemPrice || 0;
    if (product.sizes && typeof product.sizes === "object" && defaultSize) {
      const sizeData = product.sizes[defaultSize];
      if (
        typeof sizeData === "object" &&
        sizeData !== null &&
        sizeData.price !== undefined) {
        itemPrice = sizeData.price;
      }
    }

    const existingItem = cart.find(
      (item) =>
        item._id === product._id &&
        (item.selectedSize || "") === (defaultSize || "")
    );

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item._id === product._id &&
            (item.selectedSize || "") === (defaultSize || "") ?
            { ...item, quantity: item.quantity + 1 } :
            item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          productId: product._id,
          selectedSize: defaultSize,
          quantity: 1,
          itemPrice: itemPrice
        }]
      );
    }
  };

  const updateQuantity = (itemOrId, newQuantity) => {

    const item =
      typeof itemOrId === "object" ?
        itemOrId :
        cart.find((i) => i._id === itemOrId);
    const productId = typeof itemOrId === "object" ? itemOrId._id : itemOrId;
    const selectedSize = typeof itemOrId === "object" ? itemOrId.selectedSize || '' : '';
    const selectedVariation = typeof itemOrId === "object" ? itemOrId.selectedVariation || '' : '';

    if (newQuantity <= 0) {

      if (item) {
        handleRemoveItemClick(item);
      } else {
        removeFromCart(productId);
      }
    } else {
      setCart(
        cart.map((cartItem) =>
          cartItem._id === productId &&
            (cartItem.selectedSize || '') === selectedSize &&
            (cartItem.selectedVariation || '') === selectedVariation ?
            { ...cartItem, quantity: newQuantity } :
            cartItem
        )
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
          "Content-Type": "application/json"
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
              voidReason: voidReason || null
            }],

          paymentMethod: "void",
          amountReceived: 0,
          changeGiven: 0,
          referenceNo: `VOID-${Date.now()}`,
          totalAmount: (item.itemPrice || 0) * (item.quantity || 1),
          status: "Voided",
          voidReason: voidReason || null
        })
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
      itemToRemove
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



    const itemToVoid = JSON.parse(JSON.stringify(itemToRemove));

    try {
      let itemWasRemoved = false;
      let removedItemDetails = null;


      console.log("[confirmRemoveItem] Item to void details:", {
        _id: itemToVoid._id,
        productId: itemToVoid.productId,
        id: itemToVoid.id,
        selectedSize: itemToVoid.selectedSize,
        size: itemToVoid.size,
        sizes: itemToVoid.sizes,
        resolvedSize: resolveItemSize(itemToVoid),
        fullItem: itemToVoid
      });


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
              quantity: item.quantity
            }))
          );

          const initialLength = prevCart.length;
          const newCart = [];
          let foundMatch = false;


          for (const item of prevCart) {

            const itemId = String(
              item._id || item.productId || item.id || ""
            ).trim();
            const voidId = String(
              itemToVoid._id || itemToVoid.productId || itemToVoid.id || ""
            ).trim();
            const sameProduct =
              itemId !== "" && voidId !== "" && itemId === voidId;


            const itemSize = String(
              item.selectedSize || item.size || resolveItemSize(item) || ""
            ).
              toLowerCase().
              trim();
            const voidSize = String(
              itemToVoid.selectedSize ||
              itemToVoid.size ||
              resolveItemSize(itemToVoid) ||
              ""
            ).
              toLowerCase().
              trim();
            const sameSize =
              itemSize === voidSize || itemSize === "" && voidSize === "";


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
                  sameSize
                }
              );
              foundMatch = true;
              removedItemDetails = { ...item };

              continue;
            }


            newCart.push(item);
          }

          const finalLength = newCart.length;
          itemWasRemoved = foundMatch && initialLength > finalLength;


          const itemStillInCart = newCart.some((item) => {
            const itemId = String(
              item._id || item.productId || item.id || ""
            ).trim();
            const voidId = String(
              itemToVoid._id || itemToVoid.productId || itemToVoid.id || ""
            ).trim();
            const sameProduct =
              itemId !== "" && voidId !== "" && itemId === voidId;

            const itemSize = String(
              item.selectedSize || item.size || resolveItemSize(item) || ""
            ).
              toLowerCase().
              trim();
            const voidSize = String(
              itemToVoid.selectedSize ||
              itemToVoid.size ||
              resolveItemSize(itemToVoid) ||
              ""
            ).
              toLowerCase().
              trim();
            const sameSize =
              itemSize === voidSize || itemSize === "" && voidSize === "";

            return sameProduct && sameSize;
          });


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
              quantity: item.quantity
            }))
          });



          return newCart;
        });
      });



      await new Promise((resolve) => setTimeout(resolve, 10));


      const verifyCartUpdate = () => {
        return new Promise((resolve) => {

          setCart((currentCart) => {
            const itemStillExists = currentCart.some((item) => {
              const itemId = String(
                item._id || item.productId || item.id || ""
              ).trim();
              const voidId = String(
                itemToVoid._id || itemToVoid.productId || itemToVoid.id || ""
              ).trim();
              const sameProduct =
                itemId !== "" && voidId !== "" && itemId === voidId;

              const itemSize = String(
                item.selectedSize || item.size || resolveItemSize(item) || ""
              ).
                toLowerCase().
                trim();
              const voidSize = String(
                itemToVoid.selectedSize ||
                itemToVoid.size ||
                resolveItemSize(itemToVoid) ||
                ""
              ).
                toLowerCase().
                trim();
              const sameSize =
                itemSize === voidSize || itemSize === "" && voidSize === "";

              return sameProduct && sameSize;
            });

            resolve(!itemStillExists);
            return currentCart;
          });
        });
      };

      const verifiedRemoved = await verifyCartUpdate();

      if (!verifiedRemoved) {
        itemWasRemoved = false;
        console.error(
          "[confirmRemoveItem] ❌ Verification failed: Item still exists in cart after update!"
        );
      }


      if (!itemWasRemoved || !verifiedRemoved) {
        console.error(
          "[confirmRemoveItem] ❌ Item was NOT removed from cart! Aborting void transaction."
        );
        console.error("[confirmRemoveItem] Debug info:", {
          itemToVoid: {
            _id: itemToVoid._id,
            productId: itemToVoid.productId,
            id: itemToVoid.id,
            selectedSize: itemToVoid.selectedSize,
            size: itemToVoid.size,
            resolvedSize: resolveItemSize(itemToVoid)
          },
          currentCart: cart.map((item) => ({
            _id: item._id,
            productId: item.productId,
            id: item.id,
            selectedSize: item.selectedSize,
            size: item.size,
            resolvedSize: resolveItemSize(item)
          }))
        });
        alert(
          "Failed to remove item from cart. The item may have already been removed or the IDs do not match. Please check the console for details."
        );


        return;
      }


      if (itemWasRemoved !== true) {
        console.error(
          "[confirmRemoveItem] ❌ Safety check failed: itemWasRemoved is not true! Aborting."
        );
        return;
      }


      console.log(
        "[confirmRemoveItem] ✅ Item removed successfully, recording void transaction..."
      );
      recordVoidedItem(itemToVoid, voidReason).
        then(() => {
          console.log(
            "[confirmRemoveItem] Void transaction recorded successfully"
          );

          setShowRemoveItemModal(false);
          setItemToRemove(null);
          console.log("[confirmRemoveItem] Modal closed and item cleared");
        }).
        catch((error) => {
          console.error(
            "[confirmRemoveItem] Error recording void transaction:",
            error
          );


          setShowRemoveItemModal(false);
          setItemToRemove(null);
          alert(
            "Item removed from cart, but failed to record void transaction. Please check logs."
          );
        });
    } catch (error) {
      console.error("[confirmRemoveItem] Error:", error);
      alert("Failed to void item. Please try again.");

    }
  };

  const removeFromCart = (item) => {


    handleRemoveItemClick(item);
  };



  const removeFromCartDirect = (item) => {
    setCart((prevCart) => {
      const itemId = String(item._id || item.productId || item.id || "").trim();
      const itemSize = String(item.selectedSize || item.size || "").
        toLowerCase().
        trim();

      return prevCart.filter((cartItem) => {
        const cartItemId = String(
          cartItem._id || cartItem.productId || cartItem.id || ""
        ).trim();
        const cartItemSize = String(
          cartItem.selectedSize || cartItem.size || ""
        ).
          toLowerCase().
          trim();


        const sameProduct = cartItemId === itemId;
        const sameSize =
          cartItemSize === itemSize || cartItemSize === "" && itemSize === "";

        return !(sameProduct && sameSize);
      });
    });
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.itemPrice * item.quantity, 0);
  }, [cart]);


  const validateDiscountForCart = (discountItem, cartItems) => {
    if (!discountItem || !cartItems || cartItems.length === 0) {
      return { valid: false, message: "Cart is empty" };
    }


    const appliesToType = discountItem.appliesToType || discountItem.appliesTo;


    if (appliesToType === "all") {
      return { valid: true };
    }


    if (appliesToType === "category" && discountItem.category) {
      const hasMatchingItem = cartItems.some((item) => {

        let itemCategory = item.category;


        if (!itemCategory) {
          const productId = String(item._id || item.productId || item.id);
          const product = productMap.get(productId);
          itemCategory = product?.category;
        }


        return itemCategory === discountItem.category;
      });

      if (!hasMatchingItem) {
        return {
          valid: false,
          message: `This discount only applies to items in the "${discountItem.category}" category.`
        };
      }
      return { valid: true };
    }


    if (
      appliesToType === "products" &&
      discountItem.productIds &&
      discountItem.productIds.length > 0) {
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
            "This discount only applies to specific products. Your cart does not contain any eligible items."
        };
      }
      return { valid: true };
    }

    return { valid: false, message: "Discount configuration is invalid" };
  };


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


  const discount = useMemo(() => {
    if (selectedDiscounts.length === 0) {
      return parseFloat(discountAmount) || 0;
    }

    let totalDiscount = 0;

    for (const selectedDiscount of selectedDiscounts) {

      const validation = validateDiscountForCart(selectedDiscount, cart);
      if (!validation.valid) {
        continue;
      }


      const discountValueStr = selectedDiscount.discountValue || "";

      try {
        let totalEligibleAmount = 0;
        const appliesToType =
          selectedDiscount.appliesToType || selectedDiscount.appliesTo;


        if (appliesToType === "all") {
          totalEligibleAmount = subtotal;
        } else if (appliesToType === "category" && selectedDiscount.category) {
          totalEligibleAmount = cart.reduce((sum, item) => {

            let itemCategory = item.category;
            if (!itemCategory) {
              const productId = String(item._id || item.productId || item.id);
              const product = productMap.get(productId);
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
          selectedDiscount.productIds.length > 0) {
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


        if (
          typeof discountValueStr === "string" &&
          discountValueStr.includes("%")) {
          const percentage = parseFloat(
            discountValueStr.replace("% OFF", "").replace(/\s/g, "")
          );
          if (!isNaN(percentage)) {
            totalDiscount += totalEligibleAmount * percentage / 100;
          }
        } else if (
          typeof discountValueStr === "string" && (
            discountValueStr.includes("P") || discountValueStr.includes("₱"))) {
          const amount = parseFloat(discountValueStr.replace(/[P₱\sOFF]/g, ""));
          if (!isNaN(amount)) {


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
      currentPage * itemsPerPage
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
      size: item.selectedSize || item.size || resolveItemSize(item) || null,
      variant: item.selectedVariation || item.variant || null,
      quantity: item.quantity || 1
    }));

  const mapCartItemsForTransaction = () =>
    cart.map((item) => ({
      productId: item.productId || item._id,
      itemName: item.itemName,
      sku: item.sku,
      variant: item.selectedVariation || item.variant || "",
      selectedSize: resolveItemSize(item) || null,
      quantity: item.quantity || 1,
      price: item.itemPrice || 0,
      itemImage: item.itemImage || ""
    }));

  const applyStockOutOptimistically = useCallback((stockItems, { alsoUpdateSelectedProduct = true } = {}) => {
    if (!Array.isArray(stockItems) || stockItems.length === 0) return;

    setProducts((prev) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const next = prevList.map((p) => ({ ...p }));

      const findSizeKey = (sizesObj, size) => {
        if (!sizesObj || typeof sizesObj !== "object" || !size) return null;
        if (Object.prototype.hasOwnProperty.call(sizesObj, size)) return size;
        const target = String(size).trim().toLowerCase();
        return (
          Object.keys(sizesObj).find(
            (k) => String(k).trim().toLowerCase() === target
          ) || null
        );
      };

      const getSizeQty = (sizeData) => {
        if (typeof sizeData === "number") return sizeData;
        if (typeof sizeData === "object" && sizeData !== null) {
          return Number(sizeData.quantity || 0);
        }
        return 0;
      };
      const setSizeQty = (sizeData, qty) => {
        const clamped = Math.max(0, Number(qty || 0));
        if (typeof sizeData === "number") return clamped;
        if (typeof sizeData === "object" && sizeData !== null) {
          return { ...sizeData, quantity: clamped };
        }
        return clamped;
      };

      const getVariantQty = (variantData) => {
        if (typeof variantData === "number") return variantData;
        if (typeof variantData === "object" && variantData !== null) {
          return Number(variantData.quantity || 0);
        }
        return 0;
      };
      const setVariantQty = (variantData, qty) => {
        const clamped = Math.max(0, Number(qty || 0));
        if (typeof variantData === "number") return clamped;
        if (typeof variantData === "object" && variantData !== null) {
          return { ...variantData, quantity: clamped };
        }
        return clamped;
      };

      const recomputeCurrentStock = (product) => {
        if (product?.sizes && typeof product.sizes === "object") {
          return Object.values(product.sizes).reduce(
            (sum, sd) => sum + getSizeQty(sd),
            0
          );
        }
        return Math.max(0, Number(product?.currentStock || 0));
      };

      for (const si of stockItems) {
        const id = String(si?._id || "");
        if (!id) continue;
        const idx = next.findIndex(
          (p) => String(p?._id || p?.id || "") === id
        );
        if (idx === -1) continue;

        const product = next[idx];
        const qty = Math.max(0, Number(si.quantity || 0));
        if (!qty) continue;

        if (product?.sizes && typeof product.sizes === "object" && si.size) {
          const sizeKey = findSizeKey(product.sizes, si.size);
          if (sizeKey) {
            const sizeData = product.sizes[sizeKey];
            if (
              si.variant &&
              typeof sizeData === "object" &&
              sizeData !== null &&
              sizeData.variants &&
              typeof sizeData.variants === "object"
            ) {
              const currentVar = sizeData.variants[si.variant];
              const nextVar = setVariantQty(
                currentVar,
                getVariantQty(currentVar) - qty
              );
              const nextVariants = { ...sizeData.variants, [si.variant]: nextVar };
              const nextSizeTotal = Object.values(nextVariants).reduce(
                (sum, vd) => sum + getVariantQty(vd),
                0
              );
              product.sizes[sizeKey] = {
                ...sizeData,
                variants: nextVariants,
                quantity: nextSizeTotal
              };
            } else {
              product.sizes[sizeKey] = setSizeQty(
                sizeData,
                getSizeQty(sizeData) - qty
              );
            }
          }
          product.currentStock = recomputeCurrentStock(product);
        } else {
          product.currentStock = Math.max(
            0,
            Number(product.currentStock || 0) - qty
          );
        }
      }

      setCachedData("products", next);

      if (alsoUpdateSelectedProduct) {
        setSelectedProduct((prevSel) => {
          if (!prevSel) return prevSel;
          const key = String(prevSel._id || prevSel.id || "");
          const updated = next.find((p) => String(p?._id || p?.id || "") === key);
          return updated ? { ...prevSel, ...updated } : prevSel;
        });
      }

      return next;
    });
  }, [setCachedData]);

  const finalizeTransaction = async (meta = {}) => {
    if (!cart.length) return null;

    if (isProcessingTransaction) {
      console.warn("Transaction is already processing, ignoring duplicate call.");
      return null;
    }

    setIsProcessingTransaction(true);

    const cartSnapshot = [...cart];


    const stockItems = mapCartItemsForStockUpdate();
    const transactionItems = mapCartItemsForTransaction();
    const currentTotal = total;
    const currentDiscountIds = selectedDiscounts.map((d) => d._id);

    try {

      const transactionResponse = await fetch(
        `${API_BASE_URL}/api/transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId,
            items: transactionItems,
            paymentMethod: meta.paymentMethod || "cash",
            amountReceived: meta.amountReceived,
            changeGiven: meta.change,
            referenceNo: meta.referenceNo,
            receiptNo: meta.receiptNo,
            totalAmount: currentTotal,
            performedById: currentUser?._id || currentUser?.id,
            performedByName: currentUser?.name,
            status: "Completed",
            appliedDiscountIds: currentDiscountIds
          })
        }
      );


      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
          errorData.error ||
          `Transaction recording failed: ${transactionResponse.status} ${transactionResponse.statusText}`
        );
      }

      const transactionData = await transactionResponse.json();
      if (!transactionData.success) {
        throw new Error(
          transactionData.message ||
          transactionData.error ||
          "Failed to record transaction"
        );
      }

      // Instant UX: optimistically apply stock-out locally (no refresh needed).
      // The `/update-stock` response will reconcile right after.
      applyStockOutOptimistically(stockItems);


      setCart([]);
      setSelectedDiscounts([]);
      setDiscountAmount("");


      // NOTE: don't invalidate products here; we update them locally for instant UI
      invalidateCache("transactions");



      try {
        const stockRes = await fetch(`${API_BASE_URL}/api/products/update-stock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "Stock-Out",
            reason: "Sold",
            items: stockItems,
            performedByName:
              currentUser?.name ||
              `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim() ||
              "System",
            performedById: currentUser?._id || currentUser?.id || ""
          })
        });
        const stockData = await stockRes.json().catch(() => ({}));
        if (!stockRes.ok || !stockData.success) {
          console.error("Stock update failed:", stockData);
          throw new Error(stockData.message || "Stock update failed");
        }

        // Fast UI update: merge updated products into local state + cache
        if (Array.isArray(stockData.data) && stockData.data.length > 0) {
          const updatedMap = new Map(
            stockData.data
              .filter((p) => p && (p._id || p.id))
              .map((p) => [String(p._id || p.id), p])
          );

          setProducts((prev) => {
            const prevList = Array.isArray(prev) ? prev : [];
            const next = prevList.map((p) => {
              const key = String(p?._id || p?.id || "");
              const updated = updatedMap.get(key);
              return updated ? { ...p, ...updated } : p;
            });
            setCachedData("products", next);
            return next;
          });

          setSelectedProduct((prev) => {
            if (!prev) return prev;
            const key = String(prev._id || prev.id || "");
            const updated = updatedMap.get(key);
            return updated ? { ...prev, ...updated } : prev;
          });
        }
      } catch (stockErr) {
        console.error("Stock update error:", stockErr);
        alert(
          `Transaction saved, but stock update failed: ${stockErr.message || "Unknown error"}`
        );
      } finally {
        // Background refresh to stay consistent, but UI should already update fast
        fetchProducts(true).catch(() => {});
      }


      return transactionData.data;
    } catch (error) {
      console.error("Error finalizing transaction:", error);

      setCart(cartSnapshot);
      const errorMessage = error.message || "Unknown error occurred";
      alert(
        `Transaction failed: ${errorMessage}\n\nYour cart has been restored. Please try again.`
      );
      throw error;
    } finally {
      setIsProcessingTransaction(false);
    }
  };

  const handleCashProceed = async (amountReceived, change, receiptNo) => {
    console.log("handleCashProceed received receiptNo:", receiptNo);
    setShowCashPaymentModal(false);
    return await finalizeTransaction({
      paymentMethod: "cash",
      amountReceived,
      change,
      receiptNo
    });
  };

  const handleQRPayment = () => {
    setShowQRPaymentModal(true);
  };






  const handleGCashTransactionComplete = (paymentData) => {
    console.log("[GCash] Transaction complete:", paymentData);

    // QR flow previously relied on delayed refetch; apply the same instant stock-out UX as cash.
    const stockItems = mapCartItemsForStockUpdate();
    applyStockOutOptimistically(stockItems);

    setCart([]);
    setSelectedDiscounts([]);
    setDiscountAmount("");


    invalidateCache("transactions");


    // Background refresh to stay consistent (UI already updated immediately).
    fetchProducts(true).catch((err) =>
      console.warn("Background product refresh failed:", err)
    );


    setShowQRPaymentModal(false);
  };


  const handleOpenDiscountModal = useCallback(() => {
    setShowDiscountModal(true);
  }, []);

  const handleSelectDiscount = useCallback((discountItem) => {
    try {

      if (!discountItem) {
        console.error("No discount item provided");
        alert("Invalid discount selected. Please try again.");
        return;
      }


      const alreadySelected = selectedDiscounts.some(
        (d) => d._id === discountItem._id
      );
      if (alreadySelected) {
        alert("This discount is already applied.");
        return;
      }


      const validation = validateDiscountForCart(discountItem, cart);

      if (!validation.valid) {
        alert(validation.message);
        return;
      }


      setSelectedDiscounts((prev) => [...prev, discountItem]);


      setDiscountAmount("");
    } catch (error) {
      console.error("Error selecting discount:", error);
      alert("An error occurred while applying the discount. Please try again.");
    }
  }, [selectedDiscounts, cart, validateDiscountForCart]);

  const handleRemoveDiscount = useCallback((discountId) => {
    if (discountId) {

      setSelectedDiscounts((prev) => prev.filter((d) => d._id !== discountId));
    } else {

      setSelectedDiscounts([]);
    }
    setDiscountAmount("");
  }, []);

  return (
    <>
      <div
        className={`relative flex flex-col h-screen ${theme === "dark" ? "bg-[#121212]" : "bg-[#F5F5F5]"}`}>

        <div
          className={`absolute top-0 left-0 right-[420px] px-6 py-4 z-40 transition-colors duration-300 flex flex-col gap-4 ${theme === "dark" ? "bg-[#121212]" : "bg-[#F5F5F5]"}`}
          style={{ paddingRight: "24px" }}>

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
            onSortChange={setSortOption} />


          { }
          <div className="grid grid-cols-7 gap-3 pb-2 w-full">
            {categories.map((cat) =>
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`flex items-center justify-center px-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border truncate ${selectedCategory === cat.name ?
                  "bg-[#AD7F65] text-white border-[#AD7F65] shadow-md" :
                  theme === "dark" ?
                    "bg-[#2A2724] text-gray-300 border-gray-600 hover:bg-[#352F2A]" :
                    "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"}`
                }
                title={cat.name}>

                <span className="truncate w-full text-center">{cat.name}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div
            className="flex-1 overflow-auto p-6"
            style={{
              paddingTop: `${130 + Math.ceil(categories.length / 7) * 50}px`
            }}>

            <div>
              <h2
                className={`text-lg font-semibold mb-3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                Products
              </h2>
              {loading ?
                <div
                  className={`text-center py-10 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>

                  Loading...
                </div> :
                filteredProducts.length === 0 ?
                  <div
                    className={`text-center py-10 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                    No products found
                  </div> :

                  <div className="grid grid-cols-5 gap-4 items-start">
                    {paginatedProducts.map((product) =>
                      <ProductCard
                        key={product._id}
                        product={product}
                        onToggleExpand={handleProductClick} />

                    )}
                  </div>
              }
            </div>
            {filteredProducts.length >= itemsPerPage &&
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredProducts.length / itemsPerPage)}
                onPageChange={setCurrentPage} />

            }
          </div>

          <div
            className={`w-[420px] border-l-0 p-4 relative ${theme === "dark" ? "bg-[#121212]" : "bg-gray-50"}`}>

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
              subtotal={subtotal}
              discount={discount}
              total={total}
              handleCheckout={handleCheckout}
              onCashPayment={handleCashPayment}
              onQRPayment={handleQRPayment}
              onOpenDiscountModal={handleOpenDiscountModal}
              onSelectDiscount={handleSelectDiscount} />

          </div>
        </div>
      </div>

      <CheckoutConfirmationModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onConfirm={confirmCheckout} />


      <CashPaymentModal
        isOpen={showCashPaymentModal}
        onClose={() => setShowCashPaymentModal(false)}
        totalAmount={total}
        subtotalAmount={subtotal}
        discountAmount={discount}
        selectedDiscounts={selectedDiscounts}
        onProceed={handleCashProceed}
        cartItems={cart}
        cashierName={currentUser?.name} />


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
        onTransactionComplete={handleGCashTransactionComplete} />


      <DiscountModal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        onSelectDiscount={handleSelectDiscount}
        cart={cart}
        products={products}
        selectedDiscounts={selectedDiscounts} />


      <RemoveItemPinModal
        isOpen={showRemoveItemModal}
        onClose={() => {
          setShowRemoveItemModal(false);
          setItemToRemove(null);
        }}
        onConfirm={confirmRemoveItem}
        item={itemToRemove} />


      <DuplicateItemModal
        isOpen={showDuplicateModal}
        onClose={handleCancelDuplicateAdd}
        onConfirm={handleConfirmDuplicateAdd}
        item={pendingDuplicateItem?.product}
        existingQuantity={pendingDuplicateItem?.existingQuantity || 0} />


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
        } />

      {isProcessingTransaction && (
        <div className="fixed inset-0 z-[10000] flex flex-col justify-center items-center bg-black/60 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-[#AD7F65]/30 border-t-[#AD7F65] rounded-full animate-spin shadow-lg"></div>
          <p className="mt-4 text-white text-lg font-bold tracking-wide shadow-black drop-shadow-md">
            Processing Transaction...
          </p>
          <p className="mt-1 text-gray-300 text-sm">Please wait</p>
        </div>
      )}
    </>);

};

export default memo(Terminal);