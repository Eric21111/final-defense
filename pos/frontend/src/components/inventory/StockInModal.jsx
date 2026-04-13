import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

// Matches Add Product / Inventory when product has only option group 1 (no sizes)
const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

const buildPickerCombos = (v1Tags, v2Tags, existingSet, addedSet) => {
  const out = [];
  if (v1Tags.length > 0 && v2Tags.length > 0) {
    v1Tags.forEach((v1) => {
      v2Tags.forEach((v2) => {
        const key = `${v2}|${v1}`;
        if (!existingSet.has(key) && !addedSet.has(key)) out.push({ size: v2, variant: v1 });
      });
    });
  } else if (v1Tags.length > 0) {
    v1Tags.forEach((v1) => {
      const key = `${VARIANT_ONLY_SIZE_KEY}|${v1}`;
      if (!existingSet.has(key) && !addedSet.has(key)) out.push({ size: VARIANT_ONLY_SIZE_KEY, variant: v1 });
    });
  }
  return out;
};

const StockInModal = ({ isOpen, onClose, product, onConfirm, loading, brandPartners = [] }) => {
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [variantQuantities, setVariantQuantities] = useState({});
  const [quantity, setQuantity] = useState("");
  const [batchCode, setBatchCode] = useState("");
  const [batchExpirationDate, setBatchExpirationDate] = useState("");
  const [reason, setReason] = useState("Restock");
  const [otherReason, setOtherReason] = useState("");
  const [newVariantInputs, setNewVariantInputs] = useState({});
  const [addedVariants, setAddedVariants] = useState([]);
  const [newVariantPrices, setNewVariantPrices] = useState({});
  const [showNewSizes, setShowNewSizes] = useState(false);
  const [customNewSizeInput, setCustomNewSizeInput] = useState("");
  const [addedNewSizes, setAddedNewSizes] = useState([]);
  const [newSizePrices, setNewSizePrices] = useState({});
  const [diffPricesPerVariant, setDiffPricesPerVariant] = useState({});
  const [stockVariantPrices, setStockVariantPrices] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [checkedCombos, setCheckedCombos] = useState({});
  const [showAddNewSection, setShowAddNewSection] = useState(false);
  const [newV1Tags, setNewV1Tags] = useState([]);
  const [newV2Tags, setNewV2Tags] = useState([]);
  const [newV1Input, setNewV1Input] = useState("");
  const [newV2Input, setNewV2Input] = useState("");
  const [addedNewCombos, setAddedNewCombos] = useState([]);
  const [newComboData, setNewComboData] = useState({});
  const [fillAllCostSI, setFillAllCostSI] = useState("");
  const [fillAllSellSI, setFillAllSellSI] = useState("");
  const [fillAllQtySI, setFillAllQtySI] = useState("");
  const [stockInBrandPartner, setStockInBrandPartner] = useState("");
  const [dateReceived, setDateReceived] = useState("");
  /** "new" = create a new lot; otherwise FIFO slot index string ("0", "1", …) */
  const [stockInBatchChoice, setStockInBatchChoice] = useState("new");
  const { theme } = useTheme();
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const brandPartnerNames = useMemo(
    () => [...new Set(brandPartners.map((bp) => bp.brandName).filter(Boolean))].sort(),
    [brandPartners],
  );

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
  const shouldShowVariantBuilder =
    (hasSizes && hasVariants) || (!hasSizes && (product?.currentStock || 0) === 0);

  const stockInBatchList = useMemo(() => {
    if (!hasSizes || !product) return [];

    const getVariantQty = (vData) => {
      if (typeof vData === "number") return parseInt(vData, 10) || 0;
      if (vData && typeof vData === "object") {
        const q = vData.qty ?? vData.quantity ?? 0;
        return parseInt(q, 10) || 0;
      }
      return 0;
    };

    if (hasVariants) {
      const maxBatchDepth = (() => {
        let max = 0;
        Object.values(product.sizes).forEach((sd) => {
          if (!sd || typeof sd !== "object" || !sd?.variants) return;
          Object.values(sd.variants).forEach((vData) => {
            const batches = typeof vData === "object" && Array.isArray(vData.batches) ? vData.batches : [];
            max = Math.max(max, batches.length);
          });
        });
        return max;
      })();

      if (maxBatchDepth <= 0) {
        const openingBatchCode = product?.batchNumber || product?.openingBatchNumber || "B1";
        let totalQty = 0;
        Object.entries(product.sizes).forEach(([_, sd]) => {
          if (!sd || typeof sd !== "object" || !sd?.variants) return;
          Object.entries(sd.variants).forEach(([__, vData]) => {
            totalQty += getVariantQty(vData);
          });
        });
        if (totalQty <= 0) return [];
        return [{ slotIndex: 0, code: openingBatchCode, totalQty }];
      }

      const slots = Array.from({ length: maxBatchDepth }, (_, slotIndex) => ({
        slotIndex,
        code: "",
        totalQty: 0,
      }));

      Object.entries(product.sizes).forEach(([_, sd]) => {
        if (!sd || typeof sd !== "object" || !sd?.variants) return;
        Object.entries(sd.variants).forEach(([__, vData]) => {
          const batches = typeof vData === "object" && Array.isArray(vData.batches) ? vData.batches : [];
          const fallbackQty = (idx) => (idx === 0 ? getVariantQty(vData) : 0);
          for (let slotIndex = 0; slotIndex < maxBatchDepth; slotIndex++) {
            const b = batches[slotIndex];
            const qty = b ? (parseInt(b.qty, 10) || 0) : fallbackQty(slotIndex);
            if (qty <= 0) continue;
            const slot = slots[slotIndex];
            slot.totalQty += qty;
            if (!slot.code) {
              slot.code =
                b?.batchCode ||
                (slotIndex === 0 ? (product?.batchNumber || product?.openingBatchNumber || "") : "");
            }
          }
        });
      });

      return slots.filter((s) => s.totalQty > 0);
    }

    const maxBatchDepth = Math.max(
      0,
      ...Object.values(product.sizes).map((sd) => {
        if (!sd || typeof sd !== "object") return 0;
        return Array.isArray(sd.batches) ? sd.batches.length : 0;
      }),
    );

    if (maxBatchDepth <= 0) {
      const openingBatchCode = product?.batchNumber || product?.openingBatchNumber || "B1";
      let totalQty = 0;
      Object.values(product.sizes).forEach((sd) => {
        if (typeof sd === "object" && sd !== null) totalQty += getSizeQuantity(sd);
      });
      if (totalQty <= 0) return [];
      return [{ slotIndex: 0, code: openingBatchCode, totalQty }];
    }

    const slots = Array.from({ length: maxBatchDepth }, (_, slotIndex) => ({
      slotIndex,
      code: "",
      totalQty: 0,
    }));

    Object.values(product.sizes).forEach((sd) => {
      if (!sd || typeof sd !== "object") return;
      const batches = Array.isArray(sd.batches) ? sd.batches : [];
      for (let slotIndex = 0; slotIndex < maxBatchDepth; slotIndex++) {
        const b = batches[slotIndex];
        const qty = b
          ? parseInt(b.qty, 10) || 0
          : slotIndex === 0
            ? getSizeQuantity(sd)
            : 0;
        if (qty <= 0) continue;
        const slot = slots[slotIndex];
        slot.totalQty += qty;
        if (!slot.code) {
          slot.code =
            b?.batchCode ||
            (slotIndex === 0 ? (product?.batchNumber || product?.openingBatchNumber || "") : "");
        }
      }
    });

    return slots.filter((s) => s.totalQty > 0);
  }, [product, hasSizes, hasVariants]);

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

  const existingCombos = (() => {
    const combos = [];
    if (hasSizes) {
      existingSizes.forEach(size => {
        const sizeVariants = getSizeVariants(size);
        if (sizeVariants) {
          Object.keys(sizeVariants).forEach(variant => {
            const vData = sizeVariants[variant];
            const stock = typeof vData === 'object' ? (vData.quantity || 0) : (typeof vData === 'number' ? vData : 0);
            combos.push({ size, variant, stock });
          });
        }
      });
    }
    return combos;
  })();

  const getExistingPrice = (size, variant) => {
    const sizeData = hasSizes && product.sizes[size];
    if (!sizeData || typeof sizeData !== 'object') return { cost: product.costPrice || 0, sell: product.itemPrice || 0 };
    const vts = sizeData.variants;
    if (!vts || !vts[variant]) return { cost: sizeData.costPrice || product.costPrice || 0, sell: sizeData.price || product.itemPrice || 0 };
    const vData = vts[variant];
    if (typeof vData === 'object' && vData !== null) {
      return {
        cost: vData.costPrice || sizeData.variantCostPrices?.[variant] || sizeData.costPrice || product.costPrice || 0,
        sell: vData.price || sizeData.variantPrices?.[variant] || sizeData.price || product.itemPrice || 0
      };
    }
    return { cost: sizeData.costPrice || product.costPrice || 0, sell: sizeData.price || product.itemPrice || 0 };
  };

  useEffect(() => {
    if (isOpen && product) {
      setSizeQuantities({});
      setVariantQuantities({});
      setQuantity("");
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const h = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      setBatchCode(`B${y}${m}${d}-${h}${min}`);
      setBatchExpirationDate("");
      setReason("Restock");
      setOtherReason("");
      setNewVariantInputs({});
      setAddedVariants([]);
      setNewVariantPrices({});
      setShowNewSizes(false);
      setCustomNewSizeInput("");
      setAddedNewSizes([]);
      setNewSizePrices({});
      setCurrentStep(1);
      setShowAddNewSection(false);
      setNewV1Tags([]); setNewV2Tags([]);
      setNewV1Input(""); setNewV2Input("");
      setAddedNewCombos([]);
      setNewComboData({});
      setFillAllCostSI(""); setFillAllSellSI(""); setFillAllQtySI("");
      const preferredBrand = String(product?.brandName || "").trim();
      const explicitDefaultBrand =
        brandPartnerNames.find((name) => String(name).trim().toLowerCase() === "default") || "";
      const defaultBrand =
        explicitDefaultBrand ||
        (preferredBrand &&
          brandPartnerNames.find((name) => String(name).trim().toLowerCase() === preferredBrand.toLowerCase())) ||
        brandPartnerNames[0] ||
        "";
      setStockInBrandPartner(defaultBrand);
      setDateReceived(new Date().toISOString().split('T')[0]);
      setStockInBatchChoice("new");

      const initChecked = {};
      const initPrices = {};
      const initDiff = {};
      if (product.sizes && typeof product.sizes === 'object') {
        const sizes = Object.keys(product.sizes);
        setSelectedSizes(sizes);
        sizes.forEach(size => {
          const sd = product.sizes[size];
          if (typeof sd === 'object' && sd?.variants) {
            initDiff[size] = true;
            initPrices[size] = {};
            Object.entries(sd.variants).forEach(([variant, vData]) => {
              initChecked[`${size}|${variant}`] = true;
              const cost = typeof vData === 'object' ? (vData.costPrice || sd.variantCostPrices?.[variant] || sd.costPrice || product.costPrice || 0) : (sd.variantCostPrices?.[variant] || sd.costPrice || product.costPrice || 0);
              const sell = typeof vData === 'object' ? (vData.price || sd.variantPrices?.[variant] || sd.price || product.itemPrice || 0) : (sd.variantPrices?.[variant] || sd.price || product.itemPrice || 0);
              initPrices[size][variant] = { price: sell, costPrice: cost };
            });
          }
        });
      } else {
        setSelectedSizes([]);
      }
      setCheckedCombos(initChecked);
      setStockVariantPrices(initPrices);
      setDiffPricesPerVariant(initDiff);
    }
  }, [isOpen, product?._id, product?.brandName, brandPartnerNames]);

  useEffect(() => {
    if (!isOpen || stockInBrandPartner) return;
    if (brandPartnerNames.length === 0) return;
    setStockInBrandPartner(brandPartnerNames[0]);
  }, [isOpen, stockInBrandPartner, brandPartnerNames]);

  if (!isOpen || !product) return null;

  const handleClose = () => {
    setSelectedSizes([]);
    setSizeQuantities({});
    setVariantQuantities({});
    setQuantity("");
    setBatchCode("");
    setBatchExpirationDate("");
    setStockInBrandPartner("");
    setDateReceived("");
    setStockInBatchChoice("new");
    setReason("Restock");
    setOtherReason("");
    setNewVariantInputs({});
    setAddedVariants([]);
    setNewVariantPrices({});
    setShowNewSizes(false);
    setCustomNewSizeInput("");
    setAddedNewSizes([]);
    setNewSizePrices({});
    setDiffPricesPerVariant({});
    setStockVariantPrices({});
    setCurrentStep(1);
    setCheckedCombos({});
    setShowAddNewSection(false);
    setNewV1Tags([]); setNewV2Tags([]);
    setNewV1Input(""); setNewV2Input("");
    setAddedNewCombos([]);
    setNewComboData({});
    setFillAllCostSI(""); setFillAllSellSI(""); setFillAllQtySI("");
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
        ...(prev[size] || { price: product.itemPrice || 0, costPrice: product.costPrice || 0 }),
        [field]: value
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
      [size]: qty
    }));
  };

  const handleVariantQuantityChange = (size, variant, qty) => {
    setVariantQuantities((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: qty
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
        ...(prev[variantName] || { price: product.itemPrice || 0, costPrice: product.costPrice || 0 }),
        [field]: value
      }
    }));
  };

  const handleDiffPricesToggle = (size) => {
    const willEnable = !diffPricesPerVariant[size];
    setDiffPricesPerVariant(prev => ({
      ...prev,
      [size]: willEnable
    }));

    // When enabling, pre-populate stockVariantPrices from existing DB data
    // so the displayed defaults are captured in state and sent to the backend
    if (willEnable) {
      const sizeVariants = getSizeVariants(size);
      const sizeData = hasSizes && product.sizes[size] && typeof product.sizes[size] === 'object' ? product.sizes[size] : {};
      const initialPrices = {};

      allVariants.forEach(variant => {
        // Try to get the existing variant-level price from DB
        let variantPrice = product.itemPrice || 0;
        let variantCost = product.costPrice || 0;

        if (sizeVariants && sizeVariants[variant]) {
          const vData = sizeVariants[variant];
          if (typeof vData === 'object' && vData !== null) {
            variantPrice = vData.price || sizeData.variantPrices?.[variant] || sizeData.price || variantPrice;
            variantCost = vData.costPrice || sizeData.variantCostPrices?.[variant] || sizeData.costPrice || variantCost;
          } else {
            variantPrice = sizeData.variantPrices?.[variant] || sizeData.price || variantPrice;
            variantCost = sizeData.variantCostPrices?.[variant] || sizeData.costPrice || variantCost;
          }
        }

        initialPrices[variant] = {
          price: variantPrice,
          costPrice: variantCost
        };
      });

      setStockVariantPrices(prev => ({
        ...prev,
        [size]: {
          ...(prev[size] || {}),
          ...initialPrices
        }
      }));
    }
  };

  const handleStockVariantPriceChange = (size, variant, field, value) => {
    setStockVariantPrices(prev => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: {
          ...(prev[size]?.[variant] || { price: product.itemPrice || 0, costPrice: product.costPrice || 0 }),
          [field]: value
        }
      }
    }));
  };

  const handleComboCheck = (size, variant) => {
    const key = `${size}|${variant}`;
    const wasChecked = checkedCombos[key] !== false;
    setCheckedCombos(prev => ({ ...prev, [key]: !wasChecked }));
    if (wasChecked) {
      setVariantQuantities(prev => {
        const updated = { ...prev };
        if (updated[size]) { delete updated[size][variant]; }
        return updated;
      });
    }
  };

  const handleAddNewCombosFromPicker = () => {
    const existingSet = new Set(existingCombos.map(c => `${c.size}|${c.variant}`));
    const addedSet = new Set(addedNewCombos.map(c => `${c.size}|${c.variant}`));
    const previewCombos = buildPickerCombos(newV1Tags, newV2Tags, existingSet, addedSet);
    if (previewCombos.length === 0) return;

    setAddedNewCombos(prev => [...prev, ...previewCombos]);
    const newVars = newV1Tags.filter(v => !allVariants.includes(v));
    const newSzs = newV2Tags.filter(s => !existingSizes.includes(s) && !addedNewSizes.includes(s));
    if (newVars.length > 0) setAddedVariants(prev => [...new Set([...prev, ...newVars])]);
    if (newSzs.length > 0) {
      setAddedNewSizes(prev => [...new Set([...prev, ...newSzs])]);
      setSelectedSizes(prev => [...new Set([...prev, ...newSzs])]);
    }
    newV2Tags.filter(s => existingSizes.includes(s) && !selectedSizes.includes(s)).forEach(s => {
      setSelectedSizes(prev => prev.includes(s) ? prev : [...prev, s]);
    });
    if (previewCombos.some((c) => c.size === VARIANT_ONLY_SIZE_KEY)) {
      setSelectedSizes((prev) => (prev.includes(VARIANT_ONLY_SIZE_KEY) ? prev : [...prev, VARIANT_ONLY_SIZE_KEY]));
    }

    const checkedUpdates = {};
    const priceUpdates = {};
    const qtyUpdates = {};
    previewCombos.forEach(({ size, variant }) => {
      const key = `${size}|${variant}`;
      const data = newComboData[key] || {};
      checkedUpdates[key] = true;
      if (!priceUpdates[size]) priceUpdates[size] = {};
      priceUpdates[size][variant] = { price: data.sell || product.itemPrice || 0, costPrice: data.cost || product.costPrice || 0 };
      if (data.qty) { if (!qtyUpdates[size]) qtyUpdates[size] = {}; qtyUpdates[size][variant] = data.qty; }
    });
    setCheckedCombos(prev => ({ ...prev, ...checkedUpdates }));
    setStockVariantPrices(prev => {
      const u = { ...prev };
      Object.entries(priceUpdates).forEach(([s, vs]) => { u[s] = { ...(u[s] || {}), ...vs }; });
      return u;
    });
    if (Object.keys(qtyUpdates).length > 0) {
      setVariantQuantities(prev => {
        const u = { ...prev };
        Object.entries(qtyUpdates).forEach(([s, vs]) => { u[s] = { ...(u[s] || {}), ...vs }; });
        return u;
      });
    }
    setNewV1Tags([]); setNewV2Tags([]); setNewComboData({}); setShowAddNewSection(false);
  };

  const handleFillAllSI = () => {
    const allCombosList = [...existingCombos.map(c => ({ size: c.size, variant: c.variant })), ...addedNewCombos];
    const qFill = String(fillAllQtySI ?? "").trim();
    const cFill = String(fillAllCostSI ?? "").trim();
    const sFill = String(fillAllSellSI ?? "").trim();

    if (cFill !== "" || sFill !== "") {
      setStockVariantPrices(prev => {
        const u = { ...prev };
        allCombosList.forEach(({ size, variant }) => {
          if (checkedCombos[`${size}|${variant}`] !== false) {
            if (!u[size]) u[size] = {};
            u[size][variant] = {
              ...(u[size]?.[variant] || {}),
              ...(cFill !== "" ? { costPrice: cFill } : {}),
              ...(sFill !== "" ? { price: sFill } : {}),
            };
          }
        });
        return u;
      });
    }
    if (qFill !== "") {
      setVariantQuantities(prev => {
        const u = { ...prev };
        allCombosList.forEach(({ size, variant }) => {
          if (checkedCombos[`${size}|${variant}`] !== false) {
            if (!u[size]) u[size] = {};
            u[size][variant] = qFill;
          }
        });
        return u;
      });
    }
  };

  const isStepValid = (step) => {
    if (step === 1) {
      if (!hasSizes) return (parseInt(quantity) || 0) > 0;
      if (hasVariants) {
        const allCombosList = [...existingCombos.map(c => ({ size: c.size, variant: c.variant })), ...addedNewCombos];
        return allCombosList.some(({ size, variant }) => {
          return checkedCombos[`${size}|${variant}`] !== false && (parseInt(variantQuantities[size]?.[variant]) || 0) > 0;
        });
      }
      return selectedSizes.some(s => (parseInt(sizeQuantities[s]) || 0) > 0);
    }

    if (step === 2) {
      if (!stockInBrandPartner) return false;
      if (!dateReceived) return false;
      if (reason === "Other" && !otherReason.trim()) return false;
      return true;
    }

    return true;
  };

  const handleSubmit = () => {
    if (currentStep !== 3) return;

    if (reason === "Other" && !otherReason.trim()) {
      alert("Please specify the reason");
      return;
    }

    const finalReason =
      reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    const stockInBatchPayload =
      !hasSizes
        ? {
            ...(batchCode.trim() ? { batchCode: batchCode.trim() } : {}),
            ...(batchExpirationDate ? { expirationDate: batchExpirationDate } : {}),
          }
        : stockInBatchChoice !== "new"
          ? {
              targetBatchSlotIndex: parseInt(stockInBatchChoice, 10),
              ...(batchExpirationDate ? { expirationDate: batchExpirationDate } : {}),
            }
          : {
              ...(batchCode.trim() ? { batchCode: batchCode.trim() } : {}),
              ...(batchExpirationDate ? { expirationDate: batchExpirationDate } : {}),
            };

    if (!hasSizes) {

      const qty = parseInt(quantity) || 0;
      if (qty <= 0) {
        alert("Please enter a valid quantity");
        return;
      }
      onConfirm({
        quantity: qty,
        noSizes: true,
        reason: finalReason,
        ...stockInBatchPayload,
        ...(stockInBrandPartner ? { brandPartner: stockInBrandPartner } : {}),
        ...(dateReceived ? { dateReceived } : {}),
      });
      return;
    }


    if (selectedSizes.length === 0) {
      alert("Please select at least one size");
      return;
    }


    if (hasVariants) {
      // Filter by checked combos
      const filteredVarQtys = {};
      const checkedSizesSet = new Set();
      [...existingCombos.map(c => ({ size: c.size, variant: c.variant })), ...addedNewCombos].forEach(({ size, variant }) => {
        const key = `${size}|${variant}`;
        const qty = parseInt(variantQuantities[size]?.[variant]) || 0;
        if (checkedCombos[key] !== false && qty > 0) {
          if (!filteredVarQtys[size]) filteredVarQtys[size] = {};
          filteredVarQtys[size][variant] = variantQuantities[size][variant];
          checkedSizesSet.add(size);
        }
      });

      if (Object.keys(filteredVarQtys).length === 0) {
        alert("Please enter quantities for at least one checked variant");
        return;
      }

      const filteredSizes = Array.from(checkedSizesSet);
      onConfirm({
        sizes: sizeQuantities,
        variantQuantities: filteredVarQtys,
        selectedSizes: filteredSizes,
        reason: finalReason,
        hasVariants: true,
        newVariantPrices: addedVariants.length > 0 ? newVariantPrices : null,
        newSizePrices: addedNewSizes.length > 0 ? newSizePrices : null,
        diffPricesPerVariant: Object.keys(diffPricesPerVariant).some(k => diffPricesPerVariant[k]) ? diffPricesPerVariant : null,
        stockVariantPrices: Object.keys(stockVariantPrices).length > 0 ? stockVariantPrices : null,
        ...stockInBatchPayload,
        ...(stockInBrandPartner ? { brandPartner: stockInBrandPartner } : {}),
        ...(dateReceived ? { dateReceived } : {}),
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
      newSizePrices: addedNewSizes.length > 0 ? newSizePrices : null,
      ...stockInBatchPayload,
      ...(stockInBrandPartner ? { brandPartner: stockInBrandPartner } : {}),
      ...(dateReceived ? { dateReceived } : {}),
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-9999 p-4 backdrop-blur-sm pointer-events-none">
      <div
        className={`rounded-2xl w-full max-w-3xl relative pointer-events-auto overflow-hidden ${theme === "dark" ? "bg-[#1E1B18]" : "bg-white"}`}
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

              {product?.itemName || "Stock In"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className={`text-2xl font-light ${theme === "dark" ? "text-gray-400 hover:text-gray-200" : "text-gray-400 hover:text-gray-600"}`}>

            ×
          </button>
        </div>

        <div>
          <div className="flex" style={{ maxHeight: "calc(100vh - 150px)" }}>
            <div className="w-full p-6 flex flex-col justify-between overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
              <div className="space-y-6">
                {/* Stepper */}
                <div className="mb-2">
                  <div className="flex items-center justify-center gap-0">
                    {[{ id: 1, label: "Add Items" }, { id: 2, label: "Details" }, { id: 3, label: "Review" }].map((s, idx) => (
                      <div key={s.id} className="flex items-center">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                            currentStep === s.id ? "bg-[#09A046] border-[#09A046] text-white"
                              : currentStep > s.id ? "bg-[#09A046] border-[#09A046] text-white"
                                : theme === "dark" ? "border-gray-600 text-gray-400" : "border-gray-300 text-gray-400"
                          }`}>
                            {currentStep > s.id ? "✓" : s.id}
                        </div>
                          <span className={`text-[10px] mt-1 ${currentStep >= s.id ? "text-[#09A046] font-semibold" : "text-gray-400"}`}>{s.label}</span>
                        </div>
                        {idx < 2 && (
                          <div className={`w-14 h-[2px] mx-2 mb-4 ${currentStep > s.id ? "bg-[#09A046]" : theme === "dark" ? "bg-gray-700" : "bg-gray-200"}`} style={{ borderStyle: "dashed" }} />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 1: Add Items */}
                {currentStep === 1 && (
                <div className="space-y-3">
                <div>
                    <h4 className={`text-sm font-bold uppercase tracking-wide ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Items to Stock In</h4>
                    <p className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>check variants that arrived, unchecked = skip</p>
                  </div>

                  {shouldShowVariantBuilder ? (<>
                    <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                      {existingCombos.length > 0 ? "Existing variants" : "No existing variants yet"}
                    </p>

                    {/* Combo table */}
                    <div className={`rounded-xl border overflow-hidden ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                      <div className={`grid grid-cols-[28px_1fr_1fr_48px_68px_88px_88px] gap-1 items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${theme === "dark" ? "bg-[#2A2724] text-gray-400 border-b border-gray-700" : "bg-gray-50 text-gray-500 border-b border-gray-200"}`}>
                        <span></span><span>V1</span><span>V2</span><span>Stock</span><span>Qty In</span><span>Cost</span><span>Sell Price</span>
                </div>
                      <div className="max-h-72 overflow-y-auto">
                        {existingCombos.map(({ size, variant, stock }) => {
                          const key = `${size}|${variant}`;
                          const checked = checkedCombos[key] !== false;
                          return (
                            <div key={key} className={`grid grid-cols-[28px_1fr_1fr_48px_68px_88px_88px] gap-1 items-center px-3 py-2 ${theme === "dark" ? "border-t border-gray-700" : "border-t border-gray-100"}`}>
                              <input type="checkbox" checked={checked} onChange={() => handleComboCheck(size, variant)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "#09A046" }} />
                              <span className={`inline-block w-fit px-2 py-0.5 text-[11px] rounded-full font-medium ${theme === "dark" ? "bg-pink-500/15 text-pink-400" : "bg-pink-100 text-pink-700"}`}>{variant}</span>
                              <span className={`inline-block w-fit px-2 py-0.5 text-[11px] rounded-full font-medium min-w-[1.25rem] ${theme === "dark" ? "bg-[#09A046]/15 text-[#09A046]" : "bg-[#09A046]/10 text-[#09A046]"}`}>{size === VARIANT_ONLY_SIZE_KEY ? "—" : size}</span>
                              <span className="text-xs font-semibold text-[#09A046]">{stock}</span>
                              <input type="number" min="0" placeholder="qty" disabled={!checked} value={variantQuantities[size]?.[variant] || ""} onChange={(e) => handleVariantQuantityChange(size, variant, e.target.value)}
                                className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${!checked ? "opacity-40" : ""} ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                              <div className="flex items-center">
                                <input type="number" min="0" step="0.01" disabled={!checked} value={stockVariantPrices[size]?.[variant]?.costPrice ?? ""} onChange={(e) => handleStockVariantPriceChange(size, variant, "costPrice", e.target.value)}
                                  className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${!checked ? "opacity-40" : ""} ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                <span className="text-[10px] text-gray-400 ml-0.5">₱</span>
                              </div>
                              <div className="flex items-center">
                                <input type="number" min="0" step="0.01" disabled={!checked} value={stockVariantPrices[size]?.[variant]?.price ?? ""} onChange={(e) => handleStockVariantPriceChange(size, variant, "price", e.target.value)}
                                  className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${!checked ? "opacity-40" : ""} ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                <span className="text-[10px] text-gray-400 ml-0.5">₱</span>
                              </div>
                            </div>
                          );
                        })}

                        {/* NEW combos */}
                        {addedNewCombos.length > 0 && (<>
                          <div className={`px-3 py-1.5 ${theme === "dark" ? "border-t border-gray-700" : "border-t border-gray-200"}`}>
                            <span className="text-xs font-bold text-[#09A046]">NEW</span>
                          </div>
                          {addedNewCombos.map(({ size, variant }) => {
                            const key = `${size}|${variant}`;
                            const checked = checkedCombos[key] !== false;
                            return (
                              <div key={`new-${key}`} className={`grid grid-cols-[28px_1fr_1fr_48px_68px_88px_88px] gap-1 items-center px-3 py-2 ${theme === "dark" ? "border-t border-gray-700" : "border-t border-gray-100"}`}>
                                <input type="checkbox" checked={checked} onChange={() => handleComboCheck(size, variant)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "#09A046" }} />
                                <span className={`inline-block w-fit px-2 py-0.5 text-[11px] rounded-full font-medium ${theme === "dark" ? "bg-pink-500/15 text-pink-400" : "bg-pink-100 text-pink-700"}`}>{variant}</span>
                                <span className={`inline-block w-fit px-2 py-0.5 text-[11px] rounded-full font-medium min-w-[1.25rem] ${theme === "dark" ? "bg-[#09A046]/15 text-[#09A046]" : "bg-[#09A046]/10 text-[#09A046]"}`}>{size === VARIANT_ONLY_SIZE_KEY ? "—" : size}</span>
                                <span className="text-xs text-gray-400">—</span>
                                <input type="number" min="0" placeholder="qty" disabled={!checked} value={variantQuantities[size]?.[variant] || ""} onChange={(e) => handleVariantQuantityChange(size, variant, e.target.value)}
                                  className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${!checked ? "opacity-40" : ""} ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                <div className="flex items-center">
                                  <input type="number" min="0" step="0.01" disabled={!checked} value={stockVariantPrices[size]?.[variant]?.costPrice ?? ""} onChange={(e) => handleStockVariantPriceChange(size, variant, "costPrice", e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${!checked ? "opacity-40" : ""} ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                  <span className="text-[10px] text-gray-400 ml-0.5">₱</span>
                                </div>
                                <div className="flex items-center">
                                  <input type="number" min="0" step="0.01" disabled={!checked} value={stockVariantPrices[size]?.[variant]?.price ?? ""} onChange={(e) => handleStockVariantPriceChange(size, variant, "price", e.target.value)}
                                    className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${!checked ? "opacity-40" : ""} ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                  <span className="text-[10px] text-gray-400 ml-0.5">₱</span>
                                </div>
                              </div>
                            );
                          })}
                        </>)}
                      </div>

                      {/* Fill row: same column order as table → Qty In | Cost | Sell Price */}
                      <div className={`px-3 py-2 border-t ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]/80" : "border-gray-200 bg-gray-50/80"}`}>
                        <div className="grid grid-cols-[28px_1fr_1fr_48px_68px_88px_88px] gap-1 items-center">
                          <span className="text-[9px] font-semibold uppercase text-[#09A046] col-span-4 text-right pr-1">Fill</span>
                          <input
                            type="number"
                            min="0"
                            value={fillAllQtySI}
                            onChange={(e) => setFillAllQtySI(e.target.value)}
                            placeholder="Qty"
                            className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`}
                          />
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fillAllCostSI}
                              onChange={(e) => setFillAllCostSI(e.target.value)}
                              placeholder="Cost"
                              className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`}
                            />
                            <span className="text-[10px] text-gray-400 ml-0.5 shrink-0">₱</span>
                          </div>
                          <div className="flex items-center">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={fillAllSellSI}
                              onChange={(e) => setFillAllSellSI(e.target.value)}
                              placeholder="Sell"
                              className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`}
                            />
                            <span className="text-[10px] text-gray-400 ml-0.5 shrink-0">₱</span>
                          </div>
                        </div>
                        <div className="flex justify-end mt-1.5">
                          <button type="button" onClick={handleFillAllSI} className="text-xs font-semibold text-[#09A046] hover:underline">
                            Fill All
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* + add NEW Variants */}
                    <div className={`border-2 border-dashed rounded-xl overflow-hidden ${theme === "dark" ? "border-[#09A046]/30 bg-[#09A046]/5" : "border-[#09A046]/40 bg-[#09A046]/5"}`}>
                      <button type="button" onClick={() => setShowAddNewSection(!showAddNewSection)} className="w-full flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm font-semibold text-[#09A046]">+ add NEW Variants</span>
                        <span className="text-xs text-[#09A046]">{showAddNewSection ? "collapse" : "expand"}</span>
                      </button>
                      {showAddNewSection && (
                        <div className={`px-4 pb-4 space-y-4 border-t ${theme === "dark" ? "border-[#09A046]/20" : "border-[#09A046]/20"}`}>
                          <div className="grid grid-cols-2 gap-4 pt-3">
                            {/* V1 - Colors */}
                            <div className={`p-3 rounded-lg border ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-white"}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>VARIANT 1 – Colors</p>
                                <span title="Press Enter to add" className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border ${theme === "dark" ? "text-gray-300 border-gray-600" : "text-gray-600 border-gray-300"}`}>i</span>
                              </div>
                              <select value="" onChange={(e) => { if (e.target.value && !newV1Tags.includes(e.target.value)) setNewV1Tags(prev => [...prev, e.target.value]); }}
                                className={`w-full px-2 py-1.5 text-xs border rounded-lg mb-2 appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`}>
                                <option value="">Select color...</option>
                                {["White","Black","Red","Blue","Green","Yellow","Pink","Purple","Orange","Brown","Gray","Beige","Navy","Maroon","Cream","Teal"].filter(c => !newV1Tags.includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <div className="flex flex-wrap gap-1 items-center">
                                {newV1Tags.map(tag => (
                                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-pink-100 text-pink-700 font-medium">
                                    {tag} <button type="button" onClick={() => setNewV1Tags(prev => prev.filter(t => t !== tag))} className="hover:text-pink-900">×</button>
                                  </span>
                                ))}
                                <input type="text" value={newV1Input} onChange={(e) => setNewV1Input(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = newV1Input.trim(); if (v && !newV1Tags.includes(v)) { setNewV1Tags(prev => [...prev, v]); setNewV1Input(""); } } }}
                                  placeholder="Add +" className={`w-16 px-1 py-0.5 text-[11px] border-b border-dashed outline-none ${theme === "dark" ? "bg-transparent border-gray-600 text-white placeholder-gray-500" : "bg-transparent border-gray-400 placeholder-gray-400"}`} />
                  </div>
                            </div>
                            {/* V2 - Size */}
                            <div className={`p-3 rounded-lg border ${theme === "dark" ? "border-gray-700 bg-[#1E1B18]" : "border-gray-200 bg-white"}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>VARIANT 2 – Size <span className="font-normal text-gray-400">(optional)</span></p>
                                <span title="Press Enter to add" className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold border ${theme === "dark" ? "text-gray-300 border-gray-600" : "text-gray-600 border-gray-300"}`}>i</span>
                              </div>
                              <select value="" onChange={(e) => { if (e.target.value && !newV2Tags.includes(e.target.value)) setNewV2Tags(prev => [...prev, e.target.value]); }}
                                className={`w-full px-2 py-1.5 text-xs border rounded-lg mb-2 appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`}>
                                <option value="">Select size...</option>
                                {["XS","S","M","L","XL","XXL","XXXL","Free Size","Small","Medium","Large"].filter(s => !newV2Tags.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <div className="flex flex-wrap gap-1 items-center">
                                {newV2Tags.map(tag => (
                                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-[#09A046]/10 text-[#09A046] font-medium">
                                    {tag} <button type="button" onClick={() => setNewV2Tags(prev => prev.filter(t => t !== tag))} className="hover:text-green-800">×</button>
                                  </span>
                                ))}
                                <input type="text" value={newV2Input} onChange={(e) => setNewV2Input(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const v = newV2Input.trim(); if (v && !newV2Tags.includes(v)) { setNewV2Tags(prev => [...prev, v]); setNewV2Input(""); } } }}
                                  placeholder="Add +" className={`w-16 px-1 py-0.5 text-[11px] border-b border-dashed outline-none ${theme === "dark" ? "bg-transparent border-gray-600 text-white placeholder-gray-500" : "bg-transparent border-gray-400 placeholder-gray-400"}`} />
                              </div>
                            </div>
                          </div>

                          {/* Preview combos */}
                          {(() => {
                            const existingSet = new Set(existingCombos.map(c => `${c.size}|${c.variant}`));
                            const addedSet = new Set(addedNewCombos.map(c => `${c.size}|${c.variant}`));
                            const previewCombos = buildPickerCombos(newV1Tags, newV2Tags, existingSet, addedSet);
                            if (previewCombos.length === 0) return null;
                            return (<>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-semibold ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{previewCombos.length} COMBINATIONS GENERATED</span>
                                <span className="text-xs text-gray-400 cursor-pointer hover:underline" onClick={() => {
                                  const qFill = String(fillAllQtySI ?? "").trim();
                                  const cFill = String(fillAllCostSI ?? "").trim();
                                  const sFill = String(fillAllSellSI ?? "").trim();
                                  const u = { ...newComboData };
                                  previewCombos.forEach(({ size, variant }) => {
                                    const k = `${size}|${variant}`;
                                    u[k] = {
                                      ...(u[k] || {}),
                                      ...(cFill !== "" ? { cost: cFill } : {}),
                                      ...(sFill !== "" ? { sell: sFill } : {}),
                                      ...(qFill !== "" ? { qty: qFill } : {}),
                                    };
                                  });
                                  setNewComboData(u);
                                }}>Fill all</span>
                              </div>
                              <div className={`rounded-lg border overflow-hidden ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                                <div className={`grid grid-cols-[1fr_88px_88px_68px] gap-1 items-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${theme === "dark" ? "bg-[#2A2724] text-gray-400 border-b border-gray-700" : "bg-gray-50 text-gray-500 border-b border-gray-200"}`}>
                                  <span>New Combo</span><span>Cost Price ₱</span><span>Selling Price ₱</span><span>Qty In</span>
                                </div>
                                {previewCombos.map(({ size, variant }) => {
                                  const k = `${size}|${variant}`;
                                  return (
                                    <div key={k} className={`grid grid-cols-[1fr_88px_88px_68px] gap-1 items-center px-3 py-2 ${theme === "dark" ? "border-t border-gray-700" : "border-t border-gray-100"}`}>
                                      <div className="flex items-center gap-1">
                                        {size !== VARIANT_ONLY_SIZE_KEY && (
                                          <>
                                            <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${theme === "dark" ? "bg-[#09A046]/15 text-[#09A046]" : "bg-[#09A046]/10 text-[#09A046]"}`}>{size}</span>
                                            <span className={`text-xs ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>×</span>
                                          </>
                                        )}
                                        <span className={`px-2 py-0.5 text-[11px] rounded-full font-medium ${theme === "dark" ? "bg-pink-500/15 text-pink-400" : "bg-pink-100 text-pink-700"}`}>{variant}</span>
                                      </div>
                                      <div className="flex items-center">
                                        <input type="number" min="0" step="0.01" value={newComboData[k]?.cost || ""} onChange={(e) => setNewComboData(prev => ({ ...prev, [k]: { ...(prev[k] || {}), cost: e.target.value } }))}
                                          placeholder="0" className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                        <span className="text-[10px] text-gray-400 ml-0.5">₱</span>
                                      </div>
                                      <div className="flex items-center">
                                        <input type="number" min="0" step="0.01" value={newComboData[k]?.sell || ""} onChange={(e) => setNewComboData(prev => ({ ...prev, [k]: { ...(prev[k] || {}), sell: e.target.value } }))}
                                          placeholder="0" className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                        <span className="text-[10px] text-gray-400 ml-0.5">₱</span>
                                      </div>
                                      <input type="number" min="0" value={newComboData[k]?.qty || ""} onChange={(e) => setNewComboData(prev => ({ ...prev, [k]: { ...(prev[k] || {}), qty: e.target.value } }))}
                                        placeholder="qty" className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                                    </div>
                                  );
                                })}
                              </div>
                              <button type="button" onClick={handleAddNewCombosFromPicker} className="w-full py-2 text-sm font-semibold rounded-lg text-white transition-all hover:opacity-90" style={{ background: "#09A046" }}>Add +</button>
                            </>);
                          })()}
                        </div>
                      )}
                    </div>
                  </>) : hasSizes ? (
                    <div>
                      <p className={`text-xs mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Select sizes to add stock to</p>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {availableSizes.map((size) => {
                          const currentQty = hasSizes && product.sizes[size] ? getSizeQuantity(product.sizes[size]) : 0;
                          return (
                            <label key={size} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={selectedSizes.includes(size)} onChange={() => handleSizeToggle(size)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "#09A046" }} />
                              <span className={`text-sm ${theme === "dark" ? "text-gray-200" : "text-gray-900"}`}>{size} <span className="text-xs text-gray-500">({currentQty})</span></span>
                    </label>
                          );
                        })}
                  </div>
                      {selectedSizes.length > 0 && (
                        <div className={`space-y-2 p-3 rounded-lg ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}>
                          <label className={`block text-xs font-semibold mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Quantity per Size:</label>
                          <div className="grid grid-cols-2 gap-3">
                            {selectedSizes.map((size) => (
                              <div key={size}>
                                <label className={`block text-xs mb-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>{size}</label>
                                <input type="number" min="0" value={sizeQuantities[size] || ""} onChange={(e) => handleSizeQuantityChange(size, e.target.value)} placeholder="Qty"
                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white" : "bg-white border-gray-300"}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className={`text-xs mb-2 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Current Stock: {product.currentStock || 0}</p>
                      <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Enter quantity to add"
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300"}`} />
                    </div>
                  )}
                </div>
                )}

                {/* Step 2: Batch & Reason */}
                {currentStep === 2 && (
                  <div className="space-y-5 pt-2">
                    <h3 className={`text-sm font-bold uppercase tracking-wide ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Entry Details</h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          Brand Partner/Supplier <span className="text-red-500">*</span>
                      </label>
                        <div className="relative">
                          <select
                            value={stockInBrandPartner}
                            onChange={(e) => setStockInBrandPartner(e.target.value)}
                            className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                          >
                            <option value="" disabled style={{ color: '#9CA3AF' }}>Select Brand Partner</option>
                            {!brandPartnerNames.some((name) => String(name).trim().toLowerCase() === "default") ? (
                              <option value="Default">Default</option>
                            ) : null}
                            {brandPartnerNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>
                      </div>
                        <div>
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                          Date Received <span className="text-red-500">*</span>
                          </label>
                          <input
                          type="date"
                          value={dateReceived}
                          onChange={(e) => setDateReceived(e.target.value)}
                          className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                          />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Batch Number</label>
                        {hasSizes ? (
                          <div className="relative">
                            <select
                              value={stockInBatchChoice}
                              onChange={(e) => {
                                const v = e.target.value;
                                setStockInBatchChoice(v);
                                if (v === "new") {
                                  const now = new Date();
                                  const y = now.getFullYear();
                                  const mo = String(now.getMonth() + 1).padStart(2, "0");
                                  const d = String(now.getDate()).padStart(2, "0");
                                  const h = String(now.getHours()).padStart(2, "0");
                                  const min = String(now.getMinutes()).padStart(2, "0");
                                  setBatchCode(`B${y}${mo}${d}-${h}${min}`);
                                } else {
                                  const slot = stockInBatchList.find((b) => String(b.slotIndex) === v);
                                  setBatchCode(slot?.code || "");
                                }
                              }}
                              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                            >
                              <option value="new">
                                New batch{stockInBatchChoice === "new" && batchCode ? ` (${batchCode})` : ""}
                              </option>
                              {stockInBatchList.map((b) => (
                                <option key={b.slotIndex} value={String(b.slotIndex)}>
                                  Batch {b.slotIndex + 1}
                                  {b.code ? ` (${b.code})` : ""} · {b.totalQty} pcs
                                </option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                          </div>
                        ) : (
                          <p className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{batchCode || "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Expiring Date (if applicable)</label>
                          <input
                            type="date"
                            value={batchExpirationDate}
                            min={todayISO}
                            onChange={(e) => setBatchExpirationDate(e.target.value)}
                          className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                          />
                        </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Reason</label>
                      <div className="relative">
                        <select
                          value={reason}
                          onChange={(e) => {
                            setReason(e.target.value);
                            if (e.target.value !== "Other") setOtherReason("");
                          }}
                          className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent appearance-none cursor-pointer ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}
                        >
                          {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
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
                          className={`w-full mt-2 px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Review */}
                {currentStep === 3 && (() => {
                  const reviewRows = [];
                  if (hasSizes && hasVariants) {
                    const allCombos = [...existingCombos.map(c => ({ size: c.size, variant: c.variant })), ...addedNewCombos];
                    allCombos.forEach(({ size, variant }) => {
                      const key = `${size}|${variant}`;
                      if (checkedCombos[key] === false) return;
                      const qty = parseInt(variantQuantities[size]?.[variant]) || 0;
                      if (qty <= 0) return;
                      const sizeData = product.sizes?.[size];
                      const existingStock = typeof sizeData?.variants?.[variant] === 'object' ? (sizeData.variants[variant].quantity || 0) : (typeof sizeData?.variants?.[variant] === 'number' ? sizeData.variants[variant] : 0);
                      const cost = stockVariantPrices[size]?.[variant]?.costPrice || 0;
                      const sell = stockVariantPrices[size]?.[variant]?.price || 0;
                      reviewRows.push({ variant, size, stock: existingStock, qtyIn: qty, cost, sell });
                    });
                  } else if (hasSizes) {
                    selectedSizes.forEach(size => {
                      const qty = parseInt(sizeQuantities[size]) || 0;
                      if (qty <= 0) return;
                      const sizeData = product.sizes?.[size];
                      const existingStock = sizeData?.quantity || 0;
                      reviewRows.push({ variant: null, size, stock: existingStock, qtyIn: qty, cost: 0, sell: 0 });
                    });
                  } else {
                    const qty = parseInt(quantity) || 0;
                    if (qty > 0) reviewRows.push({ variant: null, size: null, stock: product.currentStock || 0, qtyIn: qty, cost: 0, sell: 0 });
                  }

                                return (
                  <div className="space-y-3">
                    <div>
                      <h3 className={`text-sm font-bold uppercase tracking-wide ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Review Before Saving</h3>
                      <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>Double-check everything. Once confirmed, inventory will be updated immediately.</p>
                                  </div>

                    <div className={`rounded-xl border overflow-hidden ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                      <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
                        <table className="w-full text-xs">
                          <thead className={`sticky top-0 z-10 ${theme === "dark" ? "bg-[#2A2724]" : "bg-gray-50"}`}>
                            <tr className={`border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                              {hasVariants && <th className={`px-3 py-2 text-left font-bold uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>V1</th>}
                              {hasVariants && <th className={`px-3 py-2 text-left font-bold uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>V2</th>}
                              <th className={`px-3 py-2 text-center font-bold uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Stock</th>
                              <th className={`px-3 py-2 text-center font-bold uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Qty In</th>
                              <th className={`px-3 py-2 text-right font-bold uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Cost</th>
                              <th className={`px-3 py-2 text-right font-bold uppercase tracking-wide ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Sell Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reviewRows.map((row, i) => (
                              <tr key={i} className={`border-b last:border-b-0 ${theme === "dark" ? "border-gray-700/50" : "border-gray-100"}`}>
                                {hasVariants && (
                                  <td className="px-3 py-2.5">
                                    <span className={`inline-block px-2.5 py-0.5 text-[11px] rounded-full font-medium ${theme === "dark" ? "bg-pink-500/15 text-pink-400" : "bg-pink-100 text-pink-700"}`}>{row.variant}</span>
                                  </td>
                                )}
                                {hasVariants && (
                                  <td className="px-3 py-2.5">
                                    {row.size && row.size !== VARIANT_ONLY_SIZE_KEY
                                      ? <span className={`inline-block px-2.5 py-0.5 text-[11px] rounded-full font-medium ${theme === "dark" ? "bg-blue-500/15 text-blue-400" : "bg-blue-100 text-blue-700"}`}>{row.size}</span>
                                      : <span className="text-gray-400">—</span>}
                                  </td>
                                )}
                                <td className={`px-3 py-2.5 text-center ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}>{row.stock}</td>
                                <td className="px-3 py-2.5 text-center font-semibold text-[#09A046]">+{row.qtyIn}</td>
                                <td className={`px-3 py-2.5 text-right ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>₱ {Number(row.cost).toLocaleString()}</td>
                                <td className={`px-3 py-2.5 text-right ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>₱ {Number(row.sell).toLocaleString()}</td>
                              </tr>
                            ))}
                            {reviewRows.length === 0 && (
                              <tr><td colSpan={hasVariants ? 6 : 4} className="px-3 py-6 text-center text-gray-400 italic text-xs">No items to review</td></tr>
                            )}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Step 1: (moved above) */}
                {false && (
                <>
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
                              className="w-4 h-4 border-gray-300 rounded focus:ring-[#09A046] cursor-pointer"
                              style={{
                                accentColor: "#09A046"
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
                          className="w-4 h-4 border-gray-300 rounded focus:ring-[#09A046] cursor-pointer"
                          style={{ accentColor: "#09A046" }} />
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
                              className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
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

                                  {/* Price inputs for new sizes — hide when diff prices per variant is on */}
                                  {isNewSize && !diffPricesPerVariant[size] &&
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
                                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
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
                                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
                                      </div>
                                    </div>
                                  }
                                  <div className="grid grid-cols-2 gap-2">
                                    {allVariants.map((variant) => {
                                      const currentVariantQty = getVariantCurrentQty(size, variant);
                                      const isNewVariant = addedVariants.includes(variant);
                                      const showDiffPrices = diffPricesPerVariant[size];
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
                                            placeholder="Qty"
                                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`} />

                                          {showDiffPrices &&
                                            <div className="grid grid-cols-2 gap-1 mt-1">
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={stockVariantPrices[size]?.[variant]?.price ?? (product.itemPrice || "")}
                                                onChange={(e) => handleStockVariantPriceChange(size, variant, "price", e.target.value)}
                                                placeholder="Price"
                                                className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`} />
                                              <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={stockVariantPrices[size]?.[variant]?.costPrice ?? (product.costPrice || "")}
                                                onChange={(e) => handleStockVariantPriceChange(size, variant, "costPrice", e.target.value)}
                                                placeholder="Cost"
                                                className={`w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#09A046] ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`} />
                                            </div>
                                          }
                                        </div>);

                                    })}
                                  </div>

                                  {/* Diff prices per variant checkbox */}
                                  <div className={`mt-3 pt-3 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={diffPricesPerVariant[size] || false}
                                        onChange={() => handleDiffPricesToggle(size)}
                                        className="w-4 h-4 border-gray-300 rounded focus:ring-[#09A046] cursor-pointer"
                                        style={{ accentColor: "#09A046" }} />
                                      <span className={`text-xs ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                                        Diff prices each variants
                                      </span>
                                    </label>
                                    {diffPricesPerVariant[size] &&
                                      <p className={`text-xs mt-1 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                                        Set selling price & cost above each variant
                                      </p>
                                    }
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
                                        className={`flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`}
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
                                  {selectedSizes[0] === size && addedVariants.length > 0 && !isNewSize && !selectedSizes.some(s => diffPricesPerVariant[s]) &&
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
                                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

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
                                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

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
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
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
                                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />
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
                                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#1E1B18] border-gray-700 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />


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
                                      className={`flex-1 px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-700 text-white placeholder-gray-500" : "bg-gray-50 border-gray-300 text-gray-900"}`}
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
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#09A046] focus:border-transparent ${theme === "dark" ? "bg-[#2A2724] border-gray-600 text-white placeholder-gray-500" : "bg-white border-gray-300 text-gray-900"}`} />

                  </div>
                }
                </>
                )}
              </div>

              <div className={`flex justify-between items-center mt-6 pt-4 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
                <button type="button" onClick={currentStep === 1 ? handleClose : () => setCurrentStep(prev => prev - 1)}
                  className={`px-8 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors ${theme === "dark" ? "text-gray-300 border-gray-600 hover:bg-gray-700" : "text-gray-600 border-gray-300 hover:bg-gray-100"}`}>
                  {currentStep === 1 ? "Cancel" : "← Back"}
                </button>
                {currentStep < 3 ? (
                  <button type="button" disabled={!isStepValid(currentStep)} onClick={() => { if (isStepValid(currentStep)) setCurrentStep(prev => prev + 1); }}
                    className="px-8 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)" }}>
                    Continue
                  </button>
                ) : (
                  <button type="button" disabled={loading} onClick={handleSubmit}
                    className="px-8 py-2.5 text-sm font-semibold rounded-xl text-white transition-all shadow-md hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#09A046" }}>
                    {loading ? "Adding..." : "Stock In"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);

};

export default StockInModal;