import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { brandPartnerAPI } from "../../services/api";

const VARIANT_ONLY_SIZE_KEY = "__VARIANT_ONLY__";

const buildPickerCombos = (v1Tags, v2Tags, existingSet, addedSet) => {
  const out = [];
  if (v1Tags.length > 0 && v2Tags.length > 0) {
    v1Tags.forEach((v1) => {
      v2Tags.forEach((v2) => {
        const key = `${v2}|${v1}`;
        if (!existingSet.has(key) && !addedSet.has(key))
          out.push({ size: v2, variant: v1 });
      });
    });
  } else if (v1Tags.length > 0) {
    v1Tags.forEach((v1) => {
      const key = `${VARIANT_ONLY_SIZE_KEY}|${v1}`;
      if (!existingSet.has(key) && !addedSet.has(key))
        out.push({ size: VARIANT_ONLY_SIZE_KEY, variant: v1 });
    });
  }
  return out;
};

const COLOR_OPTIONS = [
  "White",
  "Black",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Pink",
  "Purple",
  "Orange",
  "Brown",
  "Gray",
  "Beige",
  "Navy",
  "Maroon",
  "Cream",
  "Teal",
];
const V2_SIZE_OPTIONS = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "XXXL",
  "Free Size",
  "Small",
  "Medium",
  "Large",
];

