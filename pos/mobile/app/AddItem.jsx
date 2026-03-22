import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as ExpoFileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AddBrandModal from "../components/AddBrandModal";
import AddCategoryModal from "../components/AddCategoryModal";
import {
  COMMON_COLORS,
  VARIANT_ONLY_KEY,
  UNIT_OPTIONS,
  buildCreateProductPayload,
  buildEditProductPayload,
  generateSKU,
  getCustomSubCategories,
  getSizeOptions,
  getSubcategories,
  inferParentSubFromProduct,
  needsConfirmModal,
  parentCategories,
} from "../constants/addProductWebParity";
import { brandPartnerAPI, categoryAPI, productAPI } from "../services/api";

const ADD_PRODUCT_DRAFT_KEY = "addProductFormDraftMobile";

const STEPS = [
  { id: 1, label: "Basic Info" },
  { id: 2, label: "Variants" },
  { id: 3, label: "Stock and Price" },
  { id: 4, label: "Batch" },
  { id: 5, label: "Review" },
];

const defaultForm = () => ({
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
  batchNumber: "",
});

async function convertImageToBase64(uri) {
  try {
    if (!uri) return "";
    if (uri.startsWith("data:image")) return uri;
    const manipulatedResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );
    if (
      !ExpoFileSystem ||
      typeof ExpoFileSystem.readAsStringAsync !== "function"
    ) {
      return uri;
    }
    const encodingOptions = ExpoFileSystem.EncodingType
      ? { encoding: ExpoFileSystem.EncodingType.Base64 }
      : { encoding: "base64" };
    const base64 = await ExpoFileSystem.readAsStringAsync(
      manipulatedResult.uri,
      encodingOptions
    );
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error("Error converting image:", error);
    return uri || "";
  }
}

function buildEditableSizePricesFromProduct(item) {
  if (!item?.sizes || typeof item.sizes !== "object") return {};
  const sizePrices = {};
  Object.entries(item.sizes).forEach(([size, sizeData]) => {
    if (typeof sizeData === "object" && sizeData !== null) {
      if (sizeData.variants && typeof sizeData.variants === "object") {
        sizePrices[size] = {
          hasVariants: true,
          basePrice: sizeData.price || item.itemPrice || 0,
          baseCostPrice: sizeData.costPrice || item.costPrice || 0,
          variants: {},
        };
        Object.entries(sizeData.variants).forEach(([variant, variantData]) => {
          if (typeof variantData === "object" && variantData !== null) {
            sizePrices[size].variants[variant] = {
              price:
                variantData.price ||
                sizeData.variantPrices?.[variant] ||
                sizeData.price ||
                item.itemPrice ||
                0,
              costPrice:
                variantData.costPrice ||
                sizeData.variantCostPrices?.[variant] ||
                sizeData.costPrice ||
                item.costPrice ||
                0,
              quantity: variantData.quantity || 0,
            };
          } else {
            sizePrices[size].variants[variant] = {
              price:
                sizeData.variantPrices?.[variant] ||
                sizeData.price ||
                item.itemPrice ||
                0,
              costPrice:
                sizeData.variantCostPrices?.[variant] ||
                sizeData.costPrice ||
                item.costPrice ||
                0,
              quantity: typeof variantData === "number" ? variantData : 0,
            };
          }
        });
      } else {
        sizePrices[size] = {
          hasVariants: false,
          price: sizeData.price || item.itemPrice || 0,
          costPrice: sizeData.costPrice || item.costPrice || 0,
          quantity: sizeData.quantity || 0,
        };
      }
    } else if (typeof sizeData === "number") {
      sizePrices[size] = {
        hasVariants: false,
        price: item.itemPrice || 0,
        costPrice: item.costPrice || 0,
        quantity: sizeData,
      };
    }
  });
  return sizePrices;
}

