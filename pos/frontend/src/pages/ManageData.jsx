import jsPDF from "jspdf";
import {
    memo,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import {
    FaArrowLeft,
    FaDatabase,
    FaDownload,
    FaExclamationTriangle,
    FaFileExcel,
    FaFileImport,
    FaFilePdf,
    FaLock,
    FaSpinner,
    FaTimes,
    FaTimesCircle,
    FaTrash
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import SuccessModal from "../components/inventory/SuccessModal";
import Header from "../components/shared/header";
import { API_BASE_URL as API_BASE } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { SidebarContext } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";

// ─── PIN Verification Modal ───────────────────────────────────────────────
const PinModal = memo(({ isOpen, onClose, onVerified, theme }) => {
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef([]);
  const isDark = theme === "dark";

  useEffect(() => {
    if (isOpen) {
      setPin(["", "", "", "", "", ""]);
      setError("");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  const handleInput = (value, index) => {
    if (value && !/^\d$/.test(value)) return;
    const updated = [...pin];
    updated[index] = value;
    setPin(updated);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    const pinValue = pin.join("");
    if (pinValue.length !== 6) {
      setError("Please enter a complete 6-digit PIN");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/employees/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });
      const data = await response.json();

      if (data.success) {
        const role = data.data?.role;
        if (role === "Owner" || role === "Manager") {
          onVerified(pinValue);
        } else {
          setError(
            "Access denied. Only Owner or Manager can access this feature.",
          );
          setPin(["", "", "", "", "", ""]);
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
      } else {
        setError("Invalid PIN. Please try again.");
        setPin(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch {
      setError("Unable to verify PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm bg-black/30">
      <div
        className={`p-8 rounded-3xl shadow-2xl w-full max-w-sm ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
              <FaLock className="w-4 h-4" />
            </div>
            <h3
              className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              Enter PIN
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
          >
            <FaTimes className="w-4 h-4" />
          </button>
        </div>

        <p
          className={`text-sm mb-6 text-center ${isDark ? "text-gray-400" : "text-gray-500"}`}
        >
          Owner or Manager PIN required to manage data
        </p>

        <div className="flex gap-2 justify-center mb-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="password"
              maxLength={1}
              value={pin[i]}
              onChange={(e) => handleInput(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              disabled={loading}
              className={`w-12 h-12 text-center text-lg font-bold rounded-xl border-2 shadow-sm focus:border-[#AD7F65] focus:shadow-md transition-all outline-none disabled:opacity-50 ${isDark ? "bg-[#1E1B18] border-gray-600 text-white focus:bg-[#352F2A]" : "bg-gray-50 border-gray-200 text-gray-900 focus:bg-white"}`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center flex items-center justify-center gap-2">
            <FaTimesCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || pin.join("").length !== 6}
          className="w-full py-3 rounded-xl font-bold text-white bg-[#AD7F65] hover:bg-[#8e654e] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <FaSpinner className="w-4 h-4 animate-spin" /> Verifying...
            </>
          ) : (
            "Verify"
          )}
        </button>
      </div>
    </div>
  );
});

// ─── Checkbox List Modal ──────────────────────────────────────────────────
const DataSelectionModal = memo(
  ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel,
    confirmColor,
    collections,
    loading,
    theme,
    icon: Icon,
    showFormatPicker,
  }) => {
    const [selected, setSelected] = useState({});
    const [exportFormat, setExportFormat] = useState("excel");
    const isDark = theme === "dark";

    useEffect(() => {
      if (isOpen) {
        const initial = {};
        collections.forEach((c) => (initial[c.key] = false));
        setSelected(initial);
        setExportFormat("excel");
      }
    }, [isOpen, collections]);

    const toggleAll = () => {
      const allSelected = Object.values(selected).every(Boolean);
      const updated = {};
      Object.keys(selected).forEach((key) => (updated[key] = !allSelected));
      setSelected(updated);
    };

    const toggleOne = (key) => {
      setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const selectedKeys = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const anySelected = selectedKeys.length > 0;

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm bg-black/30">
        <div
          className={`rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${confirmColor === "red" ? "bg-red-500" : "bg-[#AD7F65]"}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <p
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
            >
              {description}
            </p>
          </div>

          {/* Select All */}
          <div className="px-8 pb-2">
            <button
              onClick={toggleAll}
              className={`text-sm font-semibold transition-colors ${isDark ? "text-[#C2A68C] hover:text-[#dcc4ad]" : "text-[#AD7F65] hover:text-[#8e654e]"}`}
            >
              {Object.values(selected).every(Boolean)
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          {/* Collection list */}
          <div className="px-8 pb-4 max-h-80 overflow-y-auto">
            <div className="space-y-2">
              {collections.map((col) => (
                <label
                  key={col.key}
                  className={`flex items-center gap-4 p-3.5 rounded-xl cursor-pointer transition-all border ${
                    selected[col.key]
                      ? isDark
                        ? "bg-[#352F2A] border-[#AD7F65]/50"
                        : "bg-[#FDF8F5] border-[#AD7F65]/30"
                      : isDark
                        ? "bg-[#1E1B18] border-transparent hover:border-gray-600"
                        : "bg-gray-50 border-transparent hover:border-gray-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected[col.key] || false}
                    onChange={() => toggleOne(col.key)}
                    className="w-5 h-5 rounded-md accent-[#AD7F65] cursor-pointer"
                  />
                  <div className="flex-1">
                    <span
                      className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-800"}`}
                    >
                      {col.name}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDark ? "bg-[#1E1B18] text-gray-400" : "bg-gray-100 text-gray-500"}`}
                  >
                    {col.count.toLocaleString()} records
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Format picker for export */}
          {showFormatPicker && (
            <div className="px-8 pb-4">
              <label
                className={`block text-sm font-semibold mb-3 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                Export Format
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setExportFormat("excel")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                    exportFormat === "excel"
                      ? "border-green-500 bg-green-50 text-green-700 shadow-md shadow-green-100"
                      : isDark
                        ? "border-gray-600 bg-[#1E1B18] text-gray-400 hover:border-gray-500"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <FaFileExcel className="w-4 h-4" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => setExportFormat("pdf")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all border-2 ${
                    exportFormat === "pdf"
                      ? "border-red-500 bg-red-50 text-red-700 shadow-md shadow-red-100"
                      : isDark
                        ? "border-gray-600 bg-[#1E1B18] text-gray-400 hover:border-gray-500"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <FaFilePdf className="w-4 h-4" />
                  PDF (.pdf)
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            className={`px-8 py-5 flex justify-end gap-3 ${isDark ? "bg-[#1E1B18]" : "bg-gray-50"}`}
          >
            <button
              onClick={onClose}
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors border ${isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selectedKeys, exportFormat)}
              disabled={!anySelected || loading}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 flex items-center gap-2 shadow-md ${
                confirmColor === "red"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-[#AD7F65] hover:bg-[#8e654e]"
              }`}
            >
              {loading ? (
                <>
                  <FaSpinner className="w-3.5 h-3.5 animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <Icon className="w-3.5 h-3.5" /> {confirmLabel} (
                  {selectedKeys.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// ─── Clear Confirmation Modal ─────────────────────────────────────────────
const ClearConfirmModal = memo(
  ({ isOpen, onClose, onConfirm, selectedNames, loading, theme }) => {
    const [confirmText, setConfirmText] = useState("");
    const isDark = theme === "dark";

    useEffect(() => {
      if (isOpen) setConfirmText("");
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-black/30">
        <div
          className={`p-8 rounded-3xl shadow-2xl w-full max-w-md ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white">
              <FaExclamationTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3
                className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Confirm Deletion
              </h3>
              <p
                className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                This action cannot be undone
              </p>
            </div>
          </div>

          <div
            className={`rounded-xl p-4 mb-4 ${isDark ? "bg-red-900/20 border border-red-800/50" : "bg-red-50 border border-red-200"}`}
          >
            <p
              className={`text-sm mb-2 font-medium ${isDark ? "text-red-300" : "text-red-800"}`}
            >
              You are about to permanently delete:
            </p>
            <ul className="space-y-1">
              {selectedNames.map((name, i) => (
                <li
                  key={i}
                  className={`text-sm flex items-center gap-2 ${isDark ? "text-red-400" : "text-red-700"}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                  {name}
                </li>
              ))}
            </ul>
          </div>

          <p
            className={`text-sm mb-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}
          >
            Type <span className="font-bold text-red-600">DELETE</span> to
            confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-semibold mb-4 focus:outline-none transition-all ${
              isDark
                ? "bg-[#1E1B18] border-gray-600 text-white focus:border-red-500"
                : "bg-gray-50 border-gray-200 text-gray-900 focus:border-red-500"
            }`}
          />

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors border ${isDark ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-600 hover:bg-gray-100"}`}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={confirmText !== "DELETE" || loading}
              className="flex-1 py-3 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <FaSpinner className="w-3.5 h-3.5 animate-spin" /> Deleting...
                </>
              ) : (
                <>
                  <FaTrash className="w-3.5 h-3.5" /> Delete Permanently
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// ─── Wrapper with PIN gate ────────────────────────────────────────────────
const ManageDataWrapper = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [verifiedPin, setVerifiedPin] = useState(null);
  const [showPinModal, setShowPinModal] = useState(true);

  const handlePinVerified = (pin) => {
    setVerifiedPin(pin);
    setShowPinModal(false);
  };

  const handlePinClose = () => {
    setShowPinModal(false);
    navigate("/settings");
  };

  if (!verifiedPin) {
    return (
      <PinModal
        isOpen={showPinModal}
        onClose={handlePinClose}
        onVerified={handlePinVerified}
        theme={theme}
      />
    );
  }

  return <ManageDataInner verifiedPin={verifiedPin} />;
};

// Inner component receives verifiedPin
const ManageDataInner = ({ verifiedPin }) => {
  const { isExpanded } = useContext(SidebarContext);
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [pendingClearKeys, setPendingClearKeys] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const fetchCollections = useCallback(async () => {
    setCollectionsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/data-management/collections`);
      const data = await res.json();
      if (data.success) {
        setCollections(data.data);
      }
    } catch (err) {
      console.error("Error fetching collections:", err);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // ─── Clear Data ───────────────────────────────────────────
  const handleClearSelect = (selectedKeys) => {
    setPendingClearKeys(selectedKeys);
    setShowClearModal(false);
    setShowClearConfirm(true);
  };

  const handleClearConfirm = async () => {
    setClearLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/data-management/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collections: pendingClearKeys,
          pin: verifiedPin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message);
        setShowSuccessModal(true);
        setShowClearConfirm(false);
        fetchCollections();
      } else {
        setError(data.message || "Failed to clear data");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setClearLoading(false);
    }
  };

  // ─── Export Data ──────────────────────────────────────────
  const handleExport = async (selectedKeys, format) => {
    setExportLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/data-management/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collections: selectedKeys }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Export failed");
        setExportLoading(false);
        return;
      }

      const timestamp = new Date().toISOString().split("T")[0];

      if (format === "excel") {
        exportToExcel(data, timestamp);
      } else {
        exportToPdf(data, timestamp);
      }

      // Also save JSON backup automatically
      exportJsonBackup(data, timestamp);

      setShowExportModal(false);
      setSuccessMessage(
        `Data exported successfully as ${format.toUpperCase()}! A JSON backup file was also saved for importing later.`,
      );
      setShowSuccessModal(true);
    } catch {
      setError("Network error during export. Please try again.");
    } finally {
      setExportLoading(false);
    }
  };

  const flattenObject = (obj, prefix = "") => {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (key === "_id" || key === "__v") {
        result[newKey] = String(value);
      } else if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === "object") {
          result[newKey] = value
            .map((item) => {
              if (typeof item === "object") {
                return Object.entries(item)
                  .filter(([k]) => k !== "_id")
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", ");
              }
              return String(item);
            })
            .join(" | ");
        } else {
          result[newKey] = value.join(", ");
        }
      } else if (
        value &&
        typeof value === "object" &&
        !(value instanceof Date)
      ) {
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = value;
      }
    }
    return result;
  };

  const formatHeaderName = (header) => {
    return header
      .replace(/([A-Z])/g, " $1")
      .replace(/[._]/g, " ")
      .replace(/^\s/, "")
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const exportToExcel = (data, timestamp) => {
    const wb = XLSX.utils.book_new();

    Object.entries(data.data).forEach(([key, records]) => {
      if (!records || records.length === 0) return;
      const flatRecords = records.map((record) => flattenObject(record));
      const ws = XLSX.utils.json_to_sheet(flatRecords);

      const colWidths = Object.keys(flatRecords[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...flatRecords.map((r) => String(r[key] || "").length),
        );
        return { wch: Math.min(maxLen + 2, 50) };
      });
      ws["!cols"] = colWidths;

      const collectionName =
        collections.find((c) => c.key === key)?.name || key;
      const sheetName = collectionName.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const summaryData = data.summary.map((s) => ({
      Collection: s.name,
      "Records Exported": s.count,
    }));
    summaryData.push({
      Collection: "TOTAL",
      "Records Exported": data.summary.reduce((sum, s) => sum + s.count, 0),
    });
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    summaryWs["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, "Export Summary");

    XLSX.writeFile(wb, `POS_Data_Export_${timestamp}.xlsx`);
  };

  const exportToPdf = (data, timestamp) => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    let isFirstPage = true;

    Object.entries(data.data).forEach(([key, records]) => {
      if (!records || records.length === 0) return;
      if (!isFirstPage) doc.addPage();
      isFirstPage = false;

      const collectionName =
        collections.find((c) => c.key === key)?.name || key;
      const flatRecords = records.map((record) => flattenObject(record));
      const headers = Object.keys(flatRecords[0] || {});
      const importantHeaders = headers.slice(0, 8);
      const colWidth = (297 - 28) / importantHeaders.length;
      const startY = 28;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      doc.text(`${collectionName} (${records.length} records)`, 14, 15);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 21);

      doc.setFillColor(173, 127, 101);
      doc.rect(14, startY, 297 - 28, 8, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      importantHeaders.forEach((h, i) => {
        doc.text(formatHeaderName(h), 15 + i * colWidth, startY + 5.5, {
          maxWidth: colWidth - 2,
        });
      });

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const maxRows = Math.min(records.length, 35);
      flatRecords.slice(0, maxRows).forEach((record, rowIdx) => {
        const y = startY + 8 + rowIdx * 5;
        if (y > 195) return;

        if (rowIdx % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(14, y, 297 - 28, 5, "F");
        }

        doc.setFontSize(6);
        importantHeaders.forEach((h, colIdx) => {
          const value = String(record[h] ?? "").substring(0, 40);
          doc.text(value, 15 + colIdx * colWidth, y + 3.5, {
            maxWidth: colWidth - 2,
          });
        });
      });

      if (records.length > maxRows) {
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `... and ${records.length - maxRows} more records (see Excel export for complete data)`,
          14,
          200,
        );
      }
    });

    doc.addPage();
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text("Export Summary", 14, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    let summaryY = 38;
    data.summary.forEach((s) => {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(s.name, 14, summaryY);
      doc.setFont("helvetica", "normal");
      doc.text(`${s.count.toLocaleString()} records`, 120, summaryY);
      summaryY += 7;
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    summaryY += 5;
    doc.text("Total Records:", 14, summaryY);
    doc.text(
      data.summary.reduce((sum, s) => sum + s.count, 0).toLocaleString(),
      120,
      summaryY,
    );

    doc.save(`POS_Data_Export_${timestamp}.pdf`);
  };

  const exportJsonBackup = (data, timestamp) => {
    const backup = {
      ...data,
      _meta: {
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.name || "Unknown",
        version: "1.0",
        type: "pos-system-backup",
      },
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `POS_Backup_${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Import Data ──────────────────────────────────────────
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.name.endsWith(".json")) {
      setError("Please select a valid JSON backup file (.json)");
      return;
    }

    setImportLoading(true);
    setError("");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.data || typeof parsed.data !== "object") {
        setError(
          "Invalid backup file format. Please use a file exported from this system.",
        );
        setImportLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/data-management/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed.data, pin: verifiedPin }),
      });
      const result = await res.json();

      if (result.success) {
        setSuccessMessage(result.message);
        setShowSuccessModal(true);
        fetchCollections();
      } else {
        setError(result.message || "Import failed");
      }
    } catch (err) {
      console.error("Import error:", err);
      setError(
        "Failed to read or process the file. Ensure it's a valid JSON backup.",
      );
    } finally {
      setImportLoading(false);
    }
  };

  const pendingClearNames = pendingClearKeys
    .map((key) => collections.find((c) => c.key === key)?.name || key)
    .filter(Boolean);

  const totalRecords = collections.reduce((sum, c) => sum + c.count, 0);

  return (
    <div
      className={`p-8 min-h-screen ${isDark ? "bg-[#1E1B18]" : "bg-gray-50"}`}
    >
      <Header pageName="Manage Data" showBorder={false} />

      {/* Back button */}
      <button
        onClick={() => navigate("/settings")}
        className={`flex items-center gap-2 mb-6 text-sm font-semibold transition-colors ${isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"}`}
      >
        <FaArrowLeft className="w-3.5 h-3.5" />
        Back to Settings
      </button>

      {collectionsLoading ? (
        <div className="flex items-center justify-center min-h-[50vh]">
          <FaSpinner className="w-8 h-8 text-[#AD7F65] animate-spin" />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Overview Card */}
          <div
            className={`rounded-3xl shadow-lg p-8 ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
                <FaDatabase className="w-5 h-5" />
              </div>
              <div>
                <h3
                  className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}
                >
                  Data Overview
                </h3>
                <p
                  className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}
                >
                  {totalRecords.toLocaleString()} total records across{" "}
                  {collections.length} collections
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {collections.map((col) => (
                <div
                  key={col.key}
                  className={`p-4 rounded-2xl border transition-all ${isDark ? "bg-[#1E1B18] border-gray-700" : "bg-gray-50 border-gray-100"}`}
                >
                  <p
                    className={`text-sm font-semibold mb-1 ${isDark ? "text-white" : "text-gray-800"}`}
                  >
                    {col.name}
                  </p>
                  <p
                    className={`text-2xl font-bold ${isDark ? "text-[#C2A68C]" : "text-[#AD7F65]"}`}
                  >
                    {col.count.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className={`rounded-xl p-4 flex items-center gap-3 ${isDark ? "bg-red-900/20 border border-red-800 text-red-400" : "bg-red-50 border border-red-200 text-red-700"}`}
            >
              <FaTimesCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
              <button onClick={() => setError("")} className="ml-auto">
                <FaTimes className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Clear Data */}
            <div
              className={`rounded-3xl shadow-lg p-6 flex flex-col ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center text-white">
                  <FaTrash className="w-4 h-4" />
                </div>
                <h3
                  className={`text-base font-bold ${isDark ? "text-white" : "text-gray-800"}`}
                >
                  Clear Data
                </h3>
              </div>
              <p
                className={`text-sm mb-6 flex-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                Permanently delete selected data from both cloud and local
                storage. Choose which data types to clear.
              </p>
              <button
                onClick={() => setShowClearModal(true)}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                <FaTrash className="w-3.5 h-3.5" />
                Clear Data
              </button>
            </div>

            {/* Export Data */}
            <div
              className={`rounded-3xl shadow-lg p-6 flex flex-col ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#AD7F65] flex items-center justify-center text-white">
                  <FaDownload className="w-4 h-4" />
                </div>
                <h3
                  className={`text-base font-bold ${isDark ? "text-white" : "text-gray-800"}`}
                >
                  Export Data
                </h3>
              </div>
              <p
                className={`text-sm mb-6 flex-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                Export all your data as PDF or Excel. Select which collections
                to export. A JSON backup is always included.
              </p>
              <button
                onClick={() => setShowExportModal(true)}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-[#AD7F65] hover:bg-[#8e654e] transition-all flex items-center justify-center gap-2"
              >
                <FaDownload className="w-3.5 h-3.5" />
                Export Data
              </button>
            </div>

            {/* Import Data */}
            <div
              className={`rounded-3xl shadow-lg p-6 flex flex-col ${isDark ? "bg-[#2A2724]" : "bg-white"}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
                  <FaFileImport className="w-4 h-4" />
                </div>
                <h3
                  className={`text-base font-bold ${isDark ? "text-white" : "text-gray-800"}`}
                >
                  Import Data
                </h3>
              </div>
              <p
                className={`text-sm mb-6 flex-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}
              >
                Restore data from a previously exported JSON backup file. All
                collections in the file will be imported.
              </p>
              <button
                onClick={handleImportClick}
                disabled={importLoading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importLoading ? (
                  <>
                    <FaSpinner className="w-3.5 h-3.5 animate-spin" />{" "}
                    Importing...
                  </>
                ) : (
                  <>
                    <FaFileImport className="w-3.5 h-3.5" /> Import Data
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <DataSelectionModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearSelect}
        title="Clear Data"
        description="Select which data you want to permanently delete. This will remove data from both cloud and local databases."
        confirmLabel="Continue"
        confirmColor="red"
        collections={collections}
        loading={false}
        theme={theme}
        icon={FaTrash}
        showFormatPicker={false}
      />

      <ClearConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearConfirm}
        selectedNames={pendingClearNames}
        loading={clearLoading}
        theme={theme}
      />

      <DataSelectionModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onConfirm={handleExport}
        title="Export Data"
        description="Select which data to export and choose your preferred format."
        confirmLabel="Export"
        confirmColor="brown"
        collections={collections}
        loading={exportLoading}
        theme={theme}
        icon={FaDownload}
        showFormatPicker={true}
      />

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          setError("");
        }}
        message={successMessage}
      />
    </div>
  );
};

export default memo(ManageDataWrapper);