const StockInModal = ({ visible, onClose, product, onConfirm, loading }) => {
  const [brandPartners, setBrandPartners] = useState([]);
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
  const [stockInBatchChoice, setStockInBatchChoice] = useState("new");
  const [showDateReceivedPicker, setShowDateReceivedPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);
  const [v1PickerKey, setV1PickerKey] = useState("");
  const [v2PickerKey, setV2PickerKey] = useState("");

  const reasons = ["Restock", "Returned Item", "Exchange", "Other"];
  const displayName = product?.itemName || product?.name || "";

  const hasSizes =
    product?.sizes &&
    typeof product.sizes === "object" &&
    Object.keys(product.sizes).length > 0;

  const getSizeQuantity = (sizeData) => {
    if (
      typeof sizeData === "object" &&
      sizeData !== null &&
      sizeData.quantity !== undefined
    ) {
      return sizeData.quantity;
    }
    return typeof sizeData === "number" ? sizeData : 0;
  };

  const getSizeVariants = (size) => {
    if (
      hasSizes &&
      product.sizes[size] &&
      typeof product.sizes[size] === "object" &&
      product.sizes[size].variants
    ) {
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
            const batches =
              typeof vData === "object" && Array.isArray(vData.batches)
                ? vData.batches
                : [];
            max = Math.max(max, batches.length);
          });
        });
        return max;
      })();

      if (maxBatchDepth <= 0) {
        const openingBatchCode =
          product?.batchNumber || product?.openingBatchNumber || "B1";
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
          const batches =
            typeof vData === "object" && Array.isArray(vData.batches)
              ? vData.batches
              : [];
          const fallbackQty = (idx) => (idx === 0 ? getVariantQty(vData) : 0);
          for (let slotIndex = 0; slotIndex < maxBatchDepth; slotIndex++) {
            const b = batches[slotIndex];
            const qty = b ? parseInt(b.qty, 10) || 0 : fallbackQty(slotIndex);
            if (qty <= 0) continue;
            const slot = slots[slotIndex];
            slot.totalQty += qty;
            if (!slot.code) {
              slot.code =
                b?.batchCode ||
                (slotIndex === 0
                  ? product?.batchNumber || product?.openingBatchNumber || ""
                  : "");
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
      const openingBatchCode =
        product?.batchNumber || product?.openingBatchNumber || "B1";
      let totalQty = 0;
      Object.values(product.sizes).forEach((sd) => {
        if (typeof sd === "object" && sd !== null)
          totalQty += getSizeQuantity(sd);
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
            (slotIndex === 0
              ? product?.batchNumber || product?.openingBatchNumber || ""
              : "");
        }
      }
    });

    return slots.filter((s) => s.totalQty > 0);
  }, [product, hasSizes, hasVariants]);

  const existingSizes = hasSizes ? Object.keys(product.sizes) : [];
  const availableSizes = [...existingSizes, ...addedNewSizes];

  const allPossibleSizes = (() => {
    const category = product?.category || "";
    let sizes = [];
    if (["Tops", "Bottoms", "Dresses"].includes(category)) {
      sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"];
    } else if (category === "Shoes") {
      sizes = ["5", "6", "7", "8", "9", "10", "11", "12"];
    } else if (["Accessories", "Head Wear", "Makeup"].includes(category)) {
      sizes = ["Free Size"];
    } else if (category === "Foods") {
      const subtype = product?.foodSubtype || "";
      if (["Beverages", "Drinks"].includes(subtype)) {
        sizes = ["Small", "Medium", "Large", "Family Size", "Free Size"];
      } else {
        sizes = ["Small", "Medium", "Large", "Free Size"];
      }
    } else {
      sizes = [
        "XS",
        "S",
        "M",
        "L",
        "XL",
        "XXL",
        "XXXL",
        "Small",
        "Medium",
        "Large",
        "Free Size",
      ];
    }
    return sizes.filter(
      (s) => !existingSizes.includes(s) && !addedNewSizes.includes(s),
    );
  })();

  const existingCombos = (() => {
    const combos = [];
    if (hasSizes) {
      existingSizes.forEach((size) => {
        const sizeVariants = getSizeVariants(size);
        if (sizeVariants) {
          Object.keys(sizeVariants).forEach((variant) => {
            const vData = sizeVariants[variant];
            const stock =
              typeof vData === "object"
                ? vData.quantity || 0
                : typeof vData === "number"
                  ? vData
                  : 0;
            combos.push({ size, variant, stock });
          });
        }
      });
    }
    return combos;
  })();

  const fetchPartners = useCallback(async () => {
    try {
      const res = await brandPartnerAPI.getAll();
      if (res.success && Array.isArray(res.data)) setBrandPartners(res.data);
    } catch (e) {
      console.error("brandPartnerAPI.getAll", e);
    }
  }, []);

  useEffect(() => {
    if (visible) fetchPartners();
  }, [visible, fetchPartners]);

  useEffect(() => {
    if (visible && product) {
      setSizeQuantities({});
      setVariantQuantities({});
      setQuantity("");
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const h = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      setBatchCode(`B${y}${m}${d}-${h}${min}`);
      setBatchExpirationDate("");
      setReason("Restock");
      setOtherReason("");
      setNewVariantInputs({});
      setAddedVariants([]);
      setNewVariantPrices({});
      setAddedNewSizes([]);
      setNewSizePrices({});
      setCurrentStep(1);
      setShowAddNewSection(false);
      setNewV1Tags([]);
      setNewV2Tags([]);
      setNewV1Input("");
      setNewV2Input("");
      setAddedNewCombos([]);
      setNewComboData({});
      setFillAllCostSI("");
      setFillAllSellSI("");
      setFillAllQtySI("");
      setStockInBrandPartner("");
      setDateReceived(new Date().toISOString().split("T")[0]);
      setStockInBatchChoice("new");

      const initChecked = {};
      const initPrices = {};
      const initDiff = {};
      if (product.sizes && typeof product.sizes === "object") {
        const sizes = Object.keys(product.sizes);
        setSelectedSizes(sizes);
        sizes.forEach((size) => {
          const sd = product.sizes[size];
          if (typeof sd === "object" && sd?.variants) {
            initDiff[size] = true;
            initPrices[size] = {};
            Object.entries(sd.variants).forEach(([variant, vData]) => {
              initChecked[`${size}|${variant}`] = true;
              const cost =
                typeof vData === "object"
                  ? vData.costPrice ||
                    sd.variantCostPrices?.[variant] ||
                    sd.costPrice ||
                    product.costPrice ||
                    0
                  : sd.variantCostPrices?.[variant] ||
                    sd.costPrice ||
                    product.costPrice ||
                    0;
              const sell =
                typeof vData === "object"
                  ? vData.price ||
                    sd.variantPrices?.[variant] ||
                    sd.price ||
                    product.itemPrice ||
                    0
                  : sd.variantPrices?.[variant] ||
                    sd.price ||
                    product.itemPrice ||
                    0;
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
  }, [visible, product?._id, product?.id]);

  const previewCombosMemo = useMemo(() => {
    const existingSet = new Set(
      existingCombos.map((c) => `${c.size}|${c.variant}`),
    );
    const addedSet = new Set(
      addedNewCombos.map((c) => `${c.size}|${c.variant}`),
    );
    return buildPickerCombos(newV1Tags, newV2Tags, existingSet, addedSet);
  }, [newV1Tags, newV2Tags, existingCombos, addedNewCombos]);

  if (!visible || !product) return null;

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
    setAddedNewSizes([]);
    setNewSizePrices({});
    setDiffPricesPerVariant({});
    setStockVariantPrices({});
    setCurrentStep(1);
    setCheckedCombos({});
    setShowAddNewSection(false);
    setNewV1Tags([]);
    setNewV2Tags([]);
    setNewV1Input("");
    setNewV2Input("");
    setAddedNewCombos([]);
    setNewComboData({});
    setFillAllCostSI("");
    setFillAllSellSI("");
    setFillAllQtySI("");
    onClose();
  };

  const handleSizeToggle = (size) => {
    const isSelected = selectedSizes.includes(size);
    if (isSelected) {
      setSelectedSizes((prev) => prev.filter((s) => s !== size));
      setSizeQuantities((prev) => {
        const n = { ...prev };
        delete n[size];
        return n;
      });
      setVariantQuantities((prev) => {
        const n = { ...prev };
        delete n[size];
        return n;
      });
    } else {
      setSelectedSizes((prev) => [...prev, size]);
      setSizeQuantities((prev) => ({ ...prev, [size]: "" }));
      if (hasVariants) {
        setVariantQuantities((prev) => ({ ...prev, [size]: {} }));
      }
    }
  };

  const handleSizeQuantityChange = (size, qty) => {
    setSizeQuantities((prev) => ({ ...prev, [size]: qty }));
  };

  const handleVariantQuantityChange = (size, variant, qty) => {
    setVariantQuantities((prev) => ({
      ...prev,
      [size]: { ...(prev[size] || {}), [variant]: qty },
    }));
  };

  const handleNewVariantInputChange = (size, value) => {
    setNewVariantInputs((prev) => ({ ...prev, [size]: value }));
  };

  const handleAddNewVariant = (size) => {
    const variantName = (newVariantInputs[size] || "").trim();
    if (!variantName) {
      Alert.alert("Error", "Please enter a variant name");
      return;
    }
    if (allVariants.includes(variantName)) {
      Alert.alert("Error", "This variant already exists");
      return;
    }
    setAddedVariants((prev) => [...prev, variantName]);
    setNewVariantPrices((prev) => ({
      ...prev,
      [variantName]: {
        price: product.itemPrice || 0,
        costPrice: product.costPrice || 0,
      },
    }));
    setNewVariantInputs((prev) => ({ ...prev, [size]: "" }));
  };

  const handleStockVariantPriceChange = (size, variant, field, value) => {
    setStockVariantPrices((prev) => ({
      ...prev,
      [size]: {
        ...(prev[size] || {}),
        [variant]: {
          ...(prev[size]?.[variant] || {
            price: product.itemPrice || 0,
            costPrice: product.costPrice || 0,
          }),
          [field]: value,
        },
      },
    }));
  };

  const handleComboCheck = (size, variant) => {
    const key = `${size}|${variant}`;
    const wasChecked = checkedCombos[key] !== false;
    setCheckedCombos((prev) => ({ ...prev, [key]: !wasChecked }));
    if (wasChecked) {
      setVariantQuantities((prev) => {
        const u = { ...prev };
        if (u[size]) {
          const row = { ...u[size] };
          delete row[variant];
          u[size] = row;
        }
        return u;
      });
    }
  };

  const handleAddNewCombosFromPicker = () => {
    const existingSet = new Set(
      existingCombos.map((c) => `${c.size}|${c.variant}`),
    );
    const addedSet = new Set(
      addedNewCombos.map((c) => `${c.size}|${c.variant}`),
    );
    const previewCombos = buildPickerCombos(
      newV1Tags,
      newV2Tags,
      existingSet,
      addedSet,
    );
    if (previewCombos.length === 0) return;

    setAddedNewCombos((prev) => [...prev, ...previewCombos]);
    const newVars = newV1Tags.filter((v) => !allVariants.includes(v));
    const newSzs = newV2Tags.filter(
      (s) => !existingSizes.includes(s) && !addedNewSizes.includes(s),
    );
    if (newVars.length > 0)
      setAddedVariants((prev) => [...new Set([...prev, ...newVars])]);
    if (newSzs.length > 0) {
      setAddedNewSizes((prev) => [...new Set([...prev, ...newSzs])]);
      setSelectedSizes((prev) => [...new Set([...prev, ...newSzs])]);
    }
    newV2Tags
      .filter((s) => existingSizes.includes(s) && !selectedSizes.includes(s))
      .forEach((s) => {
        setSelectedSizes((prev) => (prev.includes(s) ? prev : [...prev, s]));
      });
    if (previewCombos.some((c) => c.size === VARIANT_ONLY_SIZE_KEY)) {
      setSelectedSizes((prev) =>
        prev.includes(VARIANT_ONLY_SIZE_KEY)
          ? prev
          : [...prev, VARIANT_ONLY_SIZE_KEY],
      );
    }

    const checkedUpdates = {};
    const priceUpdates = {};
    const qtyUpdates = {};
    previewCombos.forEach(({ size, variant }) => {
      const key = `${size}|${variant}`;
      const data = newComboData[key] || {};
      checkedUpdates[key] = true;
      if (!priceUpdates[size]) priceUpdates[size] = {};
      priceUpdates[size][variant] = {
        price: data.sell || product.itemPrice || 0,
        costPrice: data.cost || product.costPrice || 0,
      };
      if (data.qty) {
        if (!qtyUpdates[size]) qtyUpdates[size] = {};
        qtyUpdates[size][variant] = data.qty;
      }
    });
    setCheckedCombos((prev) => ({ ...prev, ...checkedUpdates }));
    setStockVariantPrices((prev) => {
      const u = { ...prev };
      Object.entries(priceUpdates).forEach(([s, vs]) => {
        u[s] = { ...(u[s] || {}), ...vs };
      });
      return u;
    });
    if (Object.keys(qtyUpdates).length > 0) {
      setVariantQuantities((prev) => {
        const u = { ...prev };
        Object.entries(qtyUpdates).forEach(([s, vs]) => {
          u[s] = { ...(u[s] || {}), ...vs };
        });
        return u;
      });
    }
    setNewV1Tags([]);
    setNewV2Tags([]);
    setNewComboData({});
    setShowAddNewSection(false);
  };

  const handleFillAllSI = () => {
    const allCombosList = [
      ...existingCombos.map((c) => ({ size: c.size, variant: c.variant })),
      ...addedNewCombos,
    ];
    const qFill = String(fillAllQtySI ?? "").trim();
    const cFill = String(fillAllCostSI ?? "").trim();
    const sFill = String(fillAllSellSI ?? "").trim();

    if (cFill !== "" || sFill !== "") {
      setStockVariantPrices((prev) => {
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
      setVariantQuantities((prev) => {
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
      if (!hasSizes) return (parseInt(quantity, 10) || 0) > 0;
      if (hasVariants) {
        const allCombosList = [
          ...existingCombos.map((c) => ({ size: c.size, variant: c.variant })),
          ...addedNewCombos,
        ];
        return allCombosList.some(({ size, variant }) => {
          return (
            checkedCombos[`${size}|${variant}`] !== false &&
            (parseInt(variantQuantities[size]?.[variant], 10) || 0) > 0
          );
        });
      }
      return selectedSizes.some((s) => (parseInt(sizeQuantities[s], 10) || 0) > 0);
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
      Alert.alert("Error", "Please specify the reason");
      return;
    }
    const finalReason =
      reason === "Other" ? `Other: ${otherReason.trim()}` : reason;

    const stockInBatchPayload = !hasSizes
      ? {
          ...(batchCode.trim() ? { batchCode: batchCode.trim() } : {}),
          ...(batchExpirationDate
            ? { expirationDate: batchExpirationDate }
            : {}),
        }
      : stockInBatchChoice !== "new"
        ? {
            targetBatchSlotIndex: parseInt(stockInBatchChoice, 10),
            ...(batchExpirationDate
              ? { expirationDate: batchExpirationDate }
              : {}),
          }
        : {
            ...(batchCode.trim() ? { batchCode: batchCode.trim() } : {}),
            ...(batchExpirationDate
              ? { expirationDate: batchExpirationDate }
              : {}),
          };

    if (!hasSizes) {
      const qty = parseInt(quantity, 10) || 0;
      if (qty <= 0) {
        Alert.alert("Error", "Please enter a valid quantity");
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
      Alert.alert("Error", "Please select at least one size");
      return;
    }

    if (hasVariants) {
      const filteredVarQtys = {};
      const checkedSizesSet = new Set();
      [
        ...existingCombos.map((c) => ({ size: c.size, variant: c.variant })),
        ...addedNewCombos,
      ].forEach(({ size, variant }) => {
        const key = `${size}|${variant}`;
        const qty = parseInt(variantQuantities[size]?.[variant], 10) || 0;
        if (checkedCombos[key] !== false && qty > 0) {
          if (!filteredVarQtys[size]) filteredVarQtys[size] = {};
          filteredVarQtys[size][variant] = variantQuantities[size][variant];
          checkedSizesSet.add(size);
        }
      });

      if (Object.keys(filteredVarQtys).length === 0) {
        Alert.alert(
          "Error",
          "Please enter quantities for at least one checked variant",
        );
        return;
      }

      const filteredSizes = Array.from(checkedSizesSet);
      onConfirm({
        sizes: sizeQuantities,
        variantQuantities: filteredVarQtys,
        selectedSizes: filteredSizes,
        reason: finalReason,
        hasVariants: true,
        newVariantPrices:
          addedVariants.length > 0 ? newVariantPrices : null,
        newSizePrices: addedNewSizes.length > 0 ? newSizePrices : null,
        diffPricesPerVariant: Object.keys(diffPricesPerVariant).some(
          (k) => diffPricesPerVariant[k],
        )
          ? diffPricesPerVariant
          : null,
        stockVariantPrices:
          Object.keys(stockVariantPrices).length > 0
            ? stockVariantPrices
            : null,
        ...stockInBatchPayload,
        ...(stockInBrandPartner ? { brandPartner: stockInBrandPartner } : {}),
        ...(dateReceived ? { dateReceived } : {}),
      });
      return;
    }

    const hasValidQuantities = selectedSizes.some((size) => {
      const qty = sizeQuantities[size] || 0;
      return parseInt(qty, 10) > 0;
    });
    if (!hasValidQuantities) {
      Alert.alert(
        "Error",
        "Please enter quantities for at least one selected size",
      );
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

  const brandNameOptions = [
    ...new Set(brandPartners.map((bp) => bp.brandName).filter(Boolean)),
  ].sort();

  const renderStep1 = () => (
    <View style={s.stepBlock}>
      <Text style={s.stepHeading}>ITEMS TO STOCK IN</Text>
      <Text style={s.stepSub}>
        Check variants that arrived; unchecked = skip
      </Text>

      {hasSizes && hasVariants ? (
        <>
          <Text style={s.muted}>Existing variants</Text>
          <View style={s.tableBorder}>
            <View style={s.comboHeaderRow}>
              <Text style={[s.comboH, { width: 22 }]} />
              <Text style={[s.comboH, { flex: 1 }]}>V1</Text>
              <Text style={[s.comboH, { flex: 1 }]}>V2</Text>
              <Text style={[s.comboH, { width: 36, textAlign: "center" }]}>
                Stk
              </Text>
              <Text style={[s.comboH, { width: 44, textAlign: "center" }]}>
                Qty
              </Text>
              <Text style={[s.comboH, { width: 52, textAlign: "center" }]}>
                Cost
              </Text>
              <Text style={[s.comboH, { width: 52, textAlign: "center" }]}>
                Sell
              </Text>
            </View>
            <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
              {existingCombos.map(({ size, variant, stock }) => {
                const key = `${size}|${variant}`;
                const checked = checkedCombos[key] !== false;
                return (
                  <View key={key} style={s.comboRow}>
                    <Pressable
                      style={{ width: 22 }}
                      onPress={() => handleComboCheck(size, variant)}
                    >
                      <View
                        style={[
                          s.cb,
                          checked && s.cbOn,
                        ]}
                      >
                        {checked ? <Text style={s.cbTick}>✓</Text> : null}
                      </View>
                    </Pressable>
                    <Text style={[s.pillPink, { flex: 1 }]} numberOfLines={1}>
                      {variant}
                    </Text>
                    <Text style={[s.pillGrn, { flex: 1 }]} numberOfLines={1}>
                      {size === VARIANT_ONLY_SIZE_KEY ? "—" : size}
                    </Text>
                    <Text style={[s.stk, { width: 36 }]}>{stock}</Text>
                    <TextInput
                      style={[s.tinyIn, { width: 44 }]}
                      editable={checked}
                      keyboardType="number-pad"
                      value={String(variantQuantities[size]?.[variant] ?? "")}
                      onChangeText={(t) =>
                        handleVariantQuantityChange(size, variant, t)
                      }
                      placeholder="0"
                    />
                    <TextInput
                      style={[s.tinyIn, { width: 52 }]}
                      editable={checked}
                      keyboardType="decimal-pad"
                      value={String(
                        stockVariantPrices[size]?.[variant]?.costPrice ?? "",
                      )}
                      onChangeText={(t) =>
                        handleStockVariantPriceChange(
                          size,
                          variant,
                          "costPrice",
                          t,
                        )
                      }
                    />
                    <TextInput
                      style={[s.tinyIn, { width: 52 }]}
                      editable={checked}
                      keyboardType="decimal-pad"
                      value={String(
                        stockVariantPrices[size]?.[variant]?.price ?? "",
                      )}
                      onChangeText={(t) =>
                        handleStockVariantPriceChange(size, variant, "price", t)
                      }
                    />
                  </View>
                );
              })}
              {addedNewCombos.length > 0 && (
                <Text style={s.newLbl}>NEW</Text>
              )}
              {addedNewCombos.map(({ size, variant }) => {
                const key = `${size}|${variant}`;
                const checked = checkedCombos[key] !== false;
                return (
                  <View key={`n-${key}`} style={s.comboRow}>
                    <Pressable
                      style={{ width: 22 }}
                      onPress={() => handleComboCheck(size, variant)}
                    >
                      <View style={[s.cb, checked && s.cbOn]}>
                        {checked ? <Text style={s.cbTick}>✓</Text> : null}
                      </View>
                    </Pressable>
                    <Text style={[s.pillPink, { flex: 1 }]} numberOfLines={1}>
                      {variant}
                    </Text>
                    <Text style={[s.pillGrn, { flex: 1 }]} numberOfLines={1}>
                      {size === VARIANT_ONLY_SIZE_KEY ? "—" : size}
                    </Text>
                    <Text style={[s.stk, { width: 36, color: "#9ca3af" }]}>
                      —
                    </Text>
                    <TextInput
                      style={[s.tinyIn, { width: 44 }]}
                      editable={checked}
                      keyboardType="number-pad"
                      value={String(variantQuantities[size]?.[variant] ?? "")}
                      onChangeText={(t) =>
                        handleVariantQuantityChange(size, variant, t)
                      }
                    />
                    <TextInput
                      style={[s.tinyIn, { width: 52 }]}
                      editable={checked}
                      keyboardType="decimal-pad"
                      value={String(
                        stockVariantPrices[size]?.[variant]?.costPrice ?? "",
                      )}
                      onChangeText={(t) =>
                        handleStockVariantPriceChange(
                          size,
                          variant,
                          "costPrice",
                          t,
                        )
                      }
                    />
                    <TextInput
                      style={[s.tinyIn, { width: 52 }]}
                      editable={checked}
                      keyboardType="decimal-pad"
                      value={String(
                        stockVariantPrices[size]?.[variant]?.price ?? "",
                      )}
                      onChangeText={(t) =>
                        handleStockVariantPriceChange(size, variant, "price", t)
                      }
                    />
                  </View>
                );
              })}
            </ScrollView>
            <View style={s.fillRow}>
              <Text style={s.fillLbl}>FILL</Text>
              <TextInput
                style={s.tinyIn}
                placeholder="Qty"
                keyboardType="number-pad"
                value={fillAllQtySI}
                onChangeText={setFillAllQtySI}
              />
              <TextInput
                style={s.tinyIn}
                placeholder="Cost"
                keyboardType="decimal-pad"
                value={fillAllCostSI}
                onChangeText={setFillAllCostSI}
              />
              <TextInput
                style={s.tinyIn}
                placeholder="Sell"
                keyboardType="decimal-pad"
                value={fillAllSellSI}
                onChangeText={setFillAllSellSI}
              />
              <TouchableOpacity onPress={handleFillAllSI}>
                <Text style={s.fillBtn}>Fill All</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.addNewBox}>
            <TouchableOpacity
              style={s.addNewHead}
              onPress={() => setShowAddNewSection(!showAddNewSection)}
            >
              <Text style={s.addNewTitle}>+ add NEW Variants</Text>
              <Text style={s.addNewSub}>
                {showAddNewSection ? "collapse" : "expand"}
              </Text>
            </TouchableOpacity>
            {showAddNewSection && (
              <View style={s.addNewBody}>
                <View style={s.twoCol}>
                  <View style={s.vCard}>
                    <Text style={s.vCardTitle}>VARIANT 1 – Colors</Text>
                    <View style={s.pickerWrap}>
                      <Picker
                        selectedValue={v1PickerKey}
                        onValueChange={(val) => {
                          setV1PickerKey("");
                          if (val && !newV1Tags.includes(val))
                            setNewV1Tags((p) => [...p, val]);
                        }}
                      >
                        <Picker.Item label="Select color..." value="" />
                        {COLOR_OPTIONS.filter((c) => !newV1Tags.includes(c)).map(
                          (c) => (
                            <Picker.Item key={c} label={c} value={c} />
                          ),
                        )}
                      </Picker>
                    </View>
                    <View style={s.tagRow}>
                      {newV1Tags.map((tag) => (
                        <View key={tag} style={s.tagPink}>
                          <Text style={s.tagTxt}>{tag}</Text>
                          <TouchableOpacity
                            onPress={() =>
                              setNewV1Tags((p) => p.filter((t) => t !== tag))
                            }
                          >
                            <Text style={s.tagX}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TextInput
                        style={s.tagInput}
                        value={newV1Input}
                        onChangeText={setNewV1Input}
                        placeholder="Add +"
                        onSubmitEditing={() => {
                          const v = newV1Input.trim();
                          if (v && !newV1Tags.includes(v)) {
                            setNewV1Tags((p) => [...p, v]);
                            setNewV1Input("");
                          }
                        }}
                      />
                    </View>
                  </View>
                  <View style={s.vCard}>
                    <Text style={s.vCardTitle}>
                      VARIANT 2 – Size{" "}
                      <Text style={s.optional}>(optional)</Text>
                    </Text>
                    <View style={s.pickerWrap}>
                      <Picker
                        selectedValue={v2PickerKey}
                        onValueChange={(val) => {
                          setV2PickerKey("");
                          if (val && !newV2Tags.includes(val))
                            setNewV2Tags((p) => [...p, val]);
                        }}
                      >
                        <Picker.Item label="Select size..." value="" />
                        {V2_SIZE_OPTIONS.filter(
                          (sz) => !newV2Tags.includes(sz),
                        ).map((sz) => (
                          <Picker.Item key={sz} label={sz} value={sz} />
                        ))}
                      </Picker>
                    </View>
                    <View style={s.tagRow}>
                      {newV2Tags.map((tag) => (
                        <View key={tag} style={s.tagGrn}>
                          <Text style={s.tagTxtGrn}>{tag}</Text>
                          <TouchableOpacity
                            onPress={() =>
                              setNewV2Tags((p) => p.filter((t) => t !== tag))
                            }
                          >
                            <Text style={s.tagXGrn}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                      <TextInput
                        style={s.tagInput}
                        value={newV2Input}
                        onChangeText={setNewV2Input}
                        placeholder="Add +"
                        onSubmitEditing={() => {
                          const v = newV2Input.trim();
                          if (v && !newV2Tags.includes(v)) {
                            setNewV2Tags((p) => [...p, v]);
                            setNewV2Input("");
                          }
                        }}
                      />
                    </View>
                  </View>
                </View>

                {previewCombosMemo.length > 0 && (
                  <>
                    <Text style={s.previewCount}>
                      {previewCombosMemo.length} COMBINATIONS GENERATED
                    </Text>
                    <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                      {previewCombosMemo.map(({ size, variant }) => {
                        const k = `${size}|${variant}`;
                        return (
                          <View key={k} style={s.previewRow}>
                            <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                              {size !== VARIANT_ONLY_SIZE_KEY && (
                                <Text style={s.pillGrnSm}>{size}</Text>
                              )}
                              {size !== VARIANT_ONLY_SIZE_KEY && (
                                <Text style={s.mul}>×</Text>
                              )}
                              <Text style={s.pillPinkSm}>{variant}</Text>
                            </View>
                            <TextInput
                              style={s.prevIn}
                              keyboardType="decimal-pad"
                              placeholder="Cost"
                              value={newComboData[k]?.cost || ""}
                              onChangeText={(t) =>
                                setNewComboData((p) => ({
                                  ...p,
                                  [k]: { ...(p[k] || {}), cost: t },
                                }))
                              }
                            />
                            <TextInput
                              style={s.prevIn}
                              keyboardType="decimal-pad"
                              placeholder="Sell"
                              value={newComboData[k]?.sell || ""}
                              onChangeText={(t) =>
                                setNewComboData((p) => ({
                                  ...p,
                                  [k]: { ...(p[k] || {}), sell: t },
                                }))
                              }
                            />
                            <TextInput
                              style={s.prevIn}
                              keyboardType="number-pad"
                              placeholder="Qty"
                              value={newComboData[k]?.qty || ""}
                              onChangeText={(t) =>
                                setNewComboData((p) => ({
                                  ...p,
                                  [k]: { ...(p[k] || {}), qty: t },
                                }))
                              }
                            />
                          </View>
                        );
                      })}
                    </ScrollView>
                    <TouchableOpacity
                      style={s.addComboBtn}
                      onPress={handleAddNewCombosFromPicker}
                    >
                      <Text style={s.addComboBtnTxt}>Add</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}
          </View>
        </>
      ) : hasSizes ? (
        <View>
          <Text style={s.muted}>Select sizes to add stock to</Text>
          <View style={s.sizeChecks}>
            {availableSizes.map((size) => {
              const currentQty =
                hasSizes && product.sizes[size]
                  ? getSizeQuantity(product.sizes[size])
                  : 0;
              return (
                <TouchableOpacity
                  key={size}
                  style={s.sizeCheckRow}
                  onPress={() => handleSizeToggle(size)}
                >
                  <View style={[s.cb, selectedSizes.includes(size) && s.cbOn]}>
                    {selectedSizes.includes(size) ? (
                      <Text style={s.cbTick}>✓</Text>
                    ) : null}
                  </View>
                  <Text style={s.sizeCheckTxt}>
                    {size}{" "}
                    <Text style={s.sizeQty}>({currentQty})</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedSizes.length > 0 && (
            <View style={s.qtyBox}>
              <Text style={s.qtyBoxTitle}>Quantity per Size:</Text>
              {selectedSizes.map((size) => (
                <View key={size} style={s.qtyLine}>
                  <Text style={s.qtyLab}>{size}</Text>
                  <TextInput
                    style={s.qtyIn}
                    keyboardType="number-pad"
                    value={String(sizeQuantities[size] ?? "")}
                    onChangeText={(t) => handleSizeQuantityChange(size, t)}
                    placeholder="Qty"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      ) : (
        <View>
          <Text style={s.muted}>
            Current Stock: {product.currentStock || 0}
          </Text>
          <TextInput
            style={s.input}
            keyboardType="number-pad"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Enter quantity to add"
          />
        </View>
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={s.stepBlock}>
      <Text style={s.stepHeading}>ENTRY DETAILS</Text>
      <Text style={s.label}>
        BRAND PARTNER/SUPPLIER <Text style={s.req}>*</Text>
      </Text>
      <View style={s.pickerWrap}>
        <Picker
          selectedValue={stockInBrandPartner}
          onValueChange={setStockInBrandPartner}
        >
          <Picker.Item label="Select Brand Partner" value="" color="#9CA3AF" />
          {brandNameOptions.map((name) => (
            <Picker.Item key={name} label={name} value={name} />
          ))}
        </Picker>
      </View>

      <Text style={s.label}>
        DATE RECEIVED <Text style={s.req}>*</Text>
      </Text>
      <Pressable
        style={s.datePress}
        onPress={() => setShowDateReceivedPicker(true)}
      >
        <Text>{dateReceived || "Select date"}</Text>
      </Pressable>
      {showDateReceivedPicker && (
        <DateTimePicker
          value={
            dateReceived
              ? new Date(dateReceived + "T12:00:00")
              : new Date()
          }
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, d) => {
            if (Platform.OS === "android") setShowDateReceivedPicker(false);
            if (event?.type === "dismissed") {
              setShowDateReceivedPicker(false);
              return;
            }
            if (d) {
              setDateReceived(d.toISOString().slice(0, 10));
            }
            if (Platform.OS === "ios") setShowDateReceivedPicker(false);
          }}
        />
      )}

      <Text style={s.label}>BATCH NUMBER</Text>
      {hasSizes ? (
        <View style={s.pickerWrap}>
          <Picker
            selectedValue={stockInBatchChoice}
            onValueChange={(v) => {
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
                const slot = stockInBatchList.find(
                  (b) => String(b.slotIndex) === v,
                );
                setBatchCode(slot?.code || "");
              }
            }}
          >
            <Picker.Item
              label={`New batch${stockInBatchChoice === "new" && batchCode ? ` (${batchCode})` : ""}`}
              value="new"
            />
            {stockInBatchList.map((b) => (
              <Picker.Item
                key={b.slotIndex}
                label={`Batch ${b.slotIndex + 1}${b.code ? ` (${b.code})` : ""} · ${b.totalQty} pcs`}
                value={String(b.slotIndex)}
              />
            ))}
          </Picker>
        </View>
      ) : (
        <Text style={s.batchBig}>{batchCode || "—"}</Text>
      )}

      <Text style={s.label}>EXPIRING DATE (IF APPLICABLE)</Text>
      <Pressable style={s.datePress} onPress={() => setShowExpiryPicker(true)}>
        <Text>{batchExpirationDate || "Select date"}</Text>
      </Pressable>
      {showExpiryPicker && (
        <DateTimePicker
          value={
            batchExpirationDate
              ? new Date(batchExpirationDate + "T12:00:00")
              : new Date()
          }
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, d) => {
            if (Platform.OS === "android") setShowExpiryPicker(false);
            if (event?.type === "dismissed") {
              setShowExpiryPicker(false);
              return;
            }
            if (d) {
              setBatchExpirationDate(d.toISOString().slice(0, 10));
            }
            if (Platform.OS === "ios") setShowExpiryPicker(false);
          }}
        />
      )}

      <Text style={s.label}>REASON</Text>
      <View style={s.pickerWrap}>
        <Picker
          selectedValue={reason}
          onValueChange={(v) => {
            setReason(v);
            if (v !== "Other") setOtherReason("");
          }}
        >
          {reasons.map((r) => (
            <Picker.Item key={r} label={r} value={r} />
          ))}
        </Picker>
      </View>
      {reason === "Other" && (
        <TextInput
          style={[s.input, { marginTop: 8 }]}
          value={otherReason}
          onChangeText={setOtherReason}
          placeholder="Please specify the reason"
        />
      )}
    </View>
  );

  const renderStep3 = () => {
    const reviewRows = [];
    if (hasSizes && hasVariants) {
      const allCombos = [
        ...existingCombos.map((c) => ({ size: c.size, variant: c.variant })),
        ...addedNewCombos,
      ];
      allCombos.forEach(({ size, variant }) => {
        const key = `${size}|${variant}`;
        if (checkedCombos[key] === false) return;
        const qty = parseInt(variantQuantities[size]?.[variant], 10) || 0;
        if (qty <= 0) return;
        const sizeData = product.sizes?.[size];
        const existingStock =
          typeof sizeData?.variants?.[variant] === "object"
            ? sizeData.variants[variant].quantity || 0
            : typeof sizeData?.variants?.[variant] === "number"
              ? sizeData.variants[variant]
              : 0;
        const cost = stockVariantPrices[size]?.[variant]?.costPrice || 0;
        const sell = stockVariantPrices[size]?.[variant]?.price || 0;
        reviewRows.push({
          variant,
          size,
          stock: existingStock,
          qtyIn: qty,
          cost,
          sell,
        });
      });
    } else if (hasSizes) {
      selectedSizes.forEach((size) => {
        const qty = parseInt(sizeQuantities[size], 10) || 0;
        if (qty <= 0) return;
        const sizeData = product.sizes?.[size];
        const existingStock = sizeData?.quantity || 0;
        reviewRows.push({
          variant: null,
          size,
          stock: existingStock,
          qtyIn: qty,
          cost: 0,
          sell: 0,
        });
      });
    } else {
      const qty = parseInt(quantity, 10) || 0;
      if (qty > 0)
        reviewRows.push({
          variant: null,
          size: null,
          stock: product.currentStock || 0,
          qtyIn: qty,
          cost: 0,
          sell: 0,
        });
    }

    return (
      <View style={s.stepBlock}>
        <Text style={s.stepHeading}>REVIEW BEFORE SAVING</Text>
        <Text style={s.stepSub}>
          Double-check everything. Inventory updates immediately.
        </Text>
        <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled>
          {reviewRows.length === 0 ? (
            <Text style={s.emptyReview}>No items to review</Text>
          ) : (
            reviewRows.map((row, i) => (
              <View key={i} style={s.reviewRow}>
                {hasVariants && (
                  <Text style={s.reviewMain}>
                    {row.variant}
                    {row.size && row.size !== VARIANT_ONLY_SIZE_KEY
                      ? ` × ${row.size}`
                      : ""}
                  </Text>
                )}
                {!hasVariants && row.size && (
                  <Text style={s.reviewMain}>{row.size}</Text>
                )}
                {!hasVariants && !row.size && (
                  <Text style={s.reviewMain}>Qty add</Text>
                )}
                <Text style={s.reviewMeta}>
                  Stock {row.stock} → +{row.qtyIn}
                  {(hasVariants || row.cost > 0 || row.sell > 0) &&
                    ` · ₱${Number(row.cost).toFixed(2)} / ₱${Number(row.sell).toFixed(2)}`}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <View style={s.headerIconWrap}>
                <Ionicons name="cube-outline" size={18} color="#111" />
                <View style={s.headerBadge}>
                  <Text style={s.headerBadgeTxt}>+</Text>
                </View>
              </View>
              <Text style={s.title}>Stock In</Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Text style={s.close}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={s.stepper}>
            {[
              { id: 1, label: "Add Items" },
              { id: 2, label: "Details" },
              { id: 3, label: "Review" },
            ].map((st, idx) => (
              <Fragment key={st.id}>
                <View style={s.stepColumn}>
                  <View
                    style={[
                      s.stepCircle,
                      currentStep >= st.id && s.stepCircleOn,
                    ]}
                  >
                    <Text
                      style={[
                        s.stepNum,
                        currentStep >= st.id && s.stepNumOn,
                      ]}
                    >
                      {currentStep > st.id ? "✓" : st.id}
                    </Text>
                  </View>
                  <Text
                    style={[
                      s.stepLab,
                      currentStep >= st.id && s.stepLabOn,
                    ]}
                    numberOfLines={2}
                  >
                    {st.label}
                  </Text>
                </View>
                {idx < 2 && (
                  <View style={s.stepLineWrap}>
                    <View
                      style={[
                        s.stepLine,
                        currentStep > st.id && s.stepLineOn,
                      ]}
                    />
                  </View>
                )}
              </Fragment>
            ))}
          </View>

          <ScrollView
            style={s.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={s.productLine} numberOfLines={2}>
              {displayName}
            </Text>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity
              style={s.btnCancel}
              onPress={
                currentStep === 1 ? handleClose : () => setCurrentStep((p) => p - 1)
              }
            >
              <Text style={s.btnCancelTxt}>
                {currentStep === 1 ? "Cancel" : "← Back"}
              </Text>
            </TouchableOpacity>
            {currentStep < 3 ? (
              <TouchableOpacity
                style={[
                  s.btnGo,
                  !isStepValid(currentStep) && s.btnDisabled,
                ]}
                disabled={!isStepValid(currentStep)}
                onPress={() => {
                  if (isStepValid(currentStep))
                    setCurrentStep((p) => p + 1);
                }}
              >
                <Text style={s.btnGoTxt}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[s.btnGo, loading && s.btnDisabled]}
                disabled={loading}
                onPress={handleSubmit}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.btnGoTxt}>Stock In</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    maxHeight: "92%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconWrap: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#09A046",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBadgeTxt: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    marginTop: -1,
  },
  title: { fontSize: 17, fontWeight: "700" },
  close: { fontSize: 26, color: "#9ca3af", fontWeight: "300" },
  stepper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  stepColumn: {
    alignItems: "center",
    width: 80,
    paddingHorizontal: 4,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleOn: {
    backgroundColor: "#09A046",
    borderColor: "#09A046",
  },
  stepNum: { fontSize: 12, fontWeight: "700", color: "#9ca3af" },
  stepNumOn: { color: "#fff" },
  stepLab: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 8,
    color: "#9ca3af",
    textAlign: "center",
    width: "100%",
  },
  stepLabOn: { color: "#09A046", fontWeight: "600" },
  stepLineWrap: {
    width: 28,
    minHeight: 32,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 0,
  },
  stepLine: {
    width: "100%",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#e5e7eb",
  },
  stepLineOn: { backgroundColor: "#09A046" },
  body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, maxHeight: 440 },
  productLine: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  stepBlock: { paddingBottom: 12 },
  stepHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepSub: { fontSize: 11, color: "#9ca3af", marginBottom: 10 },
  muted: { fontSize: 11, color: "#6b7280", marginBottom: 8 },
  tableBorder: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  comboHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 4,
  },
  comboH: { fontSize: 8, fontWeight: "700", color: "#6b7280" },
  comboRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 4,
  },
  cb: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  cbOn: { backgroundColor: "#09A046", borderColor: "#09A046" },
  cbTick: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pillPink: {
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "#fce7f3",
    color: "#9d174d",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  pillGrn: {
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  stk: { fontSize: 11, fontWeight: "700", color: "#09A046", textAlign: "center" },
  tinyIn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    fontSize: 11,
    minHeight: 28,
  },
  fillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#fafafa",
  },
  fillLbl: {
    fontSize: 9,
    fontWeight: "700",
    color: "#09A046",
    marginRight: 4,
  },
  fillBtn: { fontSize: 11, fontWeight: "700", color: "#09A046" },
  newLbl: {
    fontSize: 11,
    fontWeight: "700",
    color: "#09A046",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addNewBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#6ee7b7",
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  addNewHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
  },
  addNewTitle: { fontSize: 13, fontWeight: "700", color: "#09A046" },
  addNewSub: { fontSize: 11, color: "#09A046" },
  addNewBody: { paddingHorizontal: 10, paddingBottom: 10 },
  twoCol: { gap: 10 },
  vCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  vCardTitle: { fontSize: 11, fontWeight: "700", marginBottom: 6 },
  optional: { fontWeight: "400", color: "#9ca3af" },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  tagPink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fce7f3",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagTxt: { fontSize: 11, color: "#9d174d", fontWeight: "600" },
  tagX: { fontSize: 14, color: "#831843" },
  tagGrn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  tagTxtGrn: { fontSize: 11, color: "#065f46", fontWeight: "600" },
  tagXGrn: { fontSize: 14, color: "#064e3b" },
  tagInput: {
    minWidth: 48,
    fontSize: 11,
    borderBottomWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 2,
  },
  previewCount: {
    fontSize: 10,
    fontWeight: "600",
    color: "#6b7280",
    marginVertical: 6,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pillGrnSm: {
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillPinkSm: {
    fontSize: 10,
    fontWeight: "600",
    backgroundColor: "#fce7f3",
    color: "#9d174d",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  mul: { fontSize: 10, color: "#9ca3af" },
  prevIn: {
    width: 56,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 4,
    fontSize: 10,
  },
  addComboBtn: {
    backgroundColor: "#09A046",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  addComboBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sizeChecks: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sizeCheckRow: { flexDirection: "row", alignItems: "center", gap: 8, width: "48%" },
  sizeCheckTxt: { fontSize: 13, color: "#111" },
  sizeQty: { fontSize: 11, color: "#6b7280" },
  qtyBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
  },
  qtyBoxTitle: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  qtyLine: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 10 },
  qtyLab: { width: 40, fontSize: 13 },
  qtyIn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.4,
  },
  req: { color: "#ef4444" },
  datePress: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
  },
  batchBig: { fontSize: 16, fontWeight: "700", marginVertical: 6 },
  emptyReview: {
    textAlign: "center",
    color: "#9ca3af",
    fontStyle: "italic",
    padding: 20,
    fontSize: 12,
  },
  reviewRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  reviewMain: { fontSize: 13, fontWeight: "600", color: "#111" },
  reviewMeta: { fontSize: 11, color: "#6b7280", marginTop: 4 },
  footer: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
  },
  btnCancelTxt: { fontSize: 14, fontWeight: "600", color: "#4b5563" },
  btnGo: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#09A046",
    alignItems: "center",
  },
  btnGoTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },
  btnDisabled: { opacity: 0.45 },
});

export default StockInModal;
