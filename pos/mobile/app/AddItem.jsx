import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as ExpoFileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Modal,
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
import { brandPartnerAPI, productAPI } from "../services/api";

const categoryCodeMap = {
  Tops: "TOP",
  Bottoms: "BTM",
  Dresses: "DRS",
  Makeup: "MKP",
  Accessories: "ACC",
  Shoes: "SHO",
  "Head Wear": "HDW",
  Foods: "FOD",
};

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

// Get variant code from variant string (first 3 chars uppercase)
const getVariantCode = (variant) => {
  if (!variant || variant.trim() === "") {
    return "";
  }

  // Clean and uppercase the variant, take first 3 characters
  const cleaned = variant.replace(/\s+/g, "").toUpperCase();
  return cleaned.substring(0, 3);
};

// Generate SKU format: CATEGORY-00001-VARIANT (e.g., TOP-00001-RED)
// Generate SKU format: CATEGORY-RANDOM-VARIANT (e.g., TOP-A1B2C-RED)
const generateMobileSKU = (category = "Others", variant = "") => {
  const categoryCode = categoryCodeMap[category] || "OTH";

  // Generate 5 random alphanumeric characters
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let randomCode = "";
  for (let i = 0; i < 5; i++) {
    randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Build SKU: CATEGORY-RANDOM or CATEGORY-RANDOM-VARIANT
  if (!variant || variant.trim() === "") {
    return `${categoryCode}-${randomCode}`;
  }

  const variantCode = getVariantCode(variant);
  return `${categoryCode}-${randomCode}-${variantCode}`;
};

// Convert image to base64 with compression
const convertImageToBase64 = async (uri) => {
  try {
    if (!uri) return "";
    // If already base64, return as is
    if (uri.startsWith("data:image")) return uri;

    // COMPRESSION STEP: Resize and compress image
    // Max dimension: 1024px, Quality: 0.6 (60%)
    const manipulatedResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }], // Resize width to 1024, height auto-scales
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Check if ExpoFileSystem is available and has the required method
    if (
      !ExpoFileSystem ||
      typeof ExpoFileSystem.readAsStringAsync !== "function"
    ) {
      console.warn("ExpoFileSystem not available, returning URI as-is");
      return uri;
    }

    // Read compressed file as base64
    const encodingOptions = ExpoFileSystem.EncodingType
      ? { encoding: ExpoFileSystem.EncodingType.Base64 }
      : { encoding: "base64" };

    const base64 = await ExpoFileSystem.readAsStringAsync(manipulatedResult.uri, encodingOptions);

    // Always use JPEG mime type since we converted to JPEG
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error("Error converting/compressing image:", error);
    // Return the original URI as fallback so the image can still be used locally
    return uri || "";
  }
};