export default function AddItem({ onBack, item, isEditing = false }) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [currentStep, setCurrentStep] = useState(1);
  const [productImageUris, setProductImageUris] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState([]);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [customSizes, setCustomSizes] = useState([]);
  const [customColorInput, setCustomColorInput] = useState("");
  const [customSizeValue, setCustomSizeValue] = useState("");
  const [optionGroup1Name, setOptionGroup1Name] = useState("Color");
  const [optionGroup2Name, setOptionGroup2Name] = useState("Size");
  const [variantQuantities, setVariantQuantities] = useState({});
  const [variantPrices, setVariantPrices] = useState({});
  const [variantCostPrices, setVariantCostPrices] = useState({});
  const [fillAllCost, setFillAllCost] = useState("");
  const [fillAllPrice, setFillAllPrice] = useState("");
  const [fillAllQty, setFillAllQty] = useState("");
  const [reviewImgIdx, setReviewImgIdx] = useState(0);
  const [apiCategoryNames, setApiCategoryNames] = useState([]);
  const [brandsList, setBrandsList] = useState([]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [categoryModalForSub, setCategoryModalForSub] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [editableSizePrices, setEditableSizePrices] = useState({});
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  const toastTranslate = useRef(new Animated.Value(-60)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const customSubCategories = useMemo(
    () => getCustomSubCategories(apiCategoryNames),
    [apiCategoryNames]
  );

  const subcategoryOptions = useMemo(
    () =>
      getSubcategories(
        form.category,
        customSubCategories,
        form.subCategory,
        form.category
      ),
    [form.category, form.subCategory, customSubCategories]
  );

  const partnerNames = useMemo(() => {
    const names = Array.from(
      new Set(brandsList.map((b) => b.brandName).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    return names;
  }, [brandsList]);

  const legacyBrandSelected =
    form.brandName &&
    form.brandName !== "Default" &&
    !partnerNames.includes(form.brandName);

  const variantStr = useMemo(
    () => selectedVariants.filter(Boolean).join(", "),
    [selectedVariants]
  );

  const hasVariants =
    selectedVariants.length > 0 || (form.selectedSizes?.length > 0);

  const sizeOptions = useMemo(
    () => getSizeOptions(form.category, form.subCategory, customSizes),
    [form.category, form.subCategory, customSizes]
  );

  const combos = useMemo(() => {
    const list = [];
    const variants = selectedVariants.length > 0 ? selectedVariants : [null];
    const sizes =
      form.selectedSizes?.length > 0
        ? form.selectedSizes
        : [VARIANT_ONLY_KEY];
    variants.forEach((v) => {
      sizes.forEach((s) => {
        list.push({
          variant: v,
          size: s,
          key: `${v || ""}-${s || ""}`,
        });
      });
    });
    return list;
  }, [selectedVariants, form.selectedSizes]);

  const hasAnyCombos =
    hasVariants &&
    combos.length > 0 &&
    (combos[0].variant != null || combos[0].size != null);

  const generatedBatchNumber = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `B${y}${m} – 001`;
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        categoryAPI.getAll(),
        brandPartnerAPI.getAll(),
      ]);
      if (catRes.success && Array.isArray(catRes.data)) {
        setApiCategoryNames(
          catRes.data
            .filter((c) => c.status === "active" && c.name !== "Others")
            .map((c) => c.name)
        );
      }
      if (brandRes.success && brandRes.data) {
        setBrandsList(brandRes.data);
      }
    } catch (e) {
      console.error("fetchMeta", e);
    }
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  useEffect(() => {
    if (isEditing) return;
    setForm((f) => ({
      ...f,
      variant: variantStr,
      sku: generateSKU(f.category, f.subCategory, variantStr),
    }));
  }, [isEditing, form.category, form.subCategory, variantStr]);

  useEffect(() => {
    if (isEditing && item) {
      const { category, subCategory } = inferParentSubFromProduct(item);
      setForm({
        ...defaultForm(),
        sku: item.sku || "",
        itemName: item.itemName || item.name || "",
        category,
        subCategory,
        unitOfMeasure: item.unitOfMeasure || "pcs",
        brandName: item.brandName || item.brand || "Default",
        variant: item.variant || "",
        size: item.size || "",
        itemPrice:
          item.itemPrice !== undefined
            ? String(item.itemPrice)
            : item.price != null
              ? String(item.price)
              : "",
        costPrice:
          item.costPrice !== undefined ? String(item.costPrice) : "",
        currentStock:
          item.currentStock !== undefined
            ? String(item.currentStock)
            : item.stock != null
              ? String(item.stock)
              : "",
        reorderNumber:
          item.reorderNumber !== undefined ? String(item.reorderNumber) : "",
        supplierName: item.supplierName || "",
        supplierContact: item.supplierContact || "",
        itemImage: item.itemImage || item.image || "",
        foodSubtype: item.foodSubtype || "",
        displayInTerminal:
          item.displayInTerminal !== undefined
            ? item.displayInTerminal
            : true,
        expirationDate: item.expirationDate
          ? new Date(item.expirationDate).toISOString().slice(0, 10)
          : "",
        batchNumber: item.batchNumber || "",
        selectedSizes: [],
        sizeQuantities: {},
        sizePrices: {},
        sizeCostPrices: {},
      });
      if (item.variant) {
        setSelectedVariants(
          item.variant.split(", ").map((v) => v.trim()).filter(Boolean)
        );
      } else {
        setSelectedVariants([]);
      }
      const imgs =
        Array.isArray(item.productImages) && item.productImages.length > 0
          ? item.productImages.filter(Boolean)
          : item.itemImage
            ? [item.itemImage]
            : [];
      setProductImageUris(imgs);
      setEditableSizePrices(buildEditableSizePricesFromProduct(item));
      return;
    }

    if (!isEditing) {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(ADD_PRODUCT_DRAFT_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.form) setForm((f) => ({ ...f, ...parsed.form }));
            if (parsed.selectedVariants)
              setSelectedVariants(parsed.selectedVariants);
            if (parsed.variantQuantities)
              setVariantQuantities(parsed.variantQuantities);
            if (parsed.variantPrices) setVariantPrices(parsed.variantPrices);
            if (parsed.variantCostPrices)
              setVariantCostPrices(parsed.variantCostPrices);
            if (parsed.productImageUris)
              setProductImageUris(parsed.productImageUris);
            if (parsed.customSizes) setCustomSizes(parsed.customSizes);
            if (parsed.currentStep) setCurrentStep(parsed.currentStep);
          }
        } catch (e) {
          console.error("draft load", e);
        }
      })();
    }
  }, [isEditing, item]);

  useEffect(() => {
    if (isEditing || !form.itemName) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(
        ADD_PRODUCT_DRAFT_KEY,
        JSON.stringify({
          form,
          selectedVariants,
          variantQuantities,
          variantPrices,
          variantCostPrices,
          productImageUris,
          customSizes,
          currentStep,
        })
      ).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [
    form,
    selectedVariants,
    variantQuantities,
    variantPrices,
    variantCostPrices,
    productImageUris,
    customSizes,
    currentStep,
    isEditing,
  ]);

  useEffect(() => {
    if (!showSuccess) {
      Animated.parallel([
        Animated.timing(toastTranslate, {
          toValue: -60,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    Animated.parallel([
      Animated.timing(toastTranslate, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
    const timer = setTimeout(() => setShowSuccess(false), 2000);
    return () => clearTimeout(timer);
  }, [showSuccess, toastTranslate, toastOpacity]);

  const handleBack = () => {
    if (isEditing) {
      if (typeof onBack === "function") onBack();
      else router.back();
      return;
    }
    const dirty =
      !!form.itemName ||
      !!form.category ||
      selectedVariants.length > 0 ||
      productImageUris.length > 0;
    if (dirty) setShowDiscardModal(true);
    else if (typeof onBack === "function") onBack();
    else router.back();
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [form.itemName, form.category, selectedVariants.length, productImageUris.length, isEditing]);

  const handleSizeToggle = (size) => {
    setForm((prev) => {
      const isSelected = prev.selectedSizes.includes(size);
      const newSelectedSizes = isSelected
        ? prev.selectedSizes.filter((s) => s !== size)
        : [...prev.selectedSizes, size];
      const newSizeQuantities = { ...prev.sizeQuantities };
      const newSizePrices = { ...prev.sizePrices };
      const newSizeCostPrices = { ...prev.sizeCostPrices };
      if (isSelected) {
        delete newSizeQuantities[size];
        delete newSizePrices[size];
        delete newSizeCostPrices[size];
      } else {
        newSizeQuantities[size] = 0;
        if (prev.differentPricesPerSize) {
          newSizePrices[size] = prev.itemPrice || "";
          newSizeCostPrices[size] = prev.costPrice || "";
        }
      }
      return {
        ...prev,
        selectedSizes: newSelectedSizes,
        sizeQuantities: newSizeQuantities,
        sizePrices: newSizePrices,
        sizeCostPrices: newSizeCostPrices,
      };
    });
  };

  const setSizeQty = (size, qty) => {
    const n = parseInt(qty, 10) || 0;
    setForm((p) => ({
      ...p,
      sizeQuantities: { ...p.sizeQuantities, [size]: n },
    }));
  };

  const setSizePrice = (size, price) => {
    setForm((p) => ({
      ...p,
      sizePrices: { ...p.sizePrices, [size]: price },
    }));
  };

  const setSizeCost = (size, cost) => {
    setForm((p) => ({
      ...p,
      sizeCostPrices: { ...p.sizeCostPrices, [size]: cost },
    }));
  };

  const setVariantQty = (size, variant, qty) => {
    const n = parseInt(qty, 10) || 0;
    setVariantQuantities((prev) => ({
      ...prev,
      [size]: { ...(prev[size] || {}), [variant]: n },
    }));
  };

  const setVPrice = (size, variant, price) => {
    const v = parseFloat(price) || 0;
    setVariantPrices((prev) => ({
      ...prev,
      [size]: { ...(prev[size] || {}), [variant]: v },
    }));
  };

  const setVCost = (size, variant, price) => {
    const v = parseFloat(price) || 0;
    setVariantCostPrices((prev) => ({
      ...prev,
      [size]: { ...(prev[size] || {}), [variant]: v },
    }));
  };

  const handleFillAll = () => {
    if (!hasAnyCombos) return;
    combos.forEach(({ variant: v, size: s }) => {
      if (v && s) {
        if (fillAllCost) setVCost(s, v, fillAllCost);
        if (fillAllPrice) setVPrice(s, v, fillAllPrice);
        if (fillAllQty) setVariantQty(s, v, fillAllQty);
      } else if (s && !v) {
        if (fillAllCost) setSizeCost(s, fillAllCost);
        if (fillAllPrice) setSizePrice(s, fillAllPrice);
        if (fillAllQty) setSizeQty(s, fillAllQty);
      } else if (v && !s) {
        if (fillAllCost)
          setForm((p) => ({ ...p, costPrice: fillAllCost }));
        if (fillAllPrice)
          setForm((p) => ({ ...p, itemPrice: fillAllPrice }));
        if (fillAllQty)
          setForm((p) => ({ ...p, currentStock: fillAllQty }));
      }
    });
  };

  const isStepValid = (step) => {
    if (isEditing) return true;
    switch (step) {
      case 1:
        if (!form.itemName?.trim()) return false;
        if (!form.category) return false;
        if (!form.subCategory || form.subCategory === "__add_new__")
          return false;
        if (!form.brandName) return false;
        if (!form.unitOfMeasure) return false;
        return true;
      case 2:
        return selectedVariants.length > 0;
      case 3:
        if (hasVariants) return true;
        if (!form.itemPrice || parseFloat(form.itemPrice) <= 0) return false;
        if (!form.costPrice || parseFloat(form.costPrice) <= 0) return false;
        if (!form.currentStock || parseInt(form.currentStock, 10) <= 0)
          return false;
        return true;
      case 4:
        return true;
      default:
        return true;
    }
  };

  const validatePreConfirm = (np) => {
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
    if (!hasSizeQuantities && !hasVariantQuantities && !hasStock) {
      Alert.alert(
        "Validation",
        "Please either select sizes with quantities or provide a stock value."
      );
      return false;
    }
    if (needsConfirmModal(np)) {
      return true;
    }
    if (
      np.differentPricesPerSize &&
      np.selectedSizes?.length > 0
    ) {
      const invalidSizes = np.selectedSizes.filter((size) => {
        const price = np.sizePrices?.[size];
        return !price || price === "" || parseFloat(price) <= 0;
      });
      if (invalidSizes.length > 0) {
        Alert.alert(
          "Validation",
          `Please enter prices for all selected sizes: ${invalidSizes.join(", ")}`
        );
        return false;
      }
    } else if (!np.differentPricesPerSize) {
      if (!np.itemPrice || parseFloat(np.itemPrice) <= 0) {
        Alert.alert("Validation", "Please enter a selling price.");
        return false;
      }
    }
    return true;
  };

  const mergeSubmitProduct = async () => {
    const images = [];
    for (const uri of productImageUris) {
      if (uri.startsWith("http") || uri.startsWith("data:")) {
        images.push(uri);
      } else {
        images.push(await convertImageToBase64(uri));
      }
    }
    const np = {
      ...form,
      variant: variantStr,
      foodSubtype: form.category === "Foods" ? form.subCategory || "" : "",
      variantQuantities,
      variantPrices,
      variantCostPrices,
      differentPricesPerVariant: {},
      productImages: images,
      itemImage: images[0] || "",
      batchNumber: generatedBatchNumber,
      optionGroup1Name: optionGroup1Name || "Color",
      ...(form.selectedSizes?.length > 0
        ? { optionGroup2Name: optionGroup2Name || "Size" }
        : {}),
    };
    return np;
  };

  const runCreateOrUpdate = async () => {
    setIsLoading(true);
    try {
      const np = await mergeSubmitProduct();
      if (isEditing && (item?._id || item?.id)) {
        const editPayload = buildEditProductPayload(
          { ...np, editableSizePrices },
          item
        );
        delete editPayload.isForPOS;
        const res = await productAPI.update(item._id || item.id, editPayload);
        if (!res.success) throw new Error(res.message || "Update failed");
        setSuccessMessage("Item updated successfully!");
        setShowSuccess(true);
        setTimeout(() => {
          AsyncStorage.removeItem(ADD_PRODUCT_DRAFT_KEY).catch(() => {});
          if (typeof onBack === "function") onBack();
          else router.back();
        }, 2200);
        return;
      }

      const payload = buildCreateProductPayload(np, false);
      delete payload.isForPOS;
      const res = await productAPI.create(payload);
      if (!res.success) throw new Error(res.message || "Create failed");
      setSuccessMessage("Item added successfully!");
      setShowSuccess(true);
      await AsyncStorage.removeItem(ADD_PRODUCT_DRAFT_KEY);
      setTimeout(() => {
        if (typeof onBack === "function") onBack();
        else router.back();
      }, 2200);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to save");
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
    }
  };

  const onPressSubmit = async () => {
    if (isLoading) return;
    const np = await mergeSubmitProduct();
    if (!validatePreConfirm(np)) return;

    if (needsConfirmModal(np)) {
      setShowConfirmModal(true);
      return;
    }
    await runCreateOrUpdate();
  };

  const pickImage = async () => {
    const { status } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission", "Photo library access is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length) {
      setProductImageUris((prev) => [
        ...prev,
        ...result.assets.map((a) => a.uri),
      ]);
    }
  };

  const removeImageAt = (index) => {
    setProductImageUris((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleVariant = (color) => {
    setSelectedVariants((prev) =>
      prev.includes(color) ? prev.filter((x) => x !== color) : [...prev, color]
    );
  };

  const addCustomColor = () => {
    const t = customColorInput.trim();
    if (t && !selectedVariants.includes(t)) {
      setSelectedVariants((p) => [...p, t]);
      setCustomColorInput("");
    }
  };

  const totalReviewStock = useMemo(() => {
    if (!hasAnyCombos) return parseInt(form.currentStock, 10) || 0;
    let t = 0;
    combos.forEach(({ variant: v, size: s }) => {
      if (v && s) {
        t += parseInt(variantQuantities[s]?.[v], 10) || 0;
      } else if (s) {
        t += parseInt(form.sizeQuantities[s], 10) || 0;
      } else {
        t += parseInt(form.currentStock, 10) || 0;
      }
    });
    return t;
  }, [
    hasAnyCombos,
    combos,
    variantQuantities,
    form.sizeQuantities,
    form.currentStock,
  ]);

  const renderEditMode = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.sectionTitle}>Edit Product</Text>
      <Text style={styles.label}>Product Name *</Text>
      <TextInput
        style={styles.input}
        value={form.itemName}
        onChangeText={(t) => setForm((f) => ({ ...f, itemName: t }))}
      />
      <Text style={styles.label}>Category *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={form.category}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, category: v, subCategory: "" }))
          }
        >
          <Picker.Item label="Select category" value="" />
          {parentCategories.map((c) => (
            <Picker.Item key={c} label={c} value={c} />
          ))}
        </Picker>
      </View>
      <Text style={styles.label}>Subcategory *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={form.subCategory}
          enabled={!!form.category}
          onValueChange={(v) => {
            if (v === "__add_new__") {
              setCategoryModalForSub(true);
              setShowAddCategoryModal(true);
              return;
            }
            setForm((f) => ({ ...f, subCategory: v }));
          }}
        >
          <Picker.Item label="Select subcategory" value="" />
          {subcategoryOptions.map((s) => (
            <Picker.Item key={s} label={s} value={s} />
          ))}
          <Picker.Item label="+ Add Subcategory" value="__add_new__" />
        </Picker>
      </View>
      <Text style={styles.label}>Brand Partner *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={form.brandName}
          onValueChange={(v) => {
            if (v === "__add_new__") {
              setShowAddBrandModal(true);
              return;
            }
            setForm((f) => ({ ...f, brandName: v }));
          }}
        >
          <Picker.Item label="Default" value="Default" />
          {partnerNames.map((n) => (
            <Picker.Item key={n} label={n} value={n} />
          ))}
          <Picker.Item label="+ Add Brand" value="__add_new__" />
          {legacyBrandSelected && (
            <Picker.Item
              label={`${form.brandName} (Inactive)`}
              value={form.brandName}
            />
          )}
        </Picker>
      </View>
      <Text style={styles.label}>Unit of measure *</Text>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={form.unitOfMeasure}
          onValueChange={(v) => setForm((f) => ({ ...f, unitOfMeasure: v }))}
        >
          {UNIT_OPTIONS.map((u) => (
            <Picker.Item key={u.value} label={u.label} value={u.value} />
          ))}
        </Picker>
      </View>
      <Text style={styles.label}>Cost / Selling (simple product)</Text>
      <View style={styles.row2}>
        <TextInput
          style={[styles.input, styles.flex1]}
          keyboardType="decimal-pad"
          placeholder="Cost"
          value={String(form.costPrice)}
          onChangeText={(t) => setForm((f) => ({ ...f, costPrice: t }))}
        />
        <TextInput
          style={[styles.input, styles.flex1]}
          keyboardType="decimal-pad"
          placeholder="Selling"
          value={String(form.itemPrice)}
          onChangeText={(t) => setForm((f) => ({ ...f, itemPrice: t }))}
        />
      </View>
      <View style={styles.switchRow}>
        <Text>Display in Terminal</Text>
        <Switch
          value={form.displayInTerminal !== false}
          onValueChange={(v) => setForm((f) => ({ ...f, displayInTerminal: v }))}
        />
      </View>
      {Object.keys(editableSizePrices).length > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Size & variant prices</Text>
          {Object.entries(editableSizePrices).map(([size, sd]) => (
            <View key={size} style={styles.card}>
              <Text style={styles.bold}>{size}</Text>
              {sd.hasVariants
                ? Object.entries(sd.variants || {}).map(([vr, vd]) => (
                    <View key={vr} style={styles.row2}>
                      <Text style={styles.flex1}>{vr}</Text>
                      <TextInput
                        style={[styles.input, styles.flex1]}
                        keyboardType="decimal-pad"
                        value={String(vd.costPrice ?? "")}
                        onChangeText={(t) =>
                          setEditableSizePrices((p) => ({
                            ...p,
                            [size]: {
                              ...p[size],
                              variants: {
                                ...p[size].variants,
                                [vr]: { ...p[size].variants[vr], costPrice: t },
                              },
                            },
                          }))
                        }
                      />
                      <TextInput
                        style={[styles.input, styles.flex1]}
                        keyboardType="decimal-pad"
                        value={String(vd.price ?? "")}
                        onChangeText={(t) =>
                          setEditableSizePrices((p) => ({
                            ...p,
                            [size]: {
                              ...p[size],
                              variants: {
                                ...p[size].variants,
                                [vr]: { ...p[size].variants[vr], price: t },
                              },
                            },
                          }))
                        }
                      />
                    </View>
                  ))
                : (
                    <View style={styles.row2}>
                      <TextInput
                        style={[styles.input, styles.flex1]}
                        keyboardType="decimal-pad"
                        placeholder="Cost"
                        value={String(sd.costPrice ?? "")}
                        onChangeText={(t) =>
                          setEditableSizePrices((p) => ({
                            ...p,
                            [size]: { ...p[size], costPrice: t },
                          }))
                        }
                      />
                      <TextInput
                        style={[styles.input, styles.flex1]}
                        keyboardType="decimal-pad"
                        placeholder="Price"
                        value={String(sd.price ?? "")}
                        onChangeText={(t) =>
                          setEditableSizePrices((p) => ({
                            ...p,
                            [size]: { ...p[size], price: t },
                          }))
                        }
                      />
                    </View>
                  )}
            </View>
          ))}
        </View>
      )}
      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={onPressSubmit}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>Update Product</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <View>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Product name"
            value={form.itemName}
            onChangeText={(t) => setForm((f) => ({ ...f, itemName: t }))}
          />
          <Text style={styles.label}>Category *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.category}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, category: v, subCategory: "" }))
              }
            >
              <Picker.Item label="Select category" value="" />
              {parentCategories.map((c) => (
                <Picker.Item key={c} label={c} value={c} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Subcategory *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.subCategory}
              enabled={!!form.category}
              onValueChange={(v) => {
                if (v === "__add_new__") {
                  setCategoryModalForSub(true);
                  setShowAddCategoryModal(true);
                  return;
                }
                setForm((f) => ({ ...f, subCategory: v }));
                setSelectedVariants([]);
                setVariantQuantities({});
                setVariantPrices({});
                setVariantCostPrices({});
              }}
            >
              <Picker.Item label="Select subcategory" value="" />
              {subcategoryOptions.map((s) => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
              <Picker.Item label="+ Add Subcategory" value="__add_new__" />
            </Picker>
          </View>
          <Text style={styles.label}>Brand Partner *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.brandName}
              onValueChange={(v) => {
                if (v === "__add_new__") {
                  setShowAddBrandModal(true);
                  return;
                }
                setForm((f) => ({ ...f, brandName: v }));
              }}
            >
              <Picker.Item label="Default" value="Default" />
              {partnerNames.map((n) => (
                <Picker.Item key={n} label={n} value={n} />
              ))}
              <Picker.Item label="+ Add Brand" value="__add_new__" />
              {legacyBrandSelected && (
                <Picker.Item
                  label={`${form.brandName} (Inactive)`}
                  value={form.brandName}
                />
              )}
            </Picker>
          </View>
          <Text style={styles.label}>Unit of measure *</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={form.unitOfMeasure}
              onValueChange={(v) => setForm((f) => ({ ...f, unitOfMeasure: v }))}
            >
              <Picker.Item label="Select unit" value="" />
              {UNIT_OPTIONS.map((u) => (
                <Picker.Item key={u.value} label={u.label} value={u.value} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Product images</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={styles.addImgBox} onPress={pickImage}>
              <Ionicons name="add" size={28} color="#6b7280" />
            </TouchableOpacity>
            {productImageUris.map((uri, i) => (
              <View key={i} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                {i === 0 && (
                  <View style={styles.mainBadge}>
                    <Text style={styles.mainBadgeText}>Main</Text>
                  </View>
                )}
                <Pressable
                  style={styles.thumbRemove}
                  onPress={() => removeImageAt(i)}
                >
                  <Text style={{ color: "#fff" }}>×</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {productImageUris.length > 3 && (
            <Text style={styles.warn}>
              Adding more than 3 photos may slow down the system.
            </Text>
          )}
        </View>
      );
    }
    if (currentStep === 2) {
      return (
        <View>
          <Text style={styles.sectionTitle}>Option group 1 – required</Text>
          <TextInput
            style={styles.input}
            value={optionGroup1Name}
            onChangeText={setOptionGroup1Name}
            placeholder="e.g. Color"
          />
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowVariantDropdown(!showVariantDropdown)}
          >
            <Text>
              {selectedVariants.length === 0
                ? `Select ${optionGroup1Name.toLowerCase()}…`
                : `${selectedVariants.length} selected`}
            </Text>
            <Ionicons
              name={showVariantDropdown ? "chevron-up" : "chevron-down"}
              size={20}
            />
          </TouchableOpacity>
          {showVariantDropdown && (
            <View style={styles.dropdownList}>
              {COMMON_COLORS.filter((c) => c !== "Custom").map((c) => (
                <Pressable
                  key={c}
                  style={styles.ddItem}
                  onPress={() => toggleVariant(c)}
                >
                  <Text>{c}</Text>
                  {selectedVariants.includes(c) ? (
                    <Ionicons name="checkmark" size={18} color="#09A046" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.chips}>
            {selectedVariants.map((v) => (
              <View key={v} style={styles.chip}>
                <Text style={styles.chipText}>{v}</Text>
                <Pressable onPress={() => toggleVariant(v)}>
                  <Text style={styles.chipX}>×</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              style={styles.chipInput}
              placeholder="Add"
              value={customColorInput}
              onChangeText={setCustomColorInput}
              onSubmitEditing={addCustomColor}
            />
          </View>
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
            Option group 2 (sizes)
          </Text>
          <TextInput
            style={styles.input}
            value={optionGroup2Name}
            onChangeText={setOptionGroup2Name}
            placeholder="e.g. Size"
          />
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowSizeDropdown(!showSizeDropdown)}
          >
            <Text>
              {form.selectedSizes.length === 0
                ? `Select ${optionGroup2Name.toLowerCase()}…`
                : `${form.selectedSizes.length} selected`}
            </Text>
            <Ionicons
              name={showSizeDropdown ? "chevron-up" : "chevron-down"}
              size={20}
            />
          </TouchableOpacity>
          {showSizeDropdown && (
            <View style={styles.dropdownList}>
              {sizeOptions.map((sz) => (
                <Pressable
                  key={sz}
                  style={styles.ddItem}
                  onPress={() => handleSizeToggle(sz)}
                >
                  <Text>{sz}</Text>
                  {form.selectedSizes.includes(sz) ? (
                    <Ionicons name="checkmark" size={18} color="#09A046" />
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
          <View style={styles.chips}>
            {form.selectedSizes.map((sz) => (
              <View key={sz} style={styles.chip}>
                <Text style={styles.chipText}>{sz}</Text>
                <Pressable onPress={() => handleSizeToggle(sz)}>
                  <Text style={styles.chipX}>×</Text>
                </Pressable>
              </View>
            ))}
            <TextInput
              style={styles.chipInput}
              placeholder="Add"
              value={customSizeValue}
              onChangeText={setCustomSizeValue}
              onSubmitEditing={() => {
                const t = customSizeValue.trim();
                if (t && !customSizes.includes(t)) {
                  setCustomSizes((p) => [...p, t]);
                  handleSizeToggle(t);
                  setCustomSizeValue("");
                }
              }}
            />
          </View>
        </View>
      );
    }
    if (currentStep === 3) {
      return (
        <View>
          {hasAnyCombos ? (
            <>
              <View style={styles.fillAll}>
                <TextInput
                  style={[styles.input, styles.fillField]}
                  placeholder="Cost ₱"
                  keyboardType="decimal-pad"
                  value={fillAllCost}
                  onChangeText={setFillAllCost}
                />
                <TextInput
                  style={[styles.input, styles.fillField]}
                  placeholder="Sell ₱"
                  keyboardType="decimal-pad"
                  value={fillAllPrice}
                  onChangeText={setFillAllPrice}
                />
                <TextInput
                  style={[styles.input, styles.fillField]}
                  placeholder="Qty"
                  keyboardType="number-pad"
                  value={fillAllQty}
                  onChangeText={setFillAllQty}
                />
                <TouchableOpacity
                  style={styles.fillBtn}
                  onPress={handleFillAll}
                  disabled={!fillAllCost && !fillAllPrice && !fillAllQty}
                >
                  <Text style={styles.fillBtnText}>Fill all</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.comboHeader}>Variant × size</Text>
              {combos.map(({ variant: v, size: s, key }) => (
                <View key={key} style={styles.comboRow}>
                  <Text style={styles.comboLabel} numberOfLines={2}>
                    {s && s !== VARIANT_ONLY_KEY ? `${s} ` : ""}
                    {v ? `× ${v}` : ""}
                    {!v && s === VARIANT_ONLY_KEY ? " (variant only)" : ""}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.comboInput]}
                    placeholder="Cost"
                    keyboardType="decimal-pad"
                    value={
                      v && s
                        ? String(variantCostPrices[s]?.[v] ?? "")
                        : s && s !== VARIANT_ONLY_KEY
                          ? String(form.sizeCostPrices[s] ?? "")
                          : String(form.costPrice ?? "")
                    }
                    onChangeText={(t) => {
                      if (v && s) setVCost(s, v, t);
                      else if (s && s !== VARIANT_ONLY_KEY)
                        setSizeCost(s, t);
                      else setForm((p) => ({ ...p, costPrice: t }));
                    }}
                  />
                  <TextInput
                    style={[styles.input, styles.comboInput]}
                    placeholder="Sell"
                    keyboardType="decimal-pad"
                    value={
                      v && s
                        ? String(variantPrices[s]?.[v] ?? "")
                        : s && s !== VARIANT_ONLY_KEY
                          ? String(form.sizePrices[s] ?? "")
                          : String(form.itemPrice ?? "")
                    }
                    onChangeText={(t) => {
                      if (v && s) setVPrice(s, v, t);
                      else if (s && s !== VARIANT_ONLY_KEY)
                        setSizePrice(s, t);
                      else setForm((p) => ({ ...p, itemPrice: t }));
                    }}
                  />
                  <TextInput
                    style={[styles.input, styles.comboInput]}
                    placeholder="Qty"
                    keyboardType="number-pad"
                    value={
                      v && s
                        ? String(variantQuantities[s]?.[v] ?? "")
                        : s && s !== VARIANT_ONLY_KEY
                          ? String(form.sizeQuantities[s] ?? "")
                          : String(form.currentStock ?? "")
                    }
                    onChangeText={(t) => {
                      if (v && s) setVariantQty(s, v, t);
                      else if (s && s !== VARIANT_ONLY_KEY) setSizeQty(s, t);
                      else setForm((p) => ({ ...p, currentStock: t }));
                    }}
                  />
                </View>
              ))}
            </>
          ) : (
            <View>
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Cost ₱ *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={String(form.costPrice)}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, costPrice: t }))
                    }
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.label}>Selling ₱ *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={String(form.itemPrice)}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, itemPrice: t }))
                    }
                  />
                </View>
              </View>
              <Text style={styles.label}>Quantity</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={String(form.currentStock)}
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, currentStock: t }))
                }
              />
            </View>
          )}
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.bold}>Display in Terminal</Text>
              <Text style={styles.hint}>Show in POS</Text>
            </View>
            <Switch
              value={form.displayInTerminal !== false}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, displayInTerminal: v }))
              }
            />
          </View>
        </View>
      );
    }
    if (currentStep === 4) {
      return (
        <View>
          <Text style={styles.label}>Reorder level (per SKU)</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(form.reorderNumber)}
            onChangeText={(t) =>
              setForm((f) => ({ ...f, reorderNumber: t }))
            }
            placeholder="e.g. 23"
          />
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            Opening batch
          </Text>
          <Text style={styles.batchBig}>{generatedBatchNumber}</Text>
          <Text style={styles.label}>Expiring date</Text>
          <Pressable
            style={styles.input}
            onPress={() => setShowExpiryPicker(true)}
          >
            <Text>{form.expirationDate || "Select date"}</Text>
          </Pressable>
          {showExpiryPicker && (
            <DateTimePicker
              value={
                form.expirationDate
                  ? new Date(form.expirationDate + "T12:00:00")
                  : new Date()
              }
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, d) => {
                if (Platform.OS === "android") {
                  setShowExpiryPicker(false);
                }
                if (event?.type === "dismissed") {
                  setShowExpiryPicker(false);
                  return;
                }
                if (d) {
                  setForm((f) => ({
                    ...f,
                    expirationDate: d.toISOString().slice(0, 10),
                  }));
                }
              }}
            />
          )}
        </View>
      );
    }
    if (currentStep === 5) {
      const img =
        productImageUris[reviewImgIdx] ||
        productImageUris[0] ||
        form.itemImage;
      return (
        <View>
          {img ? (
            <View style={styles.reviewImgBox}>
              <Image source={{ uri: img }} style={styles.reviewImg} />
              {productImageUris.length > 1 && (
                <View style={styles.reviewNav}>
                  <Pressable
                    onPress={() =>
                      setReviewImgIdx(
                        (i) =>
                          (i - 1 + productImageUris.length) %
                          productImageUris.length
                      )
                    }
                  >
                    <Text style={styles.reviewNavText}>‹</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setReviewImgIdx(
                        (i) => (i + 1) % productImageUris.length
                      )
                    }
                  >
                    <Text style={styles.reviewNavText}>›</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.hint}>No image</Text>
          )}
          <Text style={styles.reviewTitle}>{form.itemName || "—"}</Text>
          <Text style={styles.meta}>
            {form.category} · {form.subCategory}
          </Text>
          <Text style={styles.meta}>
            Total stock: {totalReviewStock} · SKUs: {hasAnyCombos ? combos.length : 1}
          </Text>
          <Text style={styles.meta}>Batch: {generatedBatchNumber}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      <AddCategoryModal
        visible={showAddCategoryModal}
        onClose={() => {
          setShowAddCategoryModal(false);
          setCategoryModalForSub(false);
        }}
        onAdd={(name) => {
          fetchMeta();
          if (categoryModalForSub) {
            setForm((f) => ({ ...f, subCategory: name }));
          } else {
            setForm((f) => ({ ...f, category: name }));
          }
          setCategoryModalForSub(false);
        }}
      />
      <AddBrandModal
        visible={showAddBrandModal}
        onClose={() => setShowAddBrandModal(false)}
        onAdd={(name) => {
          setBrandsList((p) => [...p, { _id: String(Date.now()), brandName: name }]);
          setForm((f) => ({ ...f, brandName: name }));
        }}
      />
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Confirm add product</Text>
            <Text style={styles.modalBody}>
              Add &quot;{form.itemName}&quot; to inventory?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setShowConfirmModal(false);
                }}
              >
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOk}
                onPress={runCreateOrUpdate}
              >
                <Text style={{ color: "#fff" }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={showDiscardModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Discard draft?</Text>
            <TouchableOpacity
              style={styles.modalOk}
              onPress={() => {
                AsyncStorage.removeItem(ADD_PRODUCT_DRAFT_KEY).catch(() => {});
                setShowDiscardModal(false);
                if (typeof onBack === "function") onBack();
                else router.back();
              }}
            >
              <Text style={{ color: "#fff" }}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowDiscardModal(false)}
            >
              <Text>Stay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: toastOpacity,
            transform: [{ translateY: toastTranslate }],
          },
        ]}
      >
        <Text>{successMessage}</Text>
      </Animated.View>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Product" : "Add New Product"}
        </Text>
      </View>
      {isEditing ? (
        renderEditMode()
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stepper}
          >
            {STEPS.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => {
                  if (s.id < currentStep) setCurrentStep(s.id);
                }}
                style={styles.stepPill}
              >
                <View
                  style={[
                    styles.stepDot,
                    currentStep >= s.id && styles.stepDotOn,
                  ]}
                >
                  <Text style={styles.stepNum}>{s.id}</Text>
                </View>
                <Text style={styles.stepLbl}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            {renderStepContent()}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() =>
                currentStep === 1
                  ? handleBack()
                  : setCurrentStep((x) => x - 1)
              }
            >
              <Text>{currentStep === 1 ? "Cancel" : "Back"}</Text>
            </TouchableOpacity>
            {currentStep < 5 ? (
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  !isStepValid(currentStep) && { opacity: 0.5 },
                ]}
                disabled={!isStepValid(currentStep)}
                onPress={() => setCurrentStep((x) => x + 1)}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={onPressSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Add Product</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { marginLeft: 12, fontSize: 18, fontWeight: "600" },
  stepper: { maxHeight: 72, paddingVertical: 8, backgroundColor: "#fff" },
  stepPill: { alignItems: "center", marginHorizontal: 10 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotOn: { backgroundColor: "#09A046", borderColor: "#09A046" },
  stepNum: { fontSize: 12, fontWeight: "700", color: "#374151" },
  stepLbl: { fontSize: 10, marginTop: 4, maxWidth: 72, textAlign: "center" },
  scrollView: { flex: 1 },
  scrollContainer: { padding: 16, paddingBottom: 120 },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  row2: { flexDirection: "row", gap: 8, alignItems: "center" },
  flex1: { flex: 1 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  primaryBtn: {
    backgroundColor: "#09A046",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  footer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  addImgBox: {
    width: 88,
    height: 88,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  thumbWrap: {
    width: 88,
    height: 88,
    marginRight: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  thumb: { width: "100%", height: "100%" },
  mainBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#BAE4CB",
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  mainBadgeText: { fontSize: 9, color: "#fff", fontWeight: "600" },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  warn: { color: "#b45309", fontSize: 12, marginTop: 8 },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#fff",
    marginTop: 8,
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    maxHeight: 200,
    backgroundColor: "#fff",
  },
  ddItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(9,160,70,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: { color: "#09A046", fontSize: 13 },
  chipX: { marginLeft: 6, color: "#09A046", fontSize: 16 },
  chipInput: {
    minWidth: 56,
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  fillAll: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  fillField: { width: "30%", minWidth: 90 },
  fillBtn: {
    backgroundColor: "#09A046",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
  },
  fillBtnText: { color: "#fff", fontWeight: "600", fontSize: 12 },
  comboHeader: { fontWeight: "700", marginBottom: 8 },
  comboRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 10,
  },
  comboLabel: { width: "100%", fontSize: 13, marginBottom: 4 },
  comboInput: { flex: 1, minWidth: 80 },
  batchBig: { fontSize: 20, fontWeight: "800", marginVertical: 8 },
  reviewImgBox: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  reviewImg: { width: "100%", height: "100%" },
  reviewNav: {
    position: "absolute",
    bottom: 8,
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  reviewNavText: {
    color: "#fff",
    fontSize: 22,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  reviewTitle: { fontSize: 20, fontWeight: "800" },
  meta: { color: "#6b7280", marginTop: 4 },
  toast: {
    position: "absolute",
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    zIndex: 50,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalBody: { color: "#4b5563", marginBottom: 16 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalCancel: { padding: 12 },
  modalOk: {
    backgroundColor: "#09A046",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  card: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  bold: { fontWeight: "700" },
  hint: { fontSize: 12, color: "#6b7280" },
});
