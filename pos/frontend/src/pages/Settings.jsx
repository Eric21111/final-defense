import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from
  "react";
import {
  FaBox,
  FaCamera,
  FaCheckCircle,
  FaCog,
  FaDatabase,
  FaDownload,
  FaEye,
  FaEyeSlash,
  FaInfoCircle,
  FaKey,
  FaLink,
  FaPalette,
  FaReceipt,
  FaShieldAlt,
  FaSpinner,
  FaSync,
  FaTimesCircle,
  FaTrash,
  FaUndo,
  FaUser
} from
  "react-icons/fa";
import { useNavigate } from "react-router-dom";
import defaultAvatar from "../assets/default.jpeg";
import SuccessModal from "../components/inventory/SuccessModal";
import Header from "../components/shared/header";
import { API_BASE_URL as API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { useDataCache } from "../context/DataCacheContext";
import { SidebarContext } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import {
  DEFAULT_RECEIPT_PROFILE,
  mapGlobalSettingsToReceiptCache,
  setReceiptProfileCache
} from "../utils/receiptProfile";
import { getTerminalId, setTerminalId } from "../utils/terminalIdentity";

const PRODUCTS_BUMP_KEY = "pos-products-bump";

const Settings = () => {
  const { isExpanded } = useContext(SidebarContext);
  const { isOwner, currentUser, login } = useAuth();
  const { theme, setTheme } = useTheme();
  const { invalidateCache } = useDataCache();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("personal");
  const [currentPin, setCurrentPin] = useState(["", "", "", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", "", "", ""]);
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [dateJoined, setDateJoined] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [permissions, setPermissions] = useState({
    posTerminal: false,
    viewTransactions: false
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [archives, setArchives] = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [selectedArchiveIds, setSelectedArchiveIds] = useState([]);
  const [bulkArchivesLoading, setBulkArchivesLoading] = useState(false);
  const [showBulkRestoreModal, setShowBulkRestoreModal] = useState(false);
  const [showBulkClearModal, setShowBulkClearModal] = useState(false);
  const selectAllArchivesRef = useRef(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [showClearArchiveModal, setShowClearArchiveModal] = useState(false);
  const [clearArchivesLoading, setClearArchivesLoading] = useState(false);
  const [exportArchivesLoading, setExportArchivesLoading] = useState(false);
  const fileInputRef = useRef(null);


  const isDark = theme === "dark";
  const [appId, setAppId] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [gcashEnvironment, setGcashEnvironment] = useState("sandbox");
  const [merchantName, setMerchantName] = useState("POS System");
  const [paymentExpiryMinutes, setPaymentExpiryMinutes] = useState(15);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [gcashLoading, setGcashLoading] = useState(false);
  const [gcashSaving, setGcashSaving] = useState(false);
  const [gcashTesting, setGcashTesting] = useState(false);
  const [gcashDeleting, setGcashDeleting] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [gcashMessage, setGcashMessage] = useState({ type: "", text: "" });
  const [lastUpdated, setLastUpdated] = useState(null);

  const [receiptForm, setReceiptForm] = useState(() => ({ ...DEFAULT_RECEIPT_PROFILE }));
  const [terminalIdLocal, setTerminalIdLocal] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      const fallbackFirst =
        currentUser.firstName || currentUser.name?.split(" ")[0] || "";
      const fallbackLast =
        currentUser.lastName ||
        currentUser.name?.split(" ").slice(1).join(" ") ||
        "";
      const fallbackMiddle =
        currentUser.middleInitial ||
        (currentUser.name?.split(" ").length >= 3
          ? currentUser.name.split(" ")[1].replace(".", "")
          : "");

      setFirstName(fallbackFirst);
      setMiddleInitial(fallbackMiddle.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase());
      setLastName(fallbackLast);
      setEmail(currentUser.email || "");
      setContactNumber(currentUser.contactNo || "");
      setRole(currentUser.role || "");
      setStatus(currentUser.status || "Active");
      const userId = currentUser._id || currentUser.id;
      setProfileImage(
        (currentUser.image?.startsWith('data:image') || currentUser.profileImage?.startsWith('data:image'))
          ? (currentUser.image || currentUser.profileImage)
          : userId
            ? `${API_BASE}/api/employees/${userId}/image?v=${new Date(currentUser.updatedAt || currentUser.lastUpdated || 0).getTime()}`
            : defaultAvatar
      );
      setPermissions(
        currentUser.permissions || {
          posTerminal: false,
          viewTransactions: false
        }
      );

      if (currentUser.dateJoinedActual || currentUser.dateJoined) {
        const date = new Date(
          currentUser.dateJoinedActual || currentUser.dateJoined
        );
        setDateJoined(
          date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit"
          })
        );
      }
    }
  }, [currentUser]);


  const fetchGcashSettings = useCallback(async () => {
    try {
      setGcashLoading(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings`);
      const data = await response.json();

      if (data.success && data.data) {
        const settings = data.data;
        setAppId(settings.appId || "");
        setPublicKey(settings.publicKey || "");
        setGcashEnvironment(settings.environment || "sandbox");
        setMerchantName(settings.merchantName || "POS System");
        setPaymentExpiryMinutes(settings.paymentExpiryMinutes || 15);
        setWebhookUrl(settings.webhookUrl || "");
        setIsConfigured(true);
        setLastUpdated(settings.updatedAt || settings.createdAt);
        setPrivateKey("");
      } else {
        setIsConfigured(false);
      }
    } catch (error) {
      console.error("Error fetching GCash settings:", error);
      setGcashMessage({
        type: "error",
        text: "Failed to load settings. Is the backend running?"
      });
    } finally {
      setGcashLoading(false);
    }
  }, []);

  const archiveRowId = (a) => String(a._id || a.id);

  const restoreTargetIds = useMemo(
    () =>
      selectedArchiveIds.length > 0
        ? selectedArchiveIds
        : archives.map(archiveRowId),
    [selectedArchiveIds, archives]
  );

  const fetchArchives = useCallback(async () => {
    setArchivesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/archive`, {
        cache: "no-store"
      });
      const data = await response.json();

      if (data.success) {
        setArchives(data.data || []);
      } else {
        setArchives([]);
      }
    } catch (error) {
      console.error("Error fetching archives:", error);
      setArchives([]);
    } finally {
      setArchivesLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedArchiveIds((prev) =>
      prev.filter((id) => archives.some((a) => archiveRowId(a) === id))
    );
  }, [archives]);

  useEffect(() => {
    const el = selectAllArchivesRef.current;
    if (!el) return;
    const n = selectedArchiveIds.length;
    const t = archives.length;
    el.indeterminate = t > 0 && n > 0 && n < t;
  }, [selectedArchiveIds, archives.length]);

  const toggleArchiveRowSelect = (id) => {
    const s = String(id);
    setSelectedArchiveIds((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const toggleSelectAllArchives = () => {
    if (!archives.length || archivesLoading) return;
    if (selectedArchiveIds.length === archives.length) {
      setSelectedArchiveIds([]);
    } else {
      setSelectedArchiveIds(archives.map((a) => archiveRowId(a)));
    }
  };

  const handleBulkRestore = async () => {
    const ids =
      selectedArchiveIds.length > 0
        ? [...selectedArchiveIds]
        : archives.map((a) => archiveRowId(a));
    if (ids.length === 0) return;
    setBulkArchivesLoading(true);
    setError("");
    try {
      const removed = [];
      const failed = [];
      for (const id of ids) {
        const res = await fetch(`${API_BASE}/api/archive/${id}/restore`, {
          method: "POST",
          cache: "no-store"
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          removed.push(id);
        } else {
          failed.push(data.message || "Restore failed");
        }
      }
      await fetchArchives();
      setSelectedArchiveIds((prev) => prev.filter((id) => !removed.includes(id)));
      setShowBulkRestoreModal(false);
      if (removed.length > 0) {
        invalidateCache("products");
        try {
          localStorage.setItem(PRODUCTS_BUMP_KEY, String(Date.now()));
        } catch (e) {
          /* ignore */
        }
        window.dispatchEvent(new CustomEvent("pos-invalidate-products"));
      }
      if (failed.length === 0) {
        setSuccessMessage(
          removed.length === 1
            ? "Item restored to inventory."
            : `Restored ${removed.length} items.`
        );
      } else {
        setSuccessMessage(
          `Restored ${removed.length}. Failed: ${failed.slice(0, 3).join("; ")}${failed.length > 3 ? "…" : ""}`
        );
      }
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      setError("Could not complete restore. Try again.");
    } finally {
      setBulkArchivesLoading(false);
    }
  };

  const handleBulkClearArchives = async () => {
    if (selectedArchiveIds.length === 0) return;
    setBulkArchivesLoading(true);
    setError("");
    try {
      const ids = [...selectedArchiveIds];
      const removed = [];
      const failed = [];
      for (const id of ids) {
        const res = await fetch(`${API_BASE}/api/archive/${id}`, {
          method: "DELETE",
          cache: "no-store"
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) {
          removed.push(id);
        } else {
          failed.push(data.message || "Delete failed");
        }
      }
      await fetchArchives();
      setSelectedArchiveIds((prev) => prev.filter((id) => !removed.includes(id)));
      setShowBulkClearModal(false);
      if (failed.length === 0) {
        setSuccessMessage(
          removed.length === 1
            ? "Archive entry removed."
            : `Removed ${removed.length} archive entries.`
        );
      } else {
        setSuccessMessage(
          `Removed ${removed.length}. Failed: ${failed.slice(0, 3).join("; ")}${failed.length > 3 ? "…" : ""}`
        );
      }
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      setError("Could not remove entries. Try again.");
    } finally {
      setBulkArchivesLoading(false);
    }
  };

  const handleGcashSave = async (e) => {
    e.preventDefault();
    setGcashMessage({ type: "", text: "" });

    if (!appId.trim() || !publicKey.trim()) {
      setGcashMessage({
        type: "error",
        text: "App ID and Public Key are required."
      });
      return;
    }

    if (!isConfigured && !privateKey.trim()) {
      setGcashMessage({
        type: "error",
        text: "Private Key is required for initial setup."
      });
      return;
    }

    if (isConfigured && !privateKey.trim()) {
      setGcashMessage({
        type: "error",
        text: "Please re-enter your Private Key to save changes."
      });
      return;
    }

    try {
      setGcashSaving(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: appId.trim(),
          privateKey: privateKey.trim(),
          publicKey: publicKey.trim(),
          environment: gcashEnvironment,
          merchantName: merchantName.trim(),
          paymentExpiryMinutes,
          configuredBy: currentUser?._id || currentUser?.id || "",
          configuredByName: currentUser?.name || ""
        })
      });

      const data = await response.json();

      if (data.success) {
        setGcashMessage({
          type: "success",
          text: "Payment gateway configured successfully!"
        });
        setPrivateKey("");
        setIsConfigured(true);
        if (data.data?.webhookUrl) setWebhookUrl(data.data.webhookUrl);
        setLastUpdated(new Date().toISOString());
      } else {
        setGcashMessage({
          type: "error",
          text: data.message || "Failed to save settings."
        });
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setGcashMessage({
        type: "error",
        text: "Network error. Please try again."
      });
    } finally {
      setGcashSaving(false);
    }
  };

  const handleGcashTestConnection = async () => {
    setGcashMessage({ type: "", text: "" });

    if (!isConfigured) {
      setGcashMessage({
        type: "error",
        text: "Please save your credentials first before testing."
      });
      return;
    }

    try {
      setGcashTesting(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings/test`, {
        method: "POST"
      });
      const data = await response.json();

      if (data.success) {
        setGcashMessage({ type: "success", text: `✅ ${data.message}` });
      } else {
        setGcashMessage({
          type: "error",
          text: data.message || "Connection test failed."
        });
      }
    } catch (error) {
      setGcashMessage({ type: "error", text: "Unable to test connection." });
    } finally {
      setGcashTesting(false);
    }
  };

  const handleGcashDelete = async () => {
    if (
      !window.confirm(
        "Are you sure you want to remove the payment gateway configuration? GCash payments will be disabled."
      )) {
      return;
    }

    try {
      setGcashDeleting(true);
      const response = await fetch(`${API_BASE}/api/merchant-settings`, {
        method: "DELETE"
      });
      const data = await response.json();

      if (data.success) {
        setGcashMessage({
          type: "success",
          text: "Configuration removed successfully."
        });
        setAppId("");
        setPrivateKey("");
        setPublicKey("");
        setGcashEnvironment("sandbox");
        setMerchantName("POS System");
        setWebhookUrl("");
        setIsConfigured(false);
        setLastUpdated(null);
      } else {
        setGcashMessage({
          type: "error",
          text: data.message || "Failed to remove configuration."
        });
      }
    } catch (error) {
      setGcashMessage({ type: "error", text: "Network error." });
    } finally {
      setGcashDeleting(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "archives") return;
    fetchArchives();
    const intervalMs = 25000;
    const id = setInterval(() => {
      fetchArchives();
    }, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchArchives();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [activeTab, fetchArchives]);

  useEffect(() => {
    if (activeTab === "gcash") {
      fetchGcashSettings();
    }
  }, [activeTab, fetchGcashSettings]);

  const fetchReceiptSettings = useCallback(async () => {
    setReceiptLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/global-settings`, { cache: "no-store" });
      const data = await response.json();
      if (data.success && data.data) {
        setReceiptForm(mapGlobalSettingsToReceiptCache(data.data));
        setTerminalIdLocal(getTerminalId());
      }
    } catch (error) {
      console.error("Error loading receipt settings:", error);
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "receipt" && isOwner()) {
      fetchReceiptSettings();
    }
  }, [activeTab, fetchReceiptSettings, isOwner]);

  useEffect(() => {
    if (
      !isOwner() &&
      (activeTab === "receipt" || activeTab === "gcash" || activeTab === "archives")
    ) {
      setActiveTab("personal");
    }
  }, [isOwner, activeTab]);

  const handleReceiptSave = async (e) => {
    e.preventDefault();
    if (!isOwner()) return;
    setReceiptSaving(true);
    setError("");
    try {
      const normalized = mapGlobalSettingsToReceiptCache(receiptForm);
      const response = await fetch(`${API_BASE}/api/global-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: normalized.storeName,
          receiptTagline: normalized.receiptTagline,
          receiptAddress: normalized.receiptAddress,
          receiptContactNumber: normalized.receiptContactNumber,
          receiptThankYouMessage: normalized.receiptThankYouMessage,
          receiptDisclaimer: normalized.receiptDisclaimer,
          birCompliantEnabled: normalized.birCompliantEnabled,
          storeTin: normalized.storeTin,
          ptuNumber: normalized.ptuNumber,
          vatRatePercent: normalized.vatRatePercent
        })
      });
      const data = await response.json();
      if (data.success) {
        const savedTerm = setTerminalId(terminalIdLocal);
        setTerminalIdLocal(savedTerm);
        setReceiptForm(mapGlobalSettingsToReceiptCache(data.data));
        setReceiptProfileCache(data.data);
        setSuccessMessage("Receipt layout saved. New print-outs will use these details.");
        setShowSuccessModal(true);
      } else {
        setError(data.message || "Could not save receipt settings.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not save receipt settings. Is the backend running?");
    } finally {
      setReceiptSaving(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const handlePinInput = (value, index, type) => {
    if (value && !/^\d$/.test(value)) return;

    const updatedPin = [
      ...(type === "current" ?
        currentPin :
        type === "new" ?
          newPin :
          confirmPin)];

    updatedPin[index] = value;

    if (type === "current") {
      setCurrentPin(updatedPin);
    } else if (type === "new") {
      setNewPin(updatedPin);
    } else {
      setConfirmPin(updatedPin);
    }

    if (value && index < 5) {
      const nextInput = document.getElementById(`${type}-pin-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newImageData = reader.result;
      setProfileImage(newImageData);
      setError("");
      handleAutoSaveProfileImage(newImageData);
    };
    reader.readAsDataURL(file);
  };

  const saveProfile = async (overrides = {}) => {
    if (!currentUser?._id && !currentUser?.id) {
      setError("User not found");
      return;
    }

    const mergedProfile = {
      firstName: overrides.firstName ?? firstName,
      middleInitial: overrides.middleInitial ?? middleInitial,
      lastName: overrides.lastName ?? lastName,
      email: overrides.email ?? email,
      contactNumber: overrides.contactNumber ?? contactNumber,
      profileImage: overrides.profileImage ?? profileImage,
      image: overrides.image ?? overrides.profileImage ?? profileImage
    };

    if (!mergedProfile.firstName?.trim() || !mergedProfile.lastName?.trim()) {
      setError("First name and last name are required");
      return;
    }

    if (!mergedProfile.email?.trim()) {
      setError("Email is required");
      return;
    }

    setProfileLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/employees/${currentUser._id || currentUser.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: mergedProfile.firstName.trim(),
            middleInitial: mergedProfile.middleInitial,
            lastName: mergedProfile.lastName.trim(),
            name: [mergedProfile.firstName, mergedProfile.middleInitial, mergedProfile.lastName]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' ')
              .trim(),
            email: mergedProfile.email.trim().toLowerCase(),
            contactNo: mergedProfile.contactNumber.trim(),
            profileImage: mergedProfile.profileImage,
            image: mergedProfile.image
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Profile updated successfully!");
        setShowSuccessModal(true);
        const apiUser = data.data || {};
        const finalProfileImage =
          apiUser.profileImage || apiUser.image || mergedProfile.profileImage;

        const updatedUser = {
          ...currentUser,
          ...apiUser,
          firstName: apiUser.firstName ?? mergedProfile.firstName.trim(),
          middleInitial: apiUser.middleInitial ?? mergedProfile.middleInitial,
          lastName: apiUser.lastName ?? mergedProfile.lastName.trim(),
          name:
            apiUser.name ??
            [mergedProfile.firstName, mergedProfile.middleInitial, mergedProfile.lastName]
              .map((p) => String(p ?? '').trim())
              .filter(Boolean)
              .join(' ')
              .trim(),
          email: apiUser.email ?? mergedProfile.email.trim().toLowerCase(),
          contactNo: apiUser.contactNo ?? mergedProfile.contactNumber.trim(),
          profileImage: finalProfileImage,
          image: finalProfileImage
        };
        login(updatedUser);
      } else {
        setError(data.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile. Please try again.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAutoSaveProfileImage = async (imageData) => {
    await saveProfile({ profileImage: imageData, image: imageData });
  };

  const handleUpdatePin = async () => {
    const currentPinValue = currentPin.join("");
    const newPinValue = newPin.join("");
    const confirmPinValue = confirmPin.join("");

    if (currentPinValue.length !== 6) {
      setError("Please enter your current 6-digit PIN");
      return;
    }

    if (newPinValue.length !== 6) {
      setError("New PIN must be 6 digits");
      return;
    }

    if (newPinValue !== confirmPinValue) {
      setError("New PIN and Confirm PIN do not match!");
      return;
    }

    if (!currentUser?._id && !currentUser?.id) {
      setError("User not found");
      return;
    }

    setPinLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/api/employees/${currentUser._id || currentUser.id}/pin`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPin: currentPinValue,
            newPin: newPinValue,
            requiresPinReset: false
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("PIN updated successfully!");
        setShowSuccessModal(true);
        setCurrentPin(["", "", "", "", "", ""]);
        setNewPin(["", "", "", "", "", ""]);
        setConfirmPin(["", "", "", "", "", ""]);
        if (data.data) {
          login({ ...currentUser, ...data.data });
        }
      } else {
        setError(data.message || "Failed to update PIN");
      }
    } catch (error) {
      console.error("Error updating PIN:", error);
      setError("Failed to update PIN. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleSyncData = async () => {
    setSyncLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/sync/all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();

      if (data.success) {
        setSuccessMessage(data.message || "Data synchronized successfully!");
        setShowSuccessModal(true);
      } else {
        setSuccessMessage("");
        alert(data.message || "Sync failed. Please try again.");
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert(
        "Sync failed. Make sure you are connected to the internet and the server is running."
      );
    } finally {
      setSyncLoading(false);
    }
  };

  const computedName = useMemo(() => {
    return (
      [firstName, middleInitial, lastName].filter(Boolean).join(" ") ||
      currentUser?.name ||
      "");
  }, [firstName, middleInitial, lastName, currentUser?.name]);

  const handleClearArchives = async () => {
    setClearArchivesLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/archive/all`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (data.success) {
        setSuccessMessage(data.message || "All archives cleared successfully!");
        setShowSuccessModal(true);
        setArchives([]);
        setSelectedArchiveIds([]);
        setShowClearArchiveModal(false);
      } else {
        setError(data.message || "Failed to clear archives");
      }
    } catch (error) {
      console.error("Error clearing archives:", error);
      setError("Failed to clear archives. Please try again.");
    } finally {
      setClearArchivesLoading(false);
    }
  };

  const handleExportArchives = async () => {
    setExportArchivesLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/archive?limit=1000000000&sortBy=date-desc`
      );
      const data = await response.json();

      if (data.success && data.data) {
        const archivesToExport = data.data;

        if (archivesToExport.length === 0) {
          setError("No archives available to export.");
          return;
        }

        const headers = [
          "Archive Number",
          "SKU",
          "Item Name",
          "Category",
          "Quantity",
          "Price",
          "Reason",
          "Date & Time",
          "Archived By",
          "Notes"];


        const csvContent = [
          headers.join(","),
          ...archivesToExport.map((archive, index) => {
            return [
              archivesToExport.length - index,
              `"${archive.sku || ""}"`,
              `"${archive.itemName || ""}"`,
              `"${archive.category || ""}"`,
              archive.quantity || 0,
              archive.itemPrice || 0,
              `"${archive.reason || ""} ${archive.returnReason || ""}"`,
              `"${formatDateTime(archive.archivedAt)}"`,
              `"${archive.archivedBy || ""}"`,
              `"${archive.notes || ""}"`].
              join(",");
          })].
          join("\n");

        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;"
        });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `archives_export_${new Date().toISOString().split("T")[0]}.csv`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setError("Failed to fetch archives for export.");
      }
    } catch (error) {
      console.error("Error exporting archives:", error);
      setError("Failed to export archives. Please try again.");
    } finally {
      setExportArchivesLoading(false);
    }
  };

  return (
    <div
      className={`p-8 min-h-screen ${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}>

      <Header pageName="Settings" showBorder={false} />

      {isOwner() &&
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => setActiveTab("personal")}
            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md ${activeTab === "personal" ?
                `text-[#AD7F65] border-b-4 border-[#AD7F65] ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}` :
                `${theme === "dark" ? "bg-[#2A2724] text-gray-300 border border-gray-700" : "bg-white text-gray-800 border border-gray-200"}`}`
            }>

            Account
          </button>
          <button
            onClick={() => setActiveTab("archives")}
            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md ${activeTab === "archives" ?
                `text-[#AD7F65] border-b-4 border-[#AD7F65] ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}` :
                `${theme === "dark" ? "bg-[#2A2724] text-gray-300 border border-gray-700" : "bg-white text-gray-800 border border-gray-200"}`}`
            }>

            Archives
          </button>
          <button
            onClick={() => setActiveTab("gcash")}
            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md ${activeTab === "gcash" ?
                `text-[#AD7F65] border-b-4 border-[#AD7F65] ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}` :
                `${theme === "dark" ? "bg-[#2A2724] text-gray-300 border border-gray-700" : "bg-white text-gray-800 border border-gray-200"}`}`
            }>

            GCash Configuration
          </button>
          <button
            onClick={() => setActiveTab("receipt")}
            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md flex items-center gap-2 ${activeTab === "receipt" ?
                `text-[#AD7F65] border-b-4 border-[#AD7F65] ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}` :
                `${theme === "dark" ? "bg-[#2A2724] text-gray-300 border border-gray-700" : "bg-white text-gray-800 border border-gray-200"}`}`
            }>

            <FaReceipt className="w-4 h-4" />
            Receipt
          </button>
          <button
            onClick={() => navigate("/manage-data")}
            className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md flex items-center gap-2 ${theme === "dark" ? "bg-[#2A2724] text-gray-300 border border-gray-700 hover:border-[#AD7F65]" : "bg-white text-gray-800 border border-gray-200 hover:border-[#AD7F65]"}`}>

            <FaDatabase className="w-4 h-4" />
            Manage Data
          </button>
        </div>
      }

      {activeTab === "gcash" ? (

        gcashLoading ?
          <div className="flex items-center justify-center min-h-[60vh]">
            <FaSpinner className="w-8 h-8 text-[#8B7355] animate-spin" />
          </div> :

          <div className="max-w-2xl mx-auto mt-6">
            { }
            <div
              className={`rounded-3xl shadow-lg overflow-hidden ${isDark ? "bg-[#2A2724]" : "bg-white"}`}>

              { }
              <div className="px-8 pt-8 pb-4">
                <div className="flex items-center gap-4 mb-1">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C2A68C] via-[#AD7F65] to-[#76462B] flex items-center justify-center shadow-md">
                    <FaCog className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3
                      className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>

                      Payment Gateway
                    </h3>
                    <p
                      className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>

                      {isConfigured ?
                        <>
                          Connected ·{" "}
                          <span className="text-green-500 font-medium">
                            {gcashEnvironment.toUpperCase()}
                          </span>
                          {lastUpdated &&
                            ` · Updated ${new Date(lastUpdated).toLocaleDateString()}`}
                        </> :

                        "Enter your GCash for Business/PayMongo credentials below"
                      }
                    </p>
                  </div>
                  {isConfigured &&
                    <div className="ml-auto">
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Active
                      </span>
                    </div>
                  }
                </div>
              </div>

              <div className="px-8 pb-4">
                <div
                  className={`rounded-xl p-4 flex items-start gap-3 ${isDark ? "bg-amber-900/15 border border-amber-800/40" : "bg-amber-50 border border-amber-100"}`}>
                  <FaInfoCircle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${isDark ? "text-amber-400" : "text-amber-600"}`}
                  />
                  <p
                    className={`text-sm leading-relaxed ${isDark ? "text-amber-100/90" : "text-amber-900/90"}`}>
                    If you want to configure GCash, contact the developer for this.
                  </p>
                </div>
              </div>

              { }
              <div className="px-8 pb-4">
                <div
                  className={`rounded-xl p-4 flex items-start gap-3 ${isDark ? "bg-blue-900/10 border border-blue-900/30" : "bg-blue-50/70 border border-blue-100"}`}>

                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#42A5F5] to-[#1565C0] flex items-center justify-center shrink-0 mt-0.5">
                    <FaShieldAlt className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p
                      className={`text-sm font-semibold mb-0.5 ${isDark ? "text-blue-300" : "text-blue-800"}`}>

                      Security
                    </p>
                    <p
                      className={`text-xs leading-relaxed ${isDark ? "text-blue-400/70" : "text-blue-600/80"}`}>

                      Your private key is encrypted with AES-256-GCM before
                      storage and is never exposed to the front-end after
                      saving. All payment communications use HTTPS. Webhook
                      signatures are verified using HMAC-SHA256.
                    </p>
                  </div>
                </div>
              </div>

              { }
              <form onSubmit={handleGcashSave}>
                <div className="px-8 pb-8 space-y-5">
                  { }
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                      App ID / API Key ID
                    </label>
                    <input
                      type="text"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      placeholder="pk_test_xxxxxxxxxxxxxxxxxxxx"
                      className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#42A5F5] transition-all ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                      required />

                    <p
                      className={`text-xs mt-1.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>

                      Your PayMongo public API key
                    </p>
                  </div>

                  { }
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                      Secret Key (Private Key)
                    </label>
                    <div className="relative">
                      <input
                        type={showPrivateKey ? "text" : "password"}
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder={
                          isConfigured ?
                            "••••••••••••••• (re-enter to update)" :
                            "sk_test_xxxxxxxxxxxxxxxxxxxx"
                        }
                        className={`w-full px-4 py-3 pr-12 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#42A5F5] transition-all ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                        required={!isConfigured} />

                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${isDark ? "text-gray-400 hover:text-gray-300 hover:bg-gray-700" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}>

                        {showPrivateKey ?
                          <FaEyeSlash className="w-4 h-4" /> :

                          <FaEye className="w-4 h-4" />
                        }
                      </button>
                    </div>
                    <p
                      className={`text-xs mt-1.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>

                      Your PayMongo secret key — encrypted before storage, never
                      exposed after save
                    </p>
                  </div>

                  { }
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                      Public Key
                    </label>
                    <input
                      type="text"
                      value={publicKey}
                      onChange={(e) => setPublicKey(e.target.value)}
                      placeholder="pk_test_xxxxxxxxxxxxxxxxxxxx"
                      className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#42A5F5] transition-all ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                      required />

                  </div>

                  { }
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                      Environment
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setGcashEnvironment("sandbox")}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${gcashEnvironment === "sandbox" ?
                            "bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-md shadow-yellow-200/40" :
                            isDark ?
                              "bg-[#1E1B18] border border-gray-600 text-gray-400 hover:border-gray-500" :
                              "bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-150"}`
                        }>

                        SandBox
                      </button>
                      <button
                        type="button"
                        onClick={() => setGcashEnvironment("production")}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${gcashEnvironment === "production" ?
                            "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-md shadow-green-200/40" :
                            isDark ?
                              "bg-[#1E1B18] border border-gray-600 text-gray-400 hover:border-gray-500" :
                              "bg-gray-100 border border-gray-200 text-gray-500 hover:bg-gray-150"}`
                        }>

                        Production
                      </button>
                    </div>
                  </div>

                  { }
                  <div>
                    <label
                      className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                      Merchant Display Name
                    </label>
                    <input
                      type="text"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      placeholder="Your Store Name"
                      className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#42A5F5] transition-all ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`} />

                  </div>

                  { }
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label
                        className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Payment Expiry (minutes)
                      </label>
                      <span
                        className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>

                        QR codes expires after this many minutes (5–60)
                      </span>
                    </div>
                    <input
                      type="number"
                      value={paymentExpiryMinutes}
                      onChange={(e) =>
                        setPaymentExpiryMinutes(
                          Math.min(
                            60,
                            Math.max(5, parseInt(e.target.value) || 15)
                          )
                        )
                      }
                      min="5"
                      max="60"
                      className={`w-28 mt-2 px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#42A5F5] transition-all ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`} />

                  </div>

                  { }
                  {webhookUrl &&
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        <FaLink className="inline w-3 h-3 mr-1.5" /> Webhook URL
                        (auto-generated)
                      </label>
                      <div
                        className={`w-full px-4 py-3 border rounded-xl font-mono text-xs break-all ${isDark ? "bg-[#1E1B18] border-gray-600 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-600"}`}>

                        {webhookUrl}
                      </div>
                      <p
                        className={`text-xs mt-1.5 ${isDark ? "text-gray-500" : "text-gray-400"}`}>

                        Register this URL in your PayMongo dashboard under
                        Webhooks → Source Chargeable
                      </p>
                    </div>
                  }

                  { }
                  {gcashMessage.text &&
                    <div
                      className={`rounded-xl p-3.5 flex items-center gap-2.5 ${gcashMessage.type === "success" ? isDark ? "bg-green-900/20 text-green-400 border border-green-800" : "bg-green-50 text-green-700 border border-green-200" : isDark ? "bg-red-900/20 text-red-400 border border-red-800" : "bg-red-50 text-red-700 border border-red-200"}`}>

                      {gcashMessage.type === "success" ?
                        <FaCheckCircle className="w-4 h-4 flex-shrink-0" /> :

                        <FaTimesCircle className="w-4 h-4 flex-shrink-0" />
                      }
                      <span className="text-sm font-medium">
                        {gcashMessage.text}
                      </span>
                    </div>
                  }

                  { }
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={gcashSaving}
                      className="w-64 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-200/30 hover:shadow-green-300/40">

                      {gcashSaving ?
                        <>
                          <FaSpinner className="w-4 h-4 animate-spin" />{" "}
                          Saving...
                        </> :
                        isConfigured ?
                          "Update Configuration" :

                          "Save Configuration"
                      }
                    </button>

                    {isConfigured &&
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleGcashTestConnection}
                          disabled={gcashTesting}
                          className={`py-2.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${isDark ? "bg-[#1E1B18] text-gray-300 hover:bg-[#322f2c] border border-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200"} disabled:opacity-50`}>

                          {gcashTesting ?
                            <FaSpinner className="w-3.5 h-3.5 animate-spin" /> :

                            "Test Connection"
                          }
                        </button>
                        <button
                          type="button"
                          onClick={handleGcashDelete}
                          disabled={gcashDeleting}
                          className="py-2.5 px-5 rounded-xl font-semibold text-sm text-red-500 hover:bg-red-50 border border-red-200 transition-all disabled:opacity-50 flex items-center gap-2">

                          <FaTrash className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    }
                  </div>
                </div>
              </form>
            </div>
          </div>) :

        isOwner() && activeTab === "receipt" ?
          receiptLoading ?
            <div className="flex items-center justify-center min-h-[60vh]">
              <FaSpinner className="w-8 h-8 text-[#8B7355] animate-spin" />
            </div> :

            <div className="max-w-5xl mx-auto mt-6">
              <div
                className={`rounded-3xl shadow-lg overflow-hidden ${isDark ? "bg-[#2A2724]" : "bg-white"}`}>

                <div className="px-8 pt-8 pb-6 flex items-start gap-4 border-b border-gray-200/10">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C2A68C] via-[#AD7F65] to-[#76462B] flex items-center justify-center shadow-md">
                    <FaReceipt className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3
                      className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>

                      Receipt management
                    </h3>
                    <p
                      className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>

                      Edit the store name, address, contact, tagline, and footer lines used on POS receipts and
                      browser print-outs.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleReceiptSave} className="px-8 pb-8 pt-6 grid lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Store name
                      </label>
                      <input
                        type="text"
                        value={receiptForm.storeName}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            storeName: e.target.value
                          }))
                        }
                        className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                        required
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Tagline
                        {" "}
                        <span className={`text-xs font-normal ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          (optional)
                        </span>
                      </label>
                      <input
                        type="text"
                        value={receiptForm.receiptTagline}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptTagline: e.target.value
                          }))
                        }
                        placeholder="e.g. Quality apparel since 2010"
                        className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Address
                      </label>
                      <input
                        type="text"
                        value={receiptForm.receiptAddress}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptAddress: e.target.value
                          }))
                        }
                        className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Contact number
                      </label>
                      <input
                        type="text"
                        value={receiptForm.receiptContactNumber}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptContactNumber: e.target.value
                          }))
                        }
                        className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Thank-you line
                      </label>
                      <input
                        type="text"
                        value={receiptForm.receiptThankYouMessage}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptThankYouMessage: e.target.value
                          }))
                        }
                        className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                      />
                    </div>
                    <div>
                      <label
                        className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                        Disclaimer
                      </label>
                      <textarea
                        rows={2}
                        value={receiptForm.receiptDisclaimer}
                        onChange={(e) =>
                          setReceiptForm((prev) => ({
                            ...prev,
                            receiptDisclaimer: e.target.value
                          }))
                        }
                        className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] resize-y min-h-[72px] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                      />
                    </div>

                    <div
                      className={`rounded-xl p-4 space-y-4 ${isDark ? "bg-[#252220] border border-gray-700" : "bg-amber-50/50 border border-amber-100"}`}>

                      <div>
                        <label
                          className={`block text-sm font-bold mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>

                          BIR-ready receipts
                        </label>
                        <p className={`text-xs mb-3 ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                          Receipt must be BIR-compliant — ready for registration: sequential receipt numbers tied to this
                          terminal, TIN & PTU on the slip, and VAT shown from VAT-inclusive totals (net + VAT = total).
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptForm((prev) => ({
                                ...prev,
                                birCompliantEnabled: true
                              }))
                            }
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${receiptForm.birCompliantEnabled ?
                                "bg-[#AD7F65] text-white shadow" :
                                isDark ?
                                  "bg-[#1E1B18] border border-gray-600 text-gray-400" :
                                  "bg-white border border-gray-200 text-gray-600"}`
                            }>

                            On
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptForm((prev) => ({
                                ...prev,
                                birCompliantEnabled: false
                              }))
                            }
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${!receiptForm.birCompliantEnabled ?
                                "bg-[#AD7F65] text-white shadow" :
                                isDark ?
                                  "bg-[#1E1B18] border border-gray-600 text-gray-400" :
                                  "bg-white border border-gray-200 text-gray-600"}`
                            }>

                            Off
                          </button>
                        </div>
                      </div>

                      <div>
                        <label
                          className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                          TIN (store)
                        </label>
                        <input
                          type="text"
                          value={receiptForm.storeTin}
                          onChange={(e) =>
                            setReceiptForm((prev) => ({
                              ...prev,
                              storeTin: e.target.value
                            }))
                          }
                          placeholder="000-000-000-000"
                          className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                        />
                      </div>

                      <div>
                        <label
                          className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                          PTU number
                        </label>
                        <input
                          type="text"
                          value={receiptForm.ptuNumber}
                          onChange={(e) =>
                            setReceiptForm((prev) => ({
                              ...prev,
                              ptuNumber: e.target.value
                            }))
                          }
                          placeholder="Printer / PTU registration no."
                          className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                        />
                      </div>

                      <div>
                        <label
                          className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                          VAT rate (% on VAT-inclusive sales)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={receiptForm.vatRatePercent}
                          onChange={(e) =>
                            setReceiptForm((prev) => ({
                              ...prev,
                              vatRatePercent: Math.min(
                                100,
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }))
                          }
                          className={`w-full max-w-[140px] px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                        />
                      </div>

                      <div>
                        <label
                          className={`block text-sm font-semibold mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                          Terminal ID (this device)
                        </label>
                        <input
                          type="text"
                          value={terminalIdLocal}
                          onChange={(e) => setTerminalIdLocal(e.target.value)}
                          placeholder="e.g. POS01"
                          className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] ${isDark ? "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"}`}
                        />
                        <p className={`text-xs mt-1.5 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                          Saved only on this browser. Sequential receipt numbers are{" "}
                          <span className="font-semibold">{terminalIdLocal || "…"}-000001</span>
                          , etc.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p
                      className={`text-sm font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}>

                      Preview
                    </p>
                    <div
                      className={`rounded-xl p-4 font-mono text-[11px] leading-relaxed ${isDark ? "bg-[#1E1B18] border border-gray-600" : "bg-gray-50 border border-gray-200"}`}>

                      <div className="text-center space-y-1 mb-3">
                        <p className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
                          {receiptForm.storeName || "—"}
                        </p>
                        {receiptForm.receiptTagline ?
                          <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                            {receiptForm.receiptTagline}
                          </p> :

                          null}
                        <p className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                          {receiptForm.receiptAddress}
                        </p>
                        <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                          {receiptForm.receiptContactNumber}
                        </p>
                        {receiptForm.birCompliantEnabled ?
                          <div className={`text-[9px] mt-2 space-y-0.5 ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                            <p>TIN: {receiptForm.storeTin || "—"}</p>
                            <p>PTU: {receiptForm.ptuNumber || "—"}</p>
                          </div> :

                          null}
                      </div>
                      <div className={`border-t border-dashed my-3 ${isDark ? "border-gray-600" : "border-gray-300"}`} />
                      <p className="text-center text-[10px] text-gray-500 mb-1">
                        {terminalIdLocal ? `${terminalIdLocal}-000001` : "#000000"}
                      </p>
                      {receiptForm.birCompliantEnabled ?
                        <div className={`text-[9px] space-y-0.5 mb-2 ${isDark ? "text-gray-500" : "text-gray-600"}`}>
                          <div className="flex justify-between">
                            <span>Net sales</span>
                            <span>
                              PHP{" "}
                              {(
                                1120 /
                                (1 + (Number(receiptForm.vatRatePercent) || 12) / 100)
                              ).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>VAT {Number(receiptForm.vatRatePercent) || 12}%</span>
                            <span>
                              PHP{" "}
                              {(
                                1120 -
                                1120 / (1 + (Number(receiptForm.vatRatePercent) || 12) / 100)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div> :

                        null}
                      <div className={`border-t border-dashed my-3 ${isDark ? "border-gray-600" : "border-gray-300"}`} />
                      <div className="text-center space-y-1">
                        <p className={isDark ? "text-gray-400" : "text-gray-600"}>
                          {receiptForm.receiptThankYouMessage}
                        </p>
                        <p className={`text-[10px] ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                          {receiptForm.receiptDisclaimer}
                        </p>
                      </div>
                    </div>
                    <p className={`text-xs mt-3 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Thermal prints use the same header/footer when the local print bridge is configured.
                    </p>
                  </div>

                  <div className="lg:col-span-2 flex flex-wrap justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        fetchReceiptSettings();
                      }}
                      disabled={receiptSaving || receiptLoading}
                      className={`py-3 px-6 rounded-xl font-semibold text-sm transition-all ${isDark ? "bg-[#1E1B18] text-gray-300 border border-gray-600 hover:bg-[#322f2c]" : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"} disabled:opacity-50`}>

                      Reload
                    </button>
                    <button
                      type="submit"
                      disabled={receiptSaving}
                      className="py-3 px-8 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#AD7F65] to-[#76462B] hover:opacity-95 transition-all disabled:opacity-50 flex items-center gap-2 shadow-md">

                      {receiptSaving ?
                        <>
                          <FaSpinner className="w-4 h-4 animate-spin" />
                          Saving...
                        </> :

                        "Save receipt layout"
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div> :

        activeTab === "archives" ?
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end items-center pr-2 gap-3">
              {archives.length > 0 &&
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setShowBulkRestoreModal(true);
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white shadow transition-all hover:opacity-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background:
                        "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                    }}
                    disabled={
                      archivesLoading ||
                      bulkArchivesLoading ||
                      exportArchivesLoading ||
                      clearArchivesLoading
                    }>

                    <FaUndo className="w-4 h-4" />
                    {selectedArchiveIds.length === 0
                      ? "Restore all"
                      : "Restore selected"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      if (selectedArchiveIds.length > 0) {
                        setShowBulkClearModal(true);
                      } else {
                        setShowClearArchiveModal(true);
                      }
                    }}
                    className="bg-red-600/90 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2 disabled:opacity-50"
                    disabled={
                      archivesLoading ||
                      bulkArchivesLoading ||
                      exportArchivesLoading ||
                      clearArchivesLoading
                    }>

                    <FaTrash className="w-4 h-4" />
                    {selectedArchiveIds.length === 0
                      ? "Clear all data"
                      : "Clear selected"}
                  </button>
                  <button
                    onClick={handleExportArchives}
                    className="bg-[#AD7F65] hover:bg-[#8e654e] text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2"
                    disabled={exportArchivesLoading || clearArchivesLoading || bulkArchivesLoading}>

                    <FaDownload className="w-4 h-4" />
                    {exportArchivesLoading ? "Exporting..." : "Export Data"}
                  </button>
                </>
              }
            </div>
            <div
              className={`rounded-2xl shadow-lg overflow-hidden ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead
                    className={theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}>

                    <tr>
                      <th
                        className={`px-3 py-3 w-12 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        <input
                          ref={selectAllArchivesRef}
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-400 text-[#AD7F65] focus:ring-[#AD7F65]"
                          checked={
                            archives.length > 0 &&
                            selectedArchiveIds.length === archives.length
                          }
                          onChange={toggleSelectAllArchives}
                          disabled={archivesLoading || bulkArchivesLoading || archives.length === 0}
                          title="Select all"
                        />
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Archive Number
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Item Image
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        SKU
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Item Name
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Category
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Quantity
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Price
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Reason
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Date & Time
                      </th>
                      <th
                        className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                        Archived By
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    className={`divide-y ${theme === "dark" ? "bg-[#2A2724] divide-gray-700" : "bg-white divide-gray-200"}`}>

                    {archivesLoading ?
                      <tr>
                        <td
                          colSpan="11"
                          className="px-4 py-8 text-center text-gray-500">

                          <div className="flex flex-col items-center justify-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B7355] mb-2"></div>
                            <span>Loading...</span>
                          </div>
                        </td>
                      </tr> :
                      archives.length === 0 ?
                        <tr>
                          <td
                            colSpan="11"
                            className="px-4 py-8 text-center text-gray-500">

                            <div className="flex flex-col items-center justify-center">
                              <div className="w-24 h-24 flex items-center justify-center mb-4">
                                <FaBox className="w-full h-full text-gray-300" />
                              </div>
                              <p className="text-gray-400 text-lg">
                                No Archive yet
                              </p>
                            </div>
                          </td>
                        </tr> :

                        archives.map((archive, index) => {
                          const archiveNumber = archives.length - index;
                          return (
                            <tr
                              key={archive._id || archive.id}
                              className={`hover:${theme === "dark" ? "bg-[#1E1B18]" : "bg-gray-50"}`}>

                              <td
                                className="px-3 py-3 whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}>

                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-400 text-[#AD7F65] focus:ring-[#AD7F65]"
                                  checked={selectedArchiveIds.includes(archiveRowId(archive))}
                                  onChange={() => toggleArchiveRowSelect(archiveRowId(archive))}
                                  disabled={archivesLoading || bulkArchivesLoading}
                                />
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                                #{archiveNumber}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {archive.itemImage ?
                                  <img
                                    src={archive.itemImage}
                                    alt={archive.itemName}
                                    className="w-12 h-12 object-cover rounded"
                                    onError={(e) => {
                                      e.target.src =
                                        "https://via.placeholder.com/50";
                                    }} /> :


                                  <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                                    <span className="text-xs">No Image</span>
                                  </div>
                                }
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                                {archive.sku}
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                                <div>
                                  <div className="font-medium">
                                    {archive.itemName}
                                  </div>
                                  {archive.variant &&
                                    <div className="text-xs text-gray-500">
                                      ({archive.variant})
                                    </div>
                                  }
                                  {archive.selectedSize &&
                                    <div className="text-xs text-gray-500">
                                      Size: {archive.selectedSize}
                                    </div>
                                  }
                                  {archive.brandName &&
                                    <div className="text-xs text-gray-500">
                                      Brand: {archive.brandName}
                                    </div>
                                  }
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                  {archive.category}
                                </span>
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                                {archive.quantity}
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                                ₱{parseFloat(archive.itemPrice || 0).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                                  {archive.reason}
                                </span>
                                {archive.returnReason &&
                                  <div className="mt-1 text-xs text-gray-600">
                                    {archive.returnReason}
                                  </div>
                                }
                                {archive.notes &&
                                  <div className="mt-1 text-xs text-gray-500 italic">
                                    {archive.notes}
                                  </div>
                                }
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                                {formatDateTime(archive.archivedAt)}
                              </td>
                              <td
                                className={`px-4 py-3 whitespace-nowrap text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                                {archive.archivedBy || "N/A"}
                              </td>
                            </tr>);

                        })
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div> :

          <div className="max-w-4xl mx-auto space-y-6">
            { }
            <div
              className={`rounded-3xl shadow-lg p-8 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
                  <FaUser className="w-5 h-5" />
                </div>
                <h3
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                  Profile Information
                </h3>
              </div>

              <div className="flex items-start gap-8 mb-8">
                { }
                <div
                  className="relative group cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}>

                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg relative">
                    <img
                      src={profileImage || defaultAvatar}
                      alt={computedName}
                      onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }}
                      className="w-full h-full object-cover transition-opacity group-hover:opacity-75" />

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <FaCamera className="text-white w-8 h-8" />
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleImageChange}
                    className="hidden" />

                </div>

                { }
                <div className="flex-1">
                  <h2
                    className={`text-2xl font-bold mb-1 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>

                    {computedName}
                  </h2>
                  <p className="text-[#AD7F65] font-medium mb-3">{role}</p>

                  <div className="mb-4">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                      Permissions:
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {role?.toLowerCase() === "owner" ?
                        <span className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50">
                          All
                        </span> :

                        <>
                          {permissions.posTerminal &&
                            <span className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50">
                              POS Terminal
                            </span>
                          }
                          {permissions.viewTransactions &&
                            <span className="px-3 py-1 rounded-full text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50">
                              View Transactions
                            </span>
                          }
                          {!permissions.posTerminal &&
                            !permissions.viewTransactions &&
                            <span className="text-xs text-gray-400 italic">
                              No active permissions
                            </span>
                          }
                        </>
                      }
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                      Status:
                    </label>
                    <span
                      className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${status === "Active" ?
                          "bg-green-100 text-green-700" :
                          "bg-red-100 text-red-700"}`
                      }>

                      {status}
                    </span>
                  </div>
                </div>
              </div>

              { }
              <h4
                className={`text-base font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                Personal Details
              </h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={`w-full text-base font-semibold border-b-2 border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 bg-transparent ${theme === "dark" ? "text-white" : "text-gray-800"}`
                    } />

                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    Middle Initial
                  </label>
                  <input
                    type="text"
                    value={middleInitial}
                    onChange={(e) =>
                      setMiddleInitial(
                        e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase()
                      )
                    }
                    className={`w-full text-base font-semibold border-b-2 border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 bg-transparent ${theme === "dark" ? "text-white" : "text-gray-800"}`
                    } />

                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={`w-full text-base font-semibold border-b-2 border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 bg-transparent ${theme === "dark" ? "text-white" : "text-gray-800"}`
                    } />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full text-base font-semibold border-b-2 border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 bg-transparent ${theme === "dark" ? "text-white" : "text-gray-800"}`
                    } />

                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    Contact number
                  </label>
                  <input
                    type="text"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className={`w-full text-base font-semibold border-b-2 border-gray-200 focus:border-[#AD7F65] focus:outline-none py-1 bg-transparent ${theme === "dark" ? "text-white" : "text-gray-800"}`
                    } />

                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    Date Joined
                  </label>
                  <p
                    className={`text-base font-semibold py-1 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                    {dateJoined || "N/A"}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500 mb-1 block">
                    Position
                  </label>
                  <p
                    className={`text-base font-semibold py-1 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                    Employee - {role}
                  </p>
                </div>
              </div>

              { }
              {error &&
                <div className="mt-4 rounded-xl p-3.5 flex items-center gap-2.5 bg-red-50 text-red-700 border border-red-200">
                  <FaTimesCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </div>
              }

              { }
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => saveProfile()}
                  disabled={profileLoading}
                  className="px-8 py-3 rounded-xl font-bold text-white bg-[#1B89CD] hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-200/30 hover:shadow-green-300/40">

                  {profileLoading ?
                    <>
                      <FaSpinner className="w-4 h-4 animate-spin" /> Saving...
                    </> :

                    "Save Changes"
                  }
                </button>
              </div>
            </div>

            { }
            <div
              className={`rounded-3xl shadow-lg p-8 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
                  <FaPalette className="w-5 h-5" />
                </div>
                <h3
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                  Appearance
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${theme === "dark" ?
                      "border-[#AD7F65] shadow-md" :
                      "border-gray-200 hover:border-gray-300"}`
                  }>

                  <div className="w-full h-16 rounded-xl bg-[#1E1B18] shadow-inner mb-2"></div>
                  <span
                    className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-700"}`}>

                    Dark Mode
                  </span>
                </button>

                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${theme === "light" ?
                      "border-[#AD7F65] shadow-md" :
                      "border-gray-200 hover:border-gray-300"}`
                  }>

                  <div className="w-full h-16 rounded-xl bg-white shadow-inner mb-2 border border-gray-100"></div>
                  <span
                    className={`text-sm font-medium ${theme === "dark" ? "text-white" : "text-gray-700"}`}>

                    Light Mode
                  </span>
                </button>
              </div>
            </div>

            { }
            <div
              className={`rounded-3xl shadow-lg p-8 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
                      <FaSync className="w-5 h-5" />
                    </div>
                    <h3
                      className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                      Data Synchronization
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 ml-13">
                    Keep your data up to date across all devices. Manual sync
                    ensures changes are saved.
                  </p>
                </div>

                <button
                  onClick={handleSyncData}
                  disabled={syncLoading}
                  className="px-6 py-2.5 rounded-xl text-white font-bold bg-[#10B981] hover:bg-[#059669] transition-all shadow-md disabled:opacity-50 whitespace-nowrap">

                  {syncLoading ? "Syncing..." : "Sync Now"}
                </button>
              </div>
            </div>

            { }
            <div
              className={`rounded-3xl shadow-lg p-8 ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
                  <FaKey className="w-5 h-5" />
                </div>
                <h3
                  className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>

                  Change PIN
                </h3>
              </div>

              {error &&
                <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-xl text-sm text-red-700">
                  {error}
                </div>
              }

              <div className="space-y-6 mb-6">
                { }
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                    Current PIN
                  </label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) =>
                      <input
                        key={i}
                        id={`current-pin-${i}`}
                        type="password"
                        maxLength={1}
                        value={currentPin[i]}
                        onChange={(e) =>
                          handlePinInput(e.target.value, i, "current")
                        }
                        disabled={pinLoading}
                        className={`w-12 h-12 text-center text-lg font-bold rounded-xl border-2 shadow-sm focus:border-[#AD7F65] focus:shadow-md transition-all outline-none disabled:opacity-50 ${theme === "dark" ?
                            "bg-[#1E1B18] border-gray-600 text-white focus:bg-[#352F2A]" :
                            "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white"}`
                        } />

                    )}
                  </div>
                </div>

                { }
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                    New PIN
                  </label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) =>
                      <input
                        key={i}
                        id={`new-pin-${i}`}
                        type="password"
                        maxLength={1}
                        value={newPin[i]}
                        onChange={(e) => handlePinInput(e.target.value, i, "new")}
                        disabled={pinLoading}
                        className={`w-12 h-12 text-center text-lg font-bold rounded-xl border-2 shadow-sm focus:border-[#AD7F65] focus:shadow-md transition-all outline-none disabled:opacity-50 ${theme === "dark" ?
                            "bg-[#1E1B18] border-gray-600 text-white focus:bg-[#352F2A]" :
                            "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white"}`
                        } />

                    )}
                  </div>
                </div>

                { }
                <div>
                  <label
                    className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>

                    Confirm PIN
                  </label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) =>
                      <input
                        key={i}
                        id={`confirm-pin-${i}`}
                        type="password"
                        maxLength={1}
                        value={confirmPin[i]}
                        onChange={(e) =>
                          handlePinInput(e.target.value, i, "confirm")
                        }
                        disabled={pinLoading}
                        className={`w-12 h-12 text-center text-lg font-bold rounded-xl border-2 shadow-sm focus:border-[#AD7F65] focus:shadow-md transition-all outline-none disabled:opacity-50 ${theme === "dark" ?
                            "bg-[#1E1B18] border-gray-600 text-white focus:bg-[#352F2A]" :
                            "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white"}`
                        } />

                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleUpdatePin}
                  disabled={pinLoading}
                  className="px-8 py-2.5 rounded-xl text-white font-bold bg-[#1B89CD] hover:bg-[#2563EB] transition-all shadow-md disabled:opacity-50">

                  {pinLoading ? "Changing PIN..." : "Change PIN"}
                </button>
              </div>
            </div>
          </div>
      }

      {showClearArchiveModal &&
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/20">
          <div
            className={`p-6 rounded-2xl shadow-xl w-full max-w-sm ${theme === "dark" ? "bg-[#2A2724] text-white" : "bg-white text-gray-900"}`}>

            <h3 className="text-xl font-bold mb-4 text-center">
              Clear Archives
            </h3>
            <p className="text-sm text-center mb-6">
              Are you sure you want to permanently delete all archive data? This
              action cannot be undone.
            </p>
            {error &&
              <p className="text-red-500 text-sm text-center mb-4">{error}</p>
            }
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowClearArchiveModal(false);
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg font-bold border transition-colors ${theme === "dark" ? "border-gray-600 hover:bg-gray-700 text-white" : "border-gray-300 hover:bg-gray-100 text-gray-700"}`}
                disabled={clearArchivesLoading}>

                Cancel
              </button>
              <button
                onClick={handleClearArchives}
                className="flex-1 py-2 rounded-lg font-bold bg-red-600 text-white hover:bg-red-700 transition-colors flex justify-center items-center"
                disabled={clearArchivesLoading}>

                {clearArchivesLoading ?
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :

                  "Delete All"
                }
              </button>
            </div>
          </div>
        </div>
      }

      {showBulkRestoreModal &&
        <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 backdrop-blur-sm bg-black/20">
          <div
            className={`p-6 rounded-2xl shadow-xl w-full max-w-md ${theme === "dark" ? "bg-[#2A2724] text-white" : "bg-white text-gray-900"}`}>

            <h3 className="text-xl font-bold mb-3 text-center">
              Restore to inventory?
            </h3>
            <p className="text-sm text-center mb-4 opacity-90">
              {selectedArchiveIds.length} item(s) will return to Product &amp; Stocks and
              be removed from this archive list.
            </p>
            <ul
              className={`text-xs max-h-28 overflow-y-auto mb-4 space-y-1 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>

              {archives
                .filter((a) => selectedArchiveIds.includes(archiveRowId(a)))
                .slice(0, 8)
                .map((a) =>
                  <li key={archiveRowId(a)}>
                    <span className="font-mono">{a.sku}</span>
                    {" — "}
                    {a.itemName}
                  </li>
                )}
              {selectedArchiveIds.length > 8 &&
                <li className="italic">
                  +{selectedArchiveIds.length - 8} more…
                </li>
              }
            </ul>
            {error &&
              <p className="text-red-500 text-sm text-center mb-3">{error}</p>
            }
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowBulkRestoreModal(false);
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg font-bold border transition-colors ${theme === "dark" ? "border-gray-600 hover:bg-gray-700 text-white" : "border-gray-300 hover:bg-gray-100 text-gray-700"}`}
                disabled={bulkArchivesLoading}>

                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkRestore}
                className="flex-1 py-2 rounded-lg font-bold text-white transition-all hover:opacity-95 flex justify-center items-center"
                style={{
                  background:
                    "linear-gradient(135deg, #10B981 0%, #059669 100%)"
                }}
                disabled={bulkArchivesLoading}>

                {bulkArchivesLoading ?
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :

                  "Restore"
                }
              </button>
            </div>
          </div>
        </div>
      }

      {showBulkClearModal &&
        <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 backdrop-blur-sm bg-black/20">
          <div
            className={`p-6 rounded-2xl shadow-xl w-full max-w-md ${theme === "dark" ? "bg-[#2A2724] text-white" : "bg-white text-gray-900"}`}>

            <h3 className="text-xl font-bold mb-3 text-center">
              Remove archive entries?
            </h3>
            <p className="text-sm text-center mb-4 opacity-90">
              Permanently delete {selectedArchiveIds.length} row(s) from the archive
              history. This does not delete live products.
            </p>
            {error &&
              <p className="text-red-500 text-sm text-center mb-3">{error}</p>
            }
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setShowBulkClearModal(false);
                  setError("");
                }}
                className={`flex-1 py-2 rounded-lg font-bold border transition-colors ${theme === "dark" ? "border-gray-600 hover:bg-gray-700 text-white" : "border-gray-300 hover:bg-gray-100 text-gray-700"}`}
                disabled={bulkArchivesLoading}>

                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkClearArchives}
                className="flex-1 py-2 rounded-lg font-bold bg-amber-800 text-white hover:bg-amber-900 transition-colors flex justify-center items-center"
                disabled={bulkArchivesLoading}>

                {bulkArchivesLoading ?
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> :

                  "Remove"
                }
              </button>
            </div>
          </div>
        </div>
      }

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setError("");
        }}
        message={successMessage} />

    </div>);

};

export default memo(Settings);