function AddItem({ onBack, item, isEditing = false }) {
  // State declarations with initial values from item prop if in edit mode
  const [itemImage, setItemImage] = useState(item?.image || null);
  const [itemName, setItemName] = useState(item?.itemName || item?.name || "");
  const [itemCategory, setItemCategory] = useState(item?.category || "Tops");
  const [itemSize, setItemSize] = useState(item?.size || "");
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sizeQuantities, setSizeQuantities] = useState({});
  const [differentPricesPerSize, setDifferentPricesPerSize] = useState(false);
  const [sizePrices, setSizePrices] = useState({});
  const [sizeCostPrices, setSizeCostPrices] = useState({});
  const [waistSize, setWaistSize] = useState(item?.waistSize || "");
  const [accessoryType, setAccessoryType] = useState(item?.accessoryType || "");
  const [makeupBrand, setMakeupBrand] = useState(item?.makeupBrand || "");
  const [makeupShade, setMakeupShade] = useState(item?.makeupShade || "");
  const [shoeSize, setShoeSize] = useState(item?.shoeSize || "");
  const [essentialType, setEssentialType] = useState(item?.essentialType || "");
  const [customEssentialType, setCustomEssentialType] = useState(
    item?.customEssentialType || "",
  );
  const [variant, setVariant] = useState(item?.variant || "");
  const [customVariant, setCustomVariant] = useState(""); // For custom color input
  const [differentVariantsPerSize, setDifferentVariantsPerSize] =
    useState(false);
  const [sizeVariants, setSizeVariants] = useState({});
  const [multipleVariantsPerSize, setMultipleVariantsPerSize] = useState({}); // Tracks which sizes have multiple variants
  const [sizeMultiVariants, setSizeMultiVariants] = useState({}); // Stores arrays of variants per size
  const [costPrice, setCostPrice] = useState(
    item?.costPrice !== undefined ? item.costPrice.toString() : "",
  );
  const [sellingPrice, setSellingPrice] = useState(
    item?.itemPrice !== undefined
      ? item.itemPrice.toString()
      : item?.price
        ? item.price.toString()
        : "",
  );
  const [itemPrice, setItemPrice] = useState(
    item?.itemPrice !== undefined
      ? item.itemPrice.toString()
      : item?.price
        ? item.price.toString()
        : "",
  );
  const [itemStock, setItemStock] = useState(
    item?.currentStock !== undefined
      ? item.currentStock.toString()
      : item?.stock
        ? item.stock.toString()
        : "",
  );
  const [brand, setBrand] = useState(
    item?.brandName || item?.brand || "Default",
  );
  const [brandsList, setBrandsList] = useState([]);
  const [expirationDate, setExpirationDate] = useState(
    item?.expirationDate || "",
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [essentialExpirationDate, setEssentialExpirationDate] = useState(
    item?.essentialExpirationDate || "",
  );
  const [showEssentialDatePicker, setShowEssentialDatePicker] = useState(false);
  const [foodType, setFoodType] = useState(item?.foodType || "");
  const [customFoodType, setCustomFoodType] = useState(
    item?.customFoodType || "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [isForPOS, setIsForPOS] = useState(item?.isForPOS || false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [categoriesList, setCategoriesList] = useState([
    "Tops",
    "Bottoms",
    "Dresses",
    "Head Wear",
    "Makeup",
    "Accessories",
    "Shoes",
    "Foods",
  ]); // Start with default categories

  // Animation refs
  const toastTranslate = useRef(new Animated.Value(-60)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Handle toast animation
  useEffect(() => {
    if (showSuccess) {
      // Fade in
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

      // Auto hide after delay
      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 2000);

      return () => clearTimeout(timer);
    } else {
      // Fade out
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
    }
  }, [showSuccess]);

  // Check if there are any unsaved changes
  const hasUnsavedChanges = () => {
    const changes = [
      !!itemImage,
      !!itemName,
      itemCategory && itemCategory !== "Tops",
      !!itemSize,
      selectedSizes.length > 0,
      Object.keys(sizeQuantities).length > 0,
      !!waistSize,
      !!accessoryType,
      !!makeupBrand,
      !!makeupShade,
      !!shoeSize,
      !!essentialType,
      !!customEssentialType,
      !!itemPrice,
      !!itemStock,
      brand !== "Default",
      !!expirationDate,
      !!essentialExpirationDate,
      !!foodType,
      !!customFoodType,
      !!variant,
      differentVariantsPerSize,
      Object.keys(sizeVariants).length > 0,
      isForPOS,
      showAddCategoryModal,
      showAddBrandModal,
    ];

    const hasChanges = changes.some(Boolean);
    console.log("Has unsaved changes:", hasChanges);
    return hasChanges;
  };

  // Handle back navigation with confirmation if there are unsaved changes
  const handleBack = () => {
    const unsaved = hasUnsavedChanges();
    console.log("Handle back pressed. Unsaved changes:", unsaved);

    if (unsaved) {
      setShowDiscardModal(true);
    } else {
      // No unsaved changes, proceed with back navigation
      if (typeof onBack === "function") {
        onBack();
      } else {
        router.back();
      }
    }
  };

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      handleBack();
      return true; // Prevent default behavior (exit app)
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [hasUnsavedChanges]); // check dependencies logic later

  // Initialize all form fields with default values
  const initializeForm = () => {
    setItemImage(null);
    setItemName("");
    setItemCategory("Tops");
    setItemSize("");
    setSelectedSizes([]);
    setSizeQuantities({});
    setWaistSize("");
    setAccessoryType("");
    setMakeupBrand("");
    setMakeupShade("");
    setShoeSize("");
    setEssentialType("");
    setCustomEssentialType("");
    setCostPrice("");
    setSellingPrice("");
    setItemPrice("");
    setItemStock("");
    setBrand("Default");
    setExpirationDate("");
    setEssentialExpirationDate("");
    setFoodType("");
    setCustomFoodType("");
    setVariant("");
    setDifferentVariantsPerSize(false);
    setSizeVariants({});
    setIsForPOS(false);
  };

  // Fetch brands from database on component mount
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const response = await brandPartnerAPI.getAll();
        if (response.success && response.data) {
          setBrandsList(response.data);
        }
      } catch (error) {
        console.error("Error fetching brands:", error);
      }
    };
    fetchBrands();
  }, []);

  // Fetch categories (if dynamic) or ensure custom categories are loaded
  // For now, we utilize the defaults but could extend to fetch from API if categories are dynamic
  useEffect(() => {
    // If we were to fetch categories from API, do it here
    // For now, we'll just stick to the initial list but this placeholder is here for future
  }, []);

  // Initialize form on component mount or when item prop changes
  useEffect(() => {
    if (isEditing && item) {
      // Pre-fill form with item data when in edit mode
      setItemImage(item.itemImage || item.image || null);
      setItemName(item.itemName || item.name || "");
      setItemCategory(item.category || "Tops");
      setItemSize(item.size || "");
      setWaistSize(item.waistSize || "");
      setAccessoryType(item.accessoryType || "");
      setMakeupBrand(item.makeupBrand || "");
      setMakeupShade(item.makeupShade || "");
      setShoeSize(item.shoeSize || "");
      setEssentialType(item.essentialType || "");
      setCustomEssentialType(item.customEssentialType || "");
      setCostPrice(
        item.costPrice !== undefined ? item.costPrice.toString() : "",
      );
      setSellingPrice(
        item.itemPrice !== undefined
          ? item.itemPrice.toString()
          : item.price
            ? item.price.toString()
            : "",
      );
      setItemPrice(
        item.itemPrice !== undefined
          ? item.itemPrice.toString()
          : item.price
            ? item.price.toString()
            : "",
      );
      setItemStock(
        item.currentStock !== undefined
          ? item.currentStock.toString()
          : item.stock
            ? item.stock.toString()
            : "",
      );
      setBrand(item.brandName || item.brand || "Default");
      setExpirationDate(item.expirationDate || "");
      setEssentialExpirationDate(item.essentialExpirationDate || "");
      setFoodType(item.foodType || "");
      setCustomFoodType(item.customFoodType || "");
      setVariant(item.variant || "");
      // logic to popuplate specific size variants if they exist (web seemingly doesn't pass this explicitly in simple mode but lets try to act smart)
      // For now, simpler reset
      setDifferentVariantsPerSize(false);
      setSizeVariants({});
      setIsForPOS(!!item.isForPOS);
    } else {
      initializeForm();
    }
  }, [isEditing, item]);

  const showImagePickerOptions = () => {
    Alert.alert(
      "Add Photo",
      "Choose your photo source",
      [
        {
          text: "Take Photo",
          onPress: () => takePhoto(),
        },
        {
          text: "Choose from Gallery",
          onPress: () => pickFromGallery(),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ],
      { cancelable: true },
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission required", "Please allow access to your camera");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setItemImage(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow access to your photo library",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setItemImage(result.assets[0].uri);
    }
  };

  const router = useRouter();

  const validateForm = () => {
    if (!itemName || !itemCategory || !itemPrice || !itemStock) {
      Alert.alert("Error", "Please fill in all required fields");
      return false;
    }
    if (!itemImage) {
      Alert.alert("Error", "Please select an image");
      return false;
    }
    if (!itemName.trim()) {
      Alert.alert("Error", "Please enter item name");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    // Basic validation - check if sizes are selected but no quantities entered
    const hasSizesSelected = selectedSizes.length > 0;
    const hasValidSizeQuantities =
      hasSizesSelected &&
      selectedSizes.some((size) => {
        const qty = parseInt(sizeQuantities[size]) || 0;
        return qty > 0;
      });

    // Calculate total stock from size quantities if sizes are selected
    const totalSizeStock = hasSizesSelected
      ? selectedSizes.reduce(
        (sum, size) => sum + (parseInt(sizeQuantities[size]) || 0),
        0,
      )
      : 0;

    // Validation
    if (!itemName || !itemCategory || !sellingPrice) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    // If sizes are selected, validate quantities; otherwise validate single stock
    if (hasSizesSelected && !hasValidSizeQuantities) {
      Alert.alert(
        "Error",
        "Please enter quantity for at least one selected size",
      );
      return;
    }

    if (!hasSizesSelected && !itemStock) {
      Alert.alert("Error", "Please enter stock quantity");
      return;
    }

    if (parseFloat(sellingPrice) <= 0) {
      Alert.alert("Error", "Selling price must be greater than 0");
      return;
    }

    if (costPrice && parseFloat(costPrice) < 0) {
      Alert.alert("Error", "Cost price cannot be negative");
      return;
    }

    setIsLoading(true);

    try {
      const normalizedCategory = itemCategory || "Tops";

      // Use variant from new field if available, or fallback
      const skuVariant = variant || customEssentialType || itemSize || "";
      const skuValue =
        item?.sku || generateMobileSKU(normalizedCategory, skuVariant);

      // Convert image to base64 for proper storage
      let imageBase64 = "";
      if (itemImage) {
        imageBase64 = await convertImageToBase64(itemImage);
      }

      // Build sizes object for backend (matching web format)
      let sizesObject = {};
      if (hasSizesSelected) {
        selectedSizes.forEach((size) => {
          // Determine variant value for this size
          let variantValue = "";
          if (differentVariantsPerSize) {
            // Check if this size has multiple variants enabled
            if (multipleVariantsPerSize[size]) {
              // Use array of variants from sizeMultiVariants
              variantValue = sizeMultiVariants[size] || [];
            } else {
              // Use single variant from sizeVariants
              variantValue = sizeVariants[size] || "";
            }
          } else {
            // Use global variant (with custom support)
            variantValue = variant === "Custom" ? customVariant : variant || "";
          }

          sizesObject[size] = {
            quantity: parseInt(sizeQuantities[size]) || 0,
            price: differentPricesPerSize
              ? parseFloat(sizePrices[size]) || 0
              : parseFloat(sellingPrice) || 0,
            costPrice: differentPricesPerSize
              ? parseFloat(sizeCostPrices[size]) || 0
              : parseFloat(costPrice) || 0,
            variant: variantValue,
          };
        });
      }

      // Prepare the item data aligned with backend schema
      const itemData = {
        sku: skuValue,
        itemName: itemName.trim(),
        category: normalizedCategory,
        brandName: brand,
        itemPrice: parseFloat(sellingPrice) || 0,
        currentStock: hasSizesSelected
          ? totalSizeStock
          : parseInt(itemStock) || 0,
        costPrice: parseFloat(costPrice) || 0,
        variant:
          variant === "Custom"
            ? customVariant
            : variant || customEssentialType || itemSize || "",
        size: itemSize,
        sizes: hasSizesSelected ? sizesObject : {},
        waistSize,
        accessoryType,
        makeupBrand,
        makeupShade,
        shoeSize,
        essentialType,
        customEssentialType,
        foodSubtype: foodType,
        customFoodType,
        expirationDate: expirationDate || null,
        essentialExpirationDate: essentialExpirationDate || null,
        displayInTerminal: isForPOS,
        itemImage: imageBase64,
        dateAdded: item?.dateAdded || new Date().toISOString(),
        isForPOS,
      };

      console.log(isEditing ? "Updating item:" : "Adding new item:", itemData);

      let response;
      if (isEditing && (item._id || item.id)) {
        // Update existing product
        const productId = item._id || item.id;
        response = await productAPI.update(productId, itemData);
      } else {
        // Create new product
        response = await productAPI.create(itemData);
      }

      if (response.success) {
        setIsLoading(false);
        setSuccessMessage(
          isEditing ? "Item updated successfully!" : "Item added successfully!",
        );
        setShowSuccess(true);

        // Hide success message after 2 seconds and go back
        setTimeout(() => {
          setShowSuccess(false);
          // Navigate back after a short delay
          setTimeout(() => {
            if (typeof onBack === "function") {
              onBack();
            } else {
              router.back();
            }
          }, 500);
        }, 2000);
      } else {
        throw new Error(response.message || "Failed to save item");
      }
    } catch (error) {
      console.error("Error saving item:", error);
      setIsLoading(false);
      Alert.alert(
        "Error",
        error.message ||
        "Failed to save item. Please check your connection and try again.",
      );
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    // Add search functionality here if needed
  };

  return (
    <View style={styles.container}>
      <AddCategoryModal
        visible={showAddCategoryModal}
        onClose={() => setShowAddCategoryModal(false)}
        onAdd={(newCategory) => {
          setCategoriesList((prev) => [...prev, newCategory]);
          setItemCategory(newCategory);
          // Reset size selections/variants since category changed
          setSelectedSizes([]);
          setSizeQuantities({});
          setDifferentVariantsPerSize(false);
          setSizeVariants({});
          setVariant("");
        }}
      />
      <AddBrandModal
        visible={showAddBrandModal}
        onClose={() => setShowAddBrandModal(false)}
        onAdd={(newBrand) => {
          setBrandsList((prev) => [
            ...prev,
            { _id: Date.now().toString(), brandName: newBrand },
          ]);
          setBrand(newBrand);
        }}
      />
      {/* Success Toast */}
      <Animated.View
        pointerEvents={showSuccess ? "auto" : "none"}
        style={[
          styles.toastContainer,
          {
            transform: [{ translateY: toastTranslate }],
            opacity: toastOpacity,
          },
        ]}
      >
        <View style={styles.toastContent}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color="#4CAF50"
            style={styles.toastIcon}
          />
          <Text style={styles.toastText}>{successMessage}</Text>
        </View>
      </Animated.View>
      {/* Notification container */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Item" : "Add New Item"}
        </Text>
      </View>

      {/* Discard Changes Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDiscardModal}
        onRequestClose={() => setShowDiscardModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Discard Changes?</Text>
            <Text style={styles.modalText}>
              You have unsaved changes. Are you sure you want to leave?
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDiscardModal(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: "#EF4444" }]}
                onPress={() => {
                  setShowDiscardModal(false);
                  if (typeof onBack === "function") {
                    onBack();
                  } else {
                    router.back();
                  }
                }}
              >
                <Text style={[styles.buttonText, { color: "white" }]}>
                  Discard
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Confirmation Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={showConfirmation}
          onRequestClose={() => setShowConfirmation(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Confirm Add Item</Text>
              <Text style={styles.modalText}>
                Are you sure you want to add this item to your inventory?
              </Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowConfirmation(false)}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={handleSubmit}
                >
                  <Text style={[styles.buttonText, { color: "white" }]}>
                    Add Item
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        {/* Image Upload */}
        <TouchableOpacity
          style={styles.imageUploadContainer}
          onPress={showImagePickerOptions}
        >
          {itemImage ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: itemImage }}
                style={styles.image}
                resizeMode="cover"
                onError={(error) => {
                  console.log("Image load error:", error);
                  // If there's an error loading the image, we'll show the placeholder view
                  setItemImage(null);
                }}
              />
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <View style={styles.cameraIconContainer}>
                <Ionicons name="camera" size={32} color="#6b7280" />
                <Ionicons
                  name="images"
                  size={32}
                  color="#6b7280"
                  style={{ marginLeft: 10 }}
                />
              </View>
              <Text style={styles.imagePlaceholderText}>
                Tap to take a photo or select from gallery
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Item Name */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Item Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter item name"
            value={itemName}
            onChangeText={setItemName}
          />
        </View>

        {/* Brand */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Brand</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={brand}
              onValueChange={(itemValue) => {
                if (itemValue === "__add_new__") {
                  setShowAddBrandModal(true);
                  // Don't change selection yet
                  return;
                }
                setBrand(itemValue);
              }}
              style={styles.picker}
              dropdownIconColor="#6b7280"
              mode="dropdown"
            >
              <Picker.Item label="Default" value="Default" />
              {brandsList.map((brandItem) => (
                <Picker.Item
                  key={brandItem._id}
                  label={brandItem.brandName}
                  value={brandItem.brandName}
                />
              ))}
              <Picker.Item
                label="+ Add Brand"
                value="__add_new__"
                color="#AD7F65"
              />
            </Picker>
          </View>
        </View>

        {/* Item Category */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Category *</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={itemCategory}
              onValueChange={(itemValue) => {
                if (itemValue === "__add_new__") {
                  setShowAddCategoryModal(true);
                  return;
                }
                setItemCategory(itemValue);
                // Reset size selections and variants when category changes
                setSelectedSizes([]);
                setSizeQuantities({});
                setDifferentVariantsPerSize(false);
                setSizeVariants({});
                setVariant("");
              }}
              style={styles.picker}
              dropdownIconColor="#6b7280"
              mode="dropdown"
            >
              <Picker.Item label="Select a category" value="" />
              {categoriesList.map((cat) => (
                <Picker.Item key={cat} label={cat} value={cat} />
              ))}
              <Picker.Item
                label="+ Add Category"
                value="__add_new__"
                color="#AD7F65"
              />
            </Picker>
          </View>
        </View>

        {/* Variant (Optional) */}
        {itemCategory && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Variant{" "}
              <Text style={{ color: "#9ca3af", fontWeight: "400" }}>
                Optional
              </Text>
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={variant}
                onValueChange={(itemValue) => {
                  setVariant(itemValue);
                  if (itemValue !== "Custom") {
                    setCustomVariant(""); // Clear custom input if not custom
                  }
                }}
                enabled={!differentVariantsPerSize}
                style={[
                  styles.picker,
                  differentVariantsPerSize && styles.disabledPicker,
                ]}
                dropdownIconColor={
                  differentVariantsPerSize ? "#ccc" : "#6b7280"
                }
                mode="dropdown"
              >
                <Picker.Item
                  label={
                    differentVariantsPerSize
                      ? "Multiple variants selected"
                      : "Select a color"
                  }
                  value=""
                />
                {COMMON_COLORS.map((color) => (
                  <Picker.Item key={color} label={color} value={color} />
                ))}
              </Picker>
            </View>
            {variant === "Custom" && !differentVariantsPerSize && (
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="Enter custom color"
                value={customVariant}
                onChangeText={setCustomVariant}
              />
            )}
          </View>
        )}

        {/* Food Type - For food (placed before sizes since sizes depend on food type) */}
        {itemCategory === "Foods" && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Food Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={foodType}
                onValueChange={(itemValue) => {
                  setFoodType(itemValue);
                  // Reset size selections when food type changes since sizes differ
                  setSelectedSizes([]);
                  setSizeQuantities({});
                  setDifferentVariantsPerSize(false);
                  setSizeVariants({});
                  setDifferentPricesPerSize(false);
                  setSizePrices({});
                  setSizeCostPrices({});
                }}
                style={styles.picker}
                dropdownIconColor="#6b7280"
                mode="dropdown"
              >
                <Picker.Item label="Select food type" value="" />
                <Picker.Item label="Beverages" value="Beverages" />
                <Picker.Item label="Snacks" value="Snacks" />
                <Picker.Item label="Meals" value="Meals" />
                <Picker.Item label="Desserts" value="Desserts" />
                <Picker.Item label="Ingredients" value="Ingredients" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
            {foodType === "Other" && (
              <View style={[styles.inputContainer, { marginTop: 10 }]}>
                <Text style={styles.label}>Please specify *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter food type"
                  value={customFoodType}
                  onChangeText={setCustomFoodType}
                />
              </View>
            )}
          </View>
        )}

        {/* Size Selection - Dynamic based on category (matching web) */}
        {itemCategory &&
          !["Essentials"].includes(itemCategory) &&
          (() => {
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
            const isBuiltIn = builtInCategories.includes(itemCategory);
            let sizes = [];
            if (!isBuiltIn) {
              sizes = ["Free Size"];
            } else if (itemCategory === "Foods") {
              switch (foodType) {
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
                  sizes = ["Regular", "Large", "Family Size", "Free Size"];
                  break;
                case "Desserts":
                  sizes = ["Small", "Medium", "Large", "Free Size"];
                  break;
                case "Ingredients":
                  sizes = ["100g", "250g", "500g", "1kg", "Free Size"];
                  break;
                case "Other":
                  sizes = ["Small", "Medium", "Large", "Free Size"];
                  break;
                default:
                  sizes = ["Small", "Medium", "Large", "Free Size"];
              }
            } else if (["Tops", "Bottoms", "Dresses"].includes(itemCategory)) {
              sizes = ["XS", "S", "M", "L", "XL", "XXL", "XXXL", "Free Size"];
            } else if (itemCategory === "Shoes") {
              sizes = ["5", "6", "7", "8", "9", "10", "11", "12"];
            } else if (
              ["Accessories", "Head Wear", "Makeup"].includes(itemCategory)
            ) {
              sizes = ["Free Size"];
            }
            if (sizes.length === 0) return null;
            return (
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Sizes (Select multiple)</Text>
                <View style={styles.sizeCheckboxGrid}>
                  {sizes.map((size) => (
                    <TouchableOpacity
                      key={size}
                      style={styles.sizeCheckboxItem}
                      onPress={() => {
                        setSelectedSizes((prev) => {
                          if (prev.includes(size)) {
                            // Remove size and its quantity
                            setSizeQuantities((prevQty) => {
                              const newQty = { ...prevQty };
                              delete newQty[size];
                              return newQty;
                            });
                            // Remove size variant
                            setSizeVariants((prevVar) => {
                              const newVar = { ...prevVar };
                              delete newVar[size];
                              return newVar;
                            });
                            return prev.filter((s) => s !== size);
                          } else {
                            return [...prev, size];
                          }
                        });
                      }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          selectedSizes.includes(size) &&
                          styles.checkboxChecked,
                        ]}
                      >
                        {selectedSizes.includes(size) && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.sizeCheckboxLabel}>{size}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Quantity inputs for selected sizes */}
                {selectedSizes.length > 0 && (
                  <>
                    {/* Different variants per size checkbox */}
                    <TouchableOpacity
                      style={styles.differentPricesRow}
                      onPress={() => {
                        setDifferentVariantsPerSize(!differentVariantsPerSize);
                        if (!differentVariantsPerSize) {
                          const newSizeVariants = {};
                          selectedSizes.forEach((size) => {
                            newSizeVariants[size] = variant || "";
                          });
                          setSizeVariants(newSizeVariants);
                        } else {
                          setSizeVariants({});
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          differentVariantsPerSize && styles.checkboxChecked,
                        ]}
                      >
                        {differentVariantsPerSize && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.differentPricesLabel}>
                        Different variants each sizes?
                      </Text>
                    </TouchableOpacity>
                    {/* Different prices per size checkbox */}
                    <TouchableOpacity
                      style={styles.differentPricesRow}
                      onPress={() => {
                        setDifferentPricesPerSize(!differentPricesPerSize);
                        if (!differentPricesPerSize) {
                          // Initialize prices for all selected sizes
                          const newSizePrices = {};
                          const newSizeCostPrices = {};
                          selectedSizes.forEach((size) => {
                            newSizePrices[size] = sellingPrice || "";
                            newSizeCostPrices[size] = costPrice || "";
                          });
                          setSizePrices(newSizePrices);
                          setSizeCostPrices(newSizeCostPrices);
                        } else {
                          setSizePrices({});
                          setSizeCostPrices({});
                        }
                      }}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          differentPricesPerSize && styles.checkboxChecked,
                        ]}
                      >
                        {differentPricesPerSize && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.differentPricesLabel}>
                        Different prices each size?
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.sizeQuantityContainer}>
                      <Text style={styles.sizeQuantityTitle}>
                        Quantity per Size:
                      </Text>
                      <View style={styles.sizeQuantityGrid}>
                        {selectedSizes.map((size) => (
                          <View key={size} style={styles.sizeQuantityItem}>
                            <Text style={styles.sizeQuantityLabel}>{size}</Text>
                            <TextInput
                              style={styles.sizeQuantityInput}
                              placeholder="0"
                              keyboardType="numeric"
                              value={sizeQuantities[size]?.toString() || ""}
                              onChangeText={(value) => {
                                setSizeQuantities((prev) => ({
                                  ...prev,
                                  [size]: value,
                                }));
                              }}
                            />
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Variants per size - only show when differentVariantsPerSize is true */}
                    {differentVariantsPerSize && (
                      <View style={styles.sizeQuantityContainer}>
                        <Text style={styles.sizeQuantityTitle}>
                          Variant per Size:
                        </Text>
                        <View style={styles.sizeQuantityGrid}>
                          {selectedSizes.map((size) => {
                            const hasMultipleVariants =
                              multipleVariantsPerSize[size] || false;
                            const variants = sizeMultiVariants[size] || [];
                            const singleVariant = sizeVariants[size] || "";

                            return (
                              <View key={size} style={styles.sizeVariantItem}>
                                <Text style={styles.sizeQuantityLabel}>
                                  {size}
                                </Text>

                                {/* Checkbox for multiple variants in this size */}
                                <TouchableOpacity
                                  style={[
                                    styles.differentPricesRow,
                                    { marginTop: 8, marginBottom: 8 },
                                  ]}
                                  onPress={() => {
                                    setMultipleVariantsPerSize((prev) => ({
                                      ...prev,
                                      [size]: !prev[size],
                                    }));
                                    if (!hasMultipleVariants) {
                                      // Initialize with single variant if any
                                      setSizeMultiVariants((prev) => ({
                                        ...prev,
                                        [size]: singleVariant
                                          ? [singleVariant]
                                          : [],
                                      }));
                                    } else {
                                      // Clear multi-variants when unchecking
                                      setSizeMultiVariants((prev) => {
                                        const newState = { ...prev };
                                        delete newState[size];
                                        return newState;
                                      });
                                    }
                                  }}
                                >
                                  <View
                                    style={[
                                      styles.checkbox,
                                      hasMultipleVariants &&
                                      styles.checkboxChecked,
                                    ]}
                                  >
                                    {hasMultipleVariants && (
                                      <Ionicons
                                        name="checkmark"
                                        size={14}
                                        color="#fff"
                                      />
                                    )}
                                  </View>
                                  <Text
                                    style={[
                                      styles.differentPricesLabel,
                                      { fontSize: 13 },
                                    ]}
                                  >
                                    Different variant in this size?
                                  </Text>
                                </TouchableOpacity>

                                {!hasMultipleVariants ? (
                                  /* Single variant dropdown */
                                  <>
                                    <View style={styles.pickerContainer}>
                                      <Picker
                                        selectedValue={singleVariant}
                                        onValueChange={(itemValue) => {
                                          setSizeVariants((prev) => ({
                                            ...prev,
                                            [size]: itemValue,
                                          }));
                                        }}
                                        style={styles.picker}
                                        dropdownIconColor="#6b7280"
                                        mode="dropdown"
                                      >
                                        <Picker.Item
                                          label="Select a color"
                                          value=""
                                        />
                                        {COMMON_COLORS.filter(
                                          (c) => c !== "Custom",
                                        ).map((color) => (
                                          <Picker.Item
                                            key={color}
                                            label={color}
                                            value={color}
                                          />
                                        ))}
                                      </Picker>
                                    </View>
                                  </>
                                ) : (
                                  /* Multiple variants UI */
                                  <View style={styles.multiVariantContainer}>
                                    {/* Display current variants as chips */}
                                    <View style={styles.variantChipsContainer}>
                                      {variants.map((v, index) => (
                                        <View
                                          key={index}
                                          style={styles.variantChip}
                                        >
                                          <Text style={styles.variantChipText}>
                                            {v}
                                          </Text>
                                          <TouchableOpacity
                                            onPress={() => {
                                              setSizeMultiVariants((prev) => ({
                                                ...prev,
                                                [size]: variants.filter(
                                                  (_, i) => i !== index,
                                                ),
                                              }));
                                            }}
                                          >
                                            <Ionicons
                                              name="close-circle"
                                              size={16}
                                              color="#666"
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      ))}
                                    </View>

                                    {/* Add variant dropdown */}
                                    <View style={styles.pickerContainer}>
                                      <Picker
                                        selectedValue=""
                                        onValueChange={(itemValue) => {
                                          if (
                                            itemValue &&
                                            !variants.includes(itemValue)
                                          ) {
                                            setSizeMultiVariants((prev) => ({
                                              ...prev,
                                              [size]: [
                                                ...(prev[size] || []),
                                                itemValue,
                                              ],
                                            }));
                                          }
                                        }}
                                        style={styles.picker}
                                        dropdownIconColor="#6b7280"
                                        mode="dropdown"
                                      >
                                        <Picker.Item
                                          label="+ Add variant"
                                          value=""
                                        />
                                        {COMMON_COLORS.filter(
                                          (c) =>
                                            c !== "Custom" &&
                                            !variants.includes(c),
                                        ).map((color) => (
                                          <Picker.Item
                                            key={color}
                                            label={color}
                                            value={color}
                                          />
                                        ))}
                                      </Picker>
                                    </View>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Pricing per size - only show when differentPricesPerSize is true */}
                    {differentPricesPerSize && (
                      <View style={styles.sizeQuantityContainer}>
                        <Text style={styles.sizeQuantityTitle}>
                          Pricing per Size:
                        </Text>
                        {selectedSizes.map((size) => (
                          <View key={size} style={styles.sizePriceRow}>
                            <View style={styles.sizePriceItem}>
                              <Text style={styles.sizeQuantityLabel}>
                                {size} Cost Price
                              </Text>
                              <TextInput
                                style={styles.sizeQuantityInput}
                                placeholder="0.00"
                                keyboardType="numeric"
                                value={sizeCostPrices[size]?.toString() || ""}
                                onChangeText={(value) => {
                                  setSizeCostPrices((prev) => ({
                                    ...prev,
                                    [size]: value,
                                  }));
                                }}
                              />
                            </View>
                            <View style={styles.sizePriceItem}>
                              <Text style={styles.sizeQuantityLabel}>
                                {size} Selling Price
                              </Text>
                              <TextInput
                                style={styles.sizeQuantityInput}
                                placeholder="0.00"
                                keyboardType="numeric"
                                value={sizePrices[size]?.toString() || ""}
                                onChangeText={(value) => {
                                  setSizePrices((prev) => ({
                                    ...prev,
                                    [size]: value,
                                  }));
                                }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            );
          })()}

        {/* Makeup Fields - For makeup */}
        {itemCategory === "Makeup" && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Variant *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Nude, Ruby, etc."
              value={makeupShade}
              onChangeText={setMakeupShade}
            />
            <Text style={[styles.label, { marginTop: 10 }]}>
              Expiration Date *
            </Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: expirationDate ? "#000" : "#6b7280" }}>
                {expirationDate
                  ? new Date(expirationDate).toLocaleDateString()
                  : "Select expiration date"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={expirationDate ? new Date(expirationDate) : new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setExpirationDate(selectedDate.toISOString().split("T")[0]);
                  }
                }}
              />
            )}
          </View>
        )}

        {/* Food expiration date */}
        {itemCategory === "Foods" && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Expiration Date *</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: expirationDate ? "#000" : "#6b7280" }}>
                {expirationDate
                  ? new Date(expirationDate).toLocaleDateString()
                  : "Select expiration date"}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={expirationDate ? new Date(expirationDate) : new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setExpirationDate(selectedDate.toISOString().split("T")[0]);
                  }
                }}
              />
            )}
            {expirationDate && (
              <Text style={styles.helperText}>
                {new Date(expirationDate) > new Date()
                  ? `Expires in ${Math.ceil((new Date(expirationDate) - new Date()) / (1000 * 60 * 60 * 24))} days`
                  : "Expired"}
              </Text>
            )}
          </View>
        )}

        {/* Essential Type - For essentials */}
        {itemCategory === "Essentials" && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Essential Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={essentialType}
                onValueChange={(itemValue) => setEssentialType(itemValue)}
                style={styles.picker}
                dropdownIconColor="#6b7280"
                mode="dropdown"
              >
                <Picker.Item label="Select essential type" value="" />
                <Picker.Item label="Acne Cleaner" value="Acne Cleaner" />
                <Picker.Item label="Face Wash" value="Face Wash" />
                <Picker.Item label="Moisturizer" value="Moisturizer" />
                <Picker.Item label="Sunscreen" value="Sunscreen" />
                <Picker.Item label="Toner" value="Toner" />
                <Picker.Item label="Serum" value="Serum" />
                <Picker.Item label="Face Mask" value="Face Mask" />
                <Picker.Item label="Body Lotion" value="Body Lotion" />
                <Picker.Item label="Food" value="Food" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
            {essentialType === "Other" && (
              <View style={[styles.inputContainer, { marginTop: 10 }]}>
                <Text style={styles.label}>Please specify *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter essential type"
                  value={customEssentialType}
                  onChangeText={setCustomEssentialType}
                />
              </View>
            )}
            <View style={[styles.inputContainer, { marginTop: 10 }]}>
              <Text style={styles.label}>Expiration Date (optional)</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowEssentialDatePicker(true)}
              >
                <Text
                  style={{
                    color: essentialExpirationDate ? "#000" : "#6b7280",
                  }}
                >
                  {essentialExpirationDate
                    ? new Date(essentialExpirationDate).toLocaleDateString()
                    : "Select expiration date (optional)"}
                </Text>
              </TouchableOpacity>
              {showEssentialDatePicker && (
                <DateTimePicker
                  value={
                    essentialExpirationDate
                      ? new Date(essentialExpirationDate)
                      : new Date()
                  }
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={(event, selectedDate) => {
                    setShowEssentialDatePicker(false);
                    if (selectedDate) {
                      setEssentialExpirationDate(
                        selectedDate.toISOString().split("T")[0],
                      );
                    }
                  }}
                />
              )}
            </View>
          </View>
        )}

        {/* Accessory Type - For accessories */}
        {itemCategory === "Accessories" && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Accessory Type *</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={accessoryType}
                onValueChange={(itemValue) => setAccessoryType(itemValue)}
                style={styles.picker}
                dropdownIconColor="#6b7280"
                mode="dropdown"
              >
                <Picker.Item label="Select accessory type" value="" />
                <Picker.Item
                  label="Keychains / Anik-anik"
                  value="Keychains / Anik-anik"
                />
                <Picker.Item label="Rings" value="Rings" />
                <Picker.Item label="Necklace" value="Necklace" />
                <Picker.Item label="Bracelet" value="Bracelet" />
              </Picker>
            </View>
          </View>
        )}

        {/* Cost Price */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Cost Price (₱)</Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencySymbol}>₱</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="0.00"
              keyboardType="numeric"
              value={costPrice}
              onChangeText={setCostPrice}
            />
          </View>
        </View>

        {/* Selling Price */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Selling Price (₱) *</Text>
          <View style={styles.priceInputContainer}>
            <Text style={styles.currencySymbol}>₱</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="0.00"
              keyboardType="numeric"
              value={sellingPrice}
              onChangeText={setSellingPrice}
            />
          </View>
        </View>

        {/* Item Stock - Only show when no sizes are selected */}
        {selectedSizes.length === 0 && (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Stock Quantity *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter stock quantity"
              keyboardType="numeric"
              value={itemStock}
              onChangeText={setItemStock}
            />
          </View>
        )}

        {/* Display in Terminal Toggle */}
        <View style={styles.inputContainer}>
          <View style={styles.switchContainer}>
            <View>
              <Text style={styles.switchLabel}>Display in Terminal</Text>
              <Text style={styles.switchSubLabel}>
                Show this product in POS/terminal
              </Text>
            </View>
            <Switch
              value={isForPOS}
              onValueChange={setIsForPOS}
              trackColor={{ false: "#767577", true: "#AD7F65" }}
              thumbColor={isForPOS ? "#fff" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.addButton,
            isLoading && styles.disabledButton,
            { marginBottom: 20 },
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>
              {isEditing ? "Update Item" : "Add Item"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: "center",
    color: "#555",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  confirmButton: {
    backgroundColor: "#AD7F65",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  toastContainer: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  toastContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  toastIcon: {
    marginRight: 12,
  },
  toastText: {
    fontSize: 14,
    color: "#1f2937",
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: "#AD7F65",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    marginLeft: 8,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  imageUploadContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  imageContainer: {
    width: "100%",
    height: 300,
    alignSelf: "center",
    marginBottom: 20,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  imageError: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#f8d7da",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 20,
  },
  cameraIconContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: "#6b7280",
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
    justifyContent: "center",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    color: "#1f2937",
  },
  priceInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
  },
  currencySymbol: {
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#6b7280",
  },
  addButton: {
    backgroundColor: "#8B4513",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
    elevation: 3,
    shadowColor: "#5D2D0C",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  addButtonText: {
    color: "#FFF8DC",
    fontSize: 16,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  // Multi-size selection styles
  sizeCheckboxGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  sizeCheckboxItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "50%",
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#AD7F65",
    borderColor: "#AD7F65",
  },
  sizeCheckboxLabel: {
    fontSize: 14,
    color: "#374151",
  },
  sizeQuantityContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  sizeQuantityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  sizeQuantityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  sizeQuantityItem: {
    width: "50%",
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  sizeQuantityLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  sizeQuantityInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  differentPricesRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  disabledInput: {
    backgroundColor: "#f3f4f6",
    color: "#9ca3af",
  },
  disabledPicker: {
    opacity: 0.5,
  },
  sizeVariantItem: {
    width: "100%",
    paddingHorizontal: 6,
    marginBottom: 20,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  multiVariantContainer: {
    marginTop: 8,
  },
  variantChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
    minHeight: 30,
  },
  variantChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#AD7F65",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  variantChipText: {
    color: "#fff",
    fontSize: 13,
    marginRight: 6,
  },
  differentPricesLabel: {
    fontSize: 14,
    color: "#374151",
    marginLeft: 4,
  },
  sizePriceRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 8,
  },
  sizePriceItem: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  switchSubLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
});

export default AddItem;
