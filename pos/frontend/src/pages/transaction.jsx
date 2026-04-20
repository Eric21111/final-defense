import { AnimatePresence, motion } from "framer-motion";
import { endOfDay, isWithinInterval, startOfDay } from "date-fns";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from
  "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaClipboardList,
  FaExclamationTriangle,
  FaEye,
  FaPrint,
  FaSearch,
  FaUndoAlt
} from
  "react-icons/fa";
import ShopBagSales from "../assets/ShopBagSales.svg";
import TransactionsTotalGreen from "../assets/TransactionsTotalGreen.svg";
import HandCashIcon from "../assets/hand-cash.svg";
import Header from "../components/shared/header";
import PrintReceiptModal from "../components/transaction/PrintReceiptModal";
import RemittanceModal from "../components/transaction/RemittanceModal";
import ReturnItemsModal from "../components/transaction/ReturnItemsModal";
import ViewTransactionModal from "../components/transaction/ViewTransactionModal";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";
import {
  lineSubtotalFromItems,
  originalSubtotalFromItems,
  totalReturnedFromTransaction,
  resolveTransactionDiscount
} from "../utils/transactionDisplay";
import { getReceiptBranding } from "../utils/receiptProfile";
import { useAuth } from "../context/AuthContext";
import { useDataCache } from "../context/DataCacheContext";
import { useTheme } from "../context/ThemeContext";

const STATUS_STYLES = {
  Completed: "bg-green-100 text-green-700 border border-green-200",
  Returned: "bg-orange-100 text-orange-700 border border-orange-200",
  "Partially Returned": "bg-amber-100 text-amber-700 border border-amber-200",
  Voided: "bg-red-100 text-red-600 border border-red-200"
};

const paymentOptions = ["All", "cash", "gcash"];
const statusOptions = ["All", "Completed", "Returned", "Partially Returned"];
const userOptions = ["All"];
const dateOptions = ["Today", "All", "Last 7 days", "Last 30 days", "Custom"];

const CalendarTrigger = forwardRef(({ onClick, className }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={className}
    aria-label="Pick date range"
  >
    <FaCalendarAlt className="text-gray-500 text-sm" />
  </button>
));
CalendarTrigger.displayName = "CalendarTrigger";

const getInitials = (name = "") =>
  name.
    split(" ").
    filter(Boolean).
    map((n) => n[0]).
    slice(0, 2).
    join("").
    toUpperCase();

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);

const hasSeniorPwdDiscount = (source = {}) => {
  const textHasSeniorPwd = (value) => /(senior|pwd|sc\s*\/\s*pwd)/i.test(String(value || ""));
  if (textHasSeniorPwd(source.customerType) || textHasSeniorPwd(source.discountCategory)) return true;
  if (Array.isArray(source.discounts)) {
    return source.discounts.some((d) =>
      textHasSeniorPwd(d?.title) ||
      textHasSeniorPwd(d?.name) ||
      textHasSeniorPwd(d?.discountCategory) ||
      textHasSeniorPwd(d?.category)
    );
  }
  if (Array.isArray(source.appliedDiscountIds)) {
    return source.appliedDiscountIds.some((d) =>
      d && typeof d === "object" &&
      (textHasSeniorPwd(d?.title) || textHasSeniorPwd(d?.name) || textHasSeniorPwd(d?.discountCategory))
    );
  }
  return false;
};

const formatCurrencyCompact = (value = 0) => {
  const n = parseFloat(value) || 0;
  const abs = Math.abs(n).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  return n < 0 ? `-₱${abs}` : `₱${abs}`;
};

const toNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Local originalLineSubtotalFromItems removed in favor of global originalSubtotalFromItems

const sameTransactionId = (a, b) =>
  String(a?._id ?? a ?? "") === String(b?._id ?? b ?? "");

const saleDate = (trx) => {
  if (trx.checkedOutAt != null && trx.checkedOutAt !== "") {
    return new Date(trx.checkedOutAt);
  }
  return new Date(trx.createdAt);
};

const generateTransactionNumber = (transaction) => {
  if (!transaction) return "---";

  if (transaction.transactionNumber) {
    return transaction.transactionNumber.toString();
  }
  return "---";
};

const statusIcon = {
  Completed: <FaCheckCircle className="text-green-500" />,
  Returned: <FaUndoAlt className="text-orange-500" />,
  "Partially Returned": <FaUndoAlt className="text-amber-500" />,
  Voided: <FaExclamationTriangle className="text-red-500" />
};

const normalizeDropdownOptions = (options) => {
  if (!options?.length) return [];
  if (typeof options[0] === "object" && options[0] !== null && "value" in options[0]) {
    return options.map((o) => ({
      value: String(o.value),
      label: o.label ?? String(o.value)
    }));
  }
  return options.map((o) => ({ value: o, label: o }));
};

const Dropdown = ({
  label,
  options,
  selected,
  onSelect,
  isOpen,
  setIsOpen,
  showAllAsOptionLabel = false
}) => {
  const dropdownRef = React.useRef(null);
  const { theme } = useTheme();
  const normalizedOptions = React.useMemo(
    () => normalizeDropdownOptions(options),
    [options]
  );
  const selectedLabel = normalizedOptions.find((o) => o.value === selected)?.label ?? selected;

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isOpen ?
          "border-[#AD7F65] shadow-lg " + (
            theme === "dark" ?
              "bg-[#2A2724] text-white" :
              "bg-white text-gray-700") :
          theme === "dark" ?
            "border-gray-600 bg-[#2A2724] text-gray-300 hover:border-[#AD7F65]" :
            "border-gray-200 bg-white hover:border-[#AD7F65] text-gray-700"}`
        }>

        <span className="text-sm font-medium">
          {selected === "All" ?
            showAllAsOptionLabel ?
              "All" :
              label :
            selectedLabel}
        </span>
        <FaChevronDown
          className={`text-xs text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />

      </button>
      <AnimatePresence>
        {isOpen &&
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`absolute z-20 mt-2 w-44 rounded-xl border border-gray-100 shadow-2xl overflow-hidden ${theme === "dark" ?
              "bg-[#2A2724] border-gray-600" :
              "bg-white border-gray-100"}`
            }
            onClick={(e) => e.stopPropagation()}>

            {normalizedOptions.map((option) =>
              <li
                key={option.value}
                onClick={() => {
                  onSelect(option.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${option.value === selected ?
                  "bg-[#F6EEE7] text-[#76462B] font-semibold" :
                  theme === "dark" ?
                    "text-gray-300 hover:bg-[#352F2A]" :
                    "text-gray-700 hover:bg-gray-50"}`
                }>

                {option.label}
              </li>
            )}
          </motion.ul>
        }
      </AnimatePresence>
    </div>);

};

const Transaction = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const { setCachedData, invalidateCache } = useDataCache();
  const receiptBranding = getReceiptBranding();
  const currentUserFilterId = String(currentUser?._id || currentUser?.id || "All");

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState({
    date: false,
    method: false,
    status: false,
    user: false,
    returnedBy: false
  });
  const [filters, setFilters] = useState({
    date: "Today",
    method: "All",
    status: "All",
    user: currentUserFilterId || "All",
    returnedBy: "All"
  });
  const [dateRange, setDateRange] = useState([null, null]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startDate, endDate] = dateRange;
  const [currentPage, setCurrentPage] = useState(1);
  const [showViewModal, setShowViewModal] = useState(false);
  const [transactionToView, setTransactionToView] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [transactionToPrint, setTransactionToPrint] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [transactionToReturn, setTransactionToReturn] = useState(null);
  const [showReturnSuccessModal, setShowReturnSuccessModal] = useState(false);
  const rowsPerPage = 8;
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [selectedReturnedLogIds, setSelectedReturnedLogIds] = useState([]);
  const [isExportSelectionMode, setIsExportSelectionMode] = useState(false);
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [activeTab, setActiveTab] = useState("transactions");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_ENDPOINTS.employees);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setStaffList(data.data.filter((e) => e.status === "Active"));
        }
      } catch (err) {
        console.error("Failed to load employees:", err);
      }
    })();
  }, []);

  const isInitialMount = useRef(true);
  const hasLoaded = useRef(false);
  const isInitialLoading = useRef(true);
  const isFetchInFlightRef = useRef(false);
  const setCachedDataRef = useRef(setCachedData);
  const selectAllTransactionsRef = useRef(null);
  const selectAllReturnedLogsRef = useRef(null);


  useEffect(() => {
    setCachedDataRef.current = setCachedData;
  }, [setCachedData]);

  const fetchTransactions = useCallback(async () => {
    if (isFetchInFlightRef.current) return;
    isFetchInFlightRef.current = true;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (filters.method !== "All")
        params.append("paymentMethod", filters.method);
      if (filters.status !== "All") params.append("status", filters.status);
      if (filters.user !== "All") params.append("userId", filters.user);


      // Paged load to avoid one huge response when history grows.
      const PAGE_LIMIT = 300;
      const MAX_TOTAL = 3000;
      let page = 1;
      let allTransactions = [];
      while (allTransactions.length < MAX_TOTAL) {
        params.set("limit", String(PAGE_LIMIT));
        params.set("page", String(page));
        const qs = params.toString() ? `?${params.toString()}` : "";
        const response = await fetch(`${API_BASE_URL}/api/transactions${qs}`);
        const data = await response.json().catch(() => ({}));
        if (!data?.success || !Array.isArray(data.data)) break;
        const chunk = data.data;
        if (!chunk.length) break;
        allTransactions = [...allTransactions, ...chunk];
        if (chunk.length < PAGE_LIMIT) break;
        page += 1;
        if (page > 50) break;
      }

      if (Array.isArray(allTransactions)) {


        const returnTransactions = allTransactions.filter(
          (t) => t.paymentMethod === "return" && t.originalTransactionId
        );

        const regularTransactions = allTransactions.filter(
          (t) =>
            (t.paymentMethod !== "return" || !t.originalTransactionId) &&
            t.status !== "Voided"
        );


        const returnTransactionsMap = new Map();
        returnTransactions.forEach((returnTrx) => {
          const originalId = returnTrx.originalTransactionId?.toString();
          if (originalId) {
            if (!returnTransactionsMap.has(originalId)) {
              returnTransactionsMap.set(originalId, []);
            }
            returnTransactionsMap.get(originalId).push(returnTrx);
          }
        });


        const transactionsWithReturns = regularTransactions.map((trx) => ({
          ...trx,
          returnTransactions:
            returnTransactionsMap.get(trx._id?.toString()) || []
        }));



        transactionsWithReturns.sort((a, b) => {
          const dateA = new Date(
            a.checkedOutAt || a.createdAt || a.updatedAt || 0
          );
          const dateB = new Date(
            b.checkedOutAt || b.createdAt || b.updatedAt || 0
          );
          return dateB - dateA;
        });

        const payload = transactionsWithReturns.length ?
          transactionsWithReturns :
          [];
        setTransactions(payload);
        setCachedDataRef.current("transactions", payload);
        setSelectedTransaction((prev) => {
          if (!payload.length) {
            return null;
          }
          if (prev && payload.some((t) => sameTransactionId(t, prev))) {
            return payload.find((t) => sameTransactionId(t, prev));
          }
          return payload[0];
        });
      } else {
        setTransactions([]);
        setCachedDataRef.current("transactions", []);
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
      setTransactions([]);
      setCachedDataRef.current("transactions", []);
    } finally {
      isFetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [debouncedSearch, filters.method, filters.status, filters.user]);


  useEffect(() => {
    if (hasLoaded.current) return;

    hasLoaded.current = true;

    const loadInitialData = async () => {
      try {
        // Always refetch from the server when opening this page. Client-only cache was
        // showing pre-return rows after navigating away (e.g. Inventory) and back.
        invalidateCache("transactions");
        await fetchTransactions();
        isInitialMount.current = false;
        isInitialLoading.current = false;
      } catch (error) {
        console.error("Error loading transactions:", error);

        try {
          await fetchTransactions();
        } catch (fetchError) {
          console.error("Failed to fetch transactions:", fetchError);

          setTransactions([]);
          setLoading(false);
        }
        isInitialMount.current = false;
        isInitialLoading.current = false;
      }
    };

    loadInitialData();

  }, []);


  useEffect(() => {
    if (currentUserFilterId && currentUserFilterId !== "All") {
      setFilters((prev) =>
        prev.user === "All" ? { ...prev, user: currentUserFilterId } : prev
      );
    }
  }, [currentUserFilterId]);

  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }
    fetchTransactions();
  }, [
    debouncedSearch,
    filters.method,
    filters.status,
    filters.user,
    fetchTransactions]
  );

  useEffect(() => {
    if (isInitialMount.current) return;

    const LIVE_REFRESH_MS = 3000;
    const refresh = () => {
      if (document.visibilityState === "visible") {
        fetchTransactions();
      }
    };

    const intervalId = window.setInterval(refresh, LIVE_REFRESH_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [fetchTransactions]);

  const generateSampleTransactions = () => [];


  const allRegularTransactions = useMemo(() => {
    return transactions.filter(
      (trx) => !(trx.paymentMethod === "return" && trx.originalTransactionId)
    );
  }, [transactions]);

  const matchesTransactionFilters = useCallback(
    (trx) => {
      if (trx.paymentMethod === "return" && trx.originalTransactionId) {
        return false;
      }

      if (trx.status === "Voided") {
        return false;
      }

      const matchesSearch =
        !search ||
        trx.receiptNo?.toLowerCase().includes(search.toLowerCase());

      const matchesMethod =
        filters.method === "All" ||
        trx.paymentMethod?.toLowerCase() === filters.method.toLowerCase();

      const matchesStatus =
        filters.status === "All" || trx.status === filters.status;

      const selectedEmp =
        filters.user !== "All" ?
          staffList.find((e) => String(e._id) === filters.user) :
          null;
      const selectedEmpName = selectedEmp ?
        (selectedEmp.name || `${selectedEmp.firstName || ""} ${selectedEmp.lastName || ""}`).trim() :
        "";
      const matchesUser =
        filters.user === "All" ||
        String(trx.performedById || "") === filters.user ||
        (selectedEmpName && trx.performedByName === selectedEmpName);

      let matchesDate = true;
      if (filters.date === "Custom") {
        if (startDate) {
          const end = endDate || startDate;
          const lo =
            startOfDay(startDate) <= startOfDay(end) ?
              startOfDay(startDate) :
              startOfDay(end);
          const hi =
            startOfDay(startDate) <= startOfDay(end) ?
              startOfDay(end) :
              startOfDay(startDate);
          const trxDay = startOfDay(saleDate(trx));
          matchesDate = trxDay >= lo && trxDay <= hi;
        }
      } else if (filters.date !== "All") {
        const trxDate = saleDate(trx);
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        if (filters.date === "Today") {
          matchesDate = isWithinInterval(trxDate, {
            start: startOfDay(now),
            end: endOfDay(now)
          });
        } else if (filters.date === "Last 7 days") {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          matchesDate = trxDate >= sevenDaysAgo;
        } else if (filters.date === "Last 30 days") {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          matchesDate = trxDate >= thirtyDaysAgo;
        }
      }

      return (
        matchesSearch &&
        matchesMethod &&
        matchesStatus &&
        matchesUser &&
        matchesDate);

    },
    [search, filters, startDate, endDate, staffList]
  );

  const kpiFilteredTransactions = useMemo(() => {
    const filtered = transactions.filter((trx) => matchesTransactionFilters(trx));

    return filtered.sort((a, b) => {
      const dateA = new Date(a.checkedOutAt || a.createdAt || a.updatedAt || 0);
      const dateB = new Date(b.checkedOutAt || b.createdAt || b.updatedAt || 0);
      return dateB - dateA;
    });
  }, [transactions, matchesTransactionFilters]);

  const filteredTransactions = useMemo(
    () =>
      kpiFilteredTransactions.filter(
        (trx) => trx.status !== "Pending" && trx.status !== "Failed"
      ),
    [kpiFilteredTransactions]
  );

  const returnedLogs = useMemo(() => {
    const rows = allRegularTransactions
      .map((trx) => {
        const returnEntries = Array.isArray(trx.returnTransactions)
          ? trx.returnTransactions
          : [];
        const hasReturnActivity =
          returnEntries.length > 0 ||
          trx.status === "Returned" ||
          trx.status === "Partially Returned";

        if (!hasReturnActivity) {
          return null;
        }

        const sortedReturns = [...returnEntries].sort((a, b) => {
          const aDate = new Date(a.checkedOutAt || a.createdAt || 0);
          const bDate = new Date(b.checkedOutAt || b.createdAt || 0);
          return bDate - aDate;
        });
        const latestReturn = sortedReturns[0];

        const reasons = new Set();
        returnEntries.forEach((entry) => {
          (entry.items || []).forEach((item) => {
            const reason = String(item?.returnReason || "").trim();
            if (reason) reasons.add(reason);
          });
        });
        if (!reasons.size) {
          (trx.items || []).forEach((item) => {
            const reason = String(item?.returnReason || "").trim();
            if (reason) reasons.add(reason);
          });
        }

        const originalAmount = originalSubtotalFromItems(trx) || trx.originalTotalAmount || trx.totalAmount || 0;
        const returnedAmount = totalReturnedFromTransaction(trx);
        const discountedAmount = resolveTransactionDiscount(trx, originalAmount, { skipInference: true });
        
        // Final total is the original subtotal minus discounts and minus the returned values
        const finalTotal = Math.max(0, originalAmount - discountedAmount - returnedAmount);

        return {
          _id: trx._id,
          receiptNo: trx.receiptNo,
          transactionId: trx.referenceNo || trx._id?.substring(0, 12) || "---",
          returnedAt: new Date(
            latestReturn?.checkedOutAt ||
              latestReturn?.createdAt ||
              trx.updatedAt ||
              trx.checkedOutAt ||
              trx.createdAt
          ),
          performedByName: trx.performedByName || "Staff",
          performedById: String(trx.performedById || ""),
          returnedByName:
            latestReturn?.returnedByName ||
            latestReturn?.performedByName ||
            trx.returnedByName ||
            trx.performedByName ||
            "Staff",
          returnedById: String(
            latestReturn?.returnedById ||
              latestReturn?.performedById ||
              trx.returnedById ||
              trx.performedById ||
              ""
          ),
          reason: Array.from(reasons).join(", ") || "Returned item(s)",
          originalAmount,
          discountedAmount,
          totalAmount: finalTotal, // Represents the final adjusted total after everything
          returnedAmount
        };
      })
      .filter(Boolean);

    rows.sort((a, b) => b.returnedAt - a.returnedAt);
    return rows;
  }, [allRegularTransactions]);

  const filteredReturnedLogs = useMemo(() => {
    return returnedLogs.filter((row) => {
      const receiptLabel = row.receiptNo ? `#${row.receiptNo}` : "";
      const matchesSearch =
        !search ||
        receiptLabel.toLowerCase().includes(search.toLowerCase()) ||
        String(row.transactionId).toLowerCase().includes(search.toLowerCase());

      const selectedEmp =
        filters.user !== "All" ?
          staffList.find((e) => String(e._id) === filters.user) :
          null;
      const selectedEmpName = selectedEmp ?
        (selectedEmp.name || `${selectedEmp.firstName || ""} ${selectedEmp.lastName || ""}`).trim() :
        "";

      const matchesUser =
        filters.user === "All" ||
        row.performedById === filters.user ||
        (selectedEmpName && row.performedByName === selectedEmpName);

      const selectedReturnedByEmp =
        filters.returnedBy !== "All" ?
          staffList.find((e) => String(e._id) === filters.returnedBy) :
          null;
      const selectedReturnedByName = selectedReturnedByEmp ?
        (selectedReturnedByEmp.name || `${selectedReturnedByEmp.firstName || ""} ${selectedReturnedByEmp.lastName || ""}`).trim() :
        "";

      const matchesReturnedBy =
        filters.returnedBy === "All" ||
        row.returnedById === filters.returnedBy ||
        (selectedReturnedByName && row.returnedByName === selectedReturnedByName);

      let matchesDate = true;
      if (filters.date === "Custom") {
        if (startDate) {
          const end = endDate || startDate;
          const lo =
            startOfDay(startDate) <= startOfDay(end) ?
              startOfDay(startDate) :
              startOfDay(end);
          const hi =
            startOfDay(startDate) <= startOfDay(end) ?
              startOfDay(end) :
              startOfDay(startDate);
          const rowDay = startOfDay(row.returnedAt);
          matchesDate = rowDay >= lo && rowDay <= hi;
        }
      } else if (filters.date !== "All") {
        const rowDate = row.returnedAt;
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        if (filters.date === "Today") {
          matchesDate = isWithinInterval(rowDate, {
            start: startOfDay(now),
            end: endOfDay(now)
          });
        } else if (filters.date === "Last 7 days") {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          matchesDate = rowDate >= sevenDaysAgo;
        } else if (filters.date === "Last 30 days") {
          const thirtyDaysAgo = new Date(today);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          matchesDate = rowDate >= thirtyDaysAgo;
        }
      }

      return matchesSearch && matchesUser && matchesReturnedBy && matchesDate;
    });
  }, [returnedLogs, search, filters.user, filters.returnedBy, filters.date, startDate, endDate, staffList]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTransactions, currentPage]);
  const paginatedReturnedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredReturnedLogs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredReturnedLogs, currentPage]);
  const paginatedTransactionIds = useMemo(
    () => paginatedTransactions.map((trx) => trx._id).filter(Boolean),
    [paginatedTransactions]
  );
  const allVisibleTransactionsSelected =
    paginatedTransactionIds.length > 0 &&
    paginatedTransactionIds.every((id) => selectedTransactionIds.includes(id));
  const someVisibleTransactionsSelected = paginatedTransactionIds.some((id) =>
    selectedTransactionIds.includes(id)
  );
  const paginatedReturnedLogIds = useMemo(
    () => paginatedReturnedLogs.map((row) => row._id).filter(Boolean),
    [paginatedReturnedLogs]
  );
  const allVisibleReturnedLogsSelected =
    paginatedReturnedLogIds.length > 0 &&
    paginatedReturnedLogIds.every((id) => selectedReturnedLogIds.includes(id));
  const someVisibleReturnedLogsSelected = paginatedReturnedLogIds.some((id) =>
    selectedReturnedLogIds.includes(id)
  );

  const kpis = useMemo(() => {
    const list = kpiFilteredTransactions;
    const totalSales = list.reduce((sum, trx) => {
      if (String(trx.paymentMethod || "").toLowerCase() === "return") return sum;
      return sum + (parseFloat(trx.totalAmount) || 0);
    }, 0);

    const transactionTotal = list.filter((trx) => {
      if (/^voided$/i.test(String(trx.status || ""))) return false;
      if (String(trx.paymentMethod || "").toLowerCase() === "return") return false;
      return true;
    }).length;

    const returnedItems = list.reduce((sum, trx) => {
      const items = Array.isArray(trx.items) ? trx.items : [];
      const returnedCount = items.filter((item) => {
        const rs = item?.returnStatus;
        return rs === "Returned" || rs === "Partially Returned";
      }).length;
      return sum + returnedCount;
    }, 0);

    return { totalSales, transactionTotal, returnedItems };
  }, [kpiFilteredTransactions]);

  const sidebarReceiptTotals = useMemo(() => {
    const trx = selectedTransaction;
    if (!trx) {
      return { lineSub: 0, discount: 0, hasVat: false, netOfVat: 0, vatAmount: 0, vatExemptSales: 0 };
    }
    const lineSub = originalSubtotalFromItems(trx) || trx.originalTotalAmount || trx.totalAmount || 0;
    const hasReturnActivity =
      (trx.returnTransactions?.length || 0) > 0 ||
      trx.status === "Returned" ||
      trx.status === "Partially Returned";
    const discount = resolveTransactionDiscount(trx, lineSub, {
      skipInference: hasReturnActivity
    });
    const hasVat = trx.netOfVat != null && trx.vatAmount != null;
    const isSeniorPwdTxn = hasSeniorPwdDiscount(trx);
    const netOfVat = isSeniorPwdTxn ? 0 : Number(trx.netOfVat ?? 0);
    const vatAmount = isSeniorPwdTxn ? 0 : Number(trx.vatAmount ?? 0);
    const totalAmount = Number(trx.totalAmount ?? 0);
    const vatExemptSales = isSeniorPwdTxn
      ? Math.max(0, totalAmount)
      : Math.max(0, totalAmount - netOfVat - vatAmount);
    return { lineSub, discount, hasVat, netOfVat, vatAmount, vatExemptSales };
  }, [selectedTransaction]);

  useEffect(() => {
    setSelectedTransactionIds((prev) =>
      prev.filter((id) => filteredTransactions.some((trx) => trx._id === id))
    );
  }, [filteredTransactions]);

  useEffect(() => {
    setSelectedReturnedLogIds((prev) =>
      prev.filter((id) => filteredReturnedLogs.some((row) => row._id === id))
    );
  }, [filteredReturnedLogs]);

  useEffect(() => {
    setCurrentPage(1);
    setIsExportSelectionMode(false);
    setSelectedTransactionIds([]);
    setSelectedReturnedLogIds([]);
  }, [activeTab]);

  useEffect(() => {
    if (selectAllTransactionsRef.current) {
      selectAllTransactionsRef.current.indeterminate =
        isExportSelectionMode &&
        !allVisibleTransactionsSelected &&
        someVisibleTransactionsSelected;
    }
    if (selectAllReturnedLogsRef.current) {
      selectAllReturnedLogsRef.current.indeterminate =
        isExportSelectionMode &&
        !allVisibleReturnedLogsSelected &&
        someVisibleReturnedLogsSelected;
    }
  }, [
    isExportSelectionMode,
    allVisibleTransactionsSelected,
    someVisibleTransactionsSelected,
    allVisibleReturnedLogsSelected,
    someVisibleReturnedLogsSelected]
  );


  const userDropdownOptions = useMemo(() => {
    const fromStaff = staffList
      .map((e) => ({
        value: String(e._id),
        label: (e.name || `${e.firstName || ""} ${e.lastName || ""}`).trim() || "Unknown"
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const seen = new Set(fromStaff.map((r) => r.value));
    const fromTx = [];
    transactions.forEach((t) => {
      const id = t.performedById ? String(t.performedById) : "";
      if (id && t.performedByName && !seen.has(id)) {
        fromTx.push({ value: id, label: t.performedByName });
        seen.add(id);
      }
    });
    fromTx.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "All", label: "All" }, ...fromStaff, ...fromTx];
  }, [staffList, transactions]);

  const returnedByDropdownOptions = useMemo(() => {
    const fromStaff = staffList
      .map((e) => ({
        value: String(e._id),
        label: (e.name || `${e.firstName || ""} ${e.lastName || ""}`).trim() || "Unknown"
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const seen = new Set(fromStaff.map((r) => r.value));
    const fromReturns = [];
    returnedLogs.forEach((row) => {
      const id = row.returnedById ? String(row.returnedById) : "";
      if (id && row.returnedByName && !seen.has(id)) {
        fromReturns.push({ value: id, label: row.returnedByName });
        seen.add(id);
      }
    });
    fromReturns.sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "All", label: "All" }, ...fromStaff, ...fromReturns];
  }, [staffList, returnedLogs]);

  const handleRowClick = (trx) => {
    setSelectedTransaction(trx);
  };

  const handleToggleTransactionSelection = (transactionId) => {
    if (!transactionId) return;
    setSelectedTransactionIds((prev) =>
      prev.includes(transactionId) ?
        prev.filter((id) => id !== transactionId) :
        [...prev, transactionId]
    );
  };

  const handleToggleSelectAllTransactions = () => {
    setSelectedTransactionIds((prev) => {
      if (allVisibleTransactionsSelected) {
        return prev.filter((id) => !paginatedTransactionIds.includes(id));
      }
      const merged = new Set(prev);
      paginatedTransactionIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  };

  const handleToggleReturnedLogSelection = (logId) => {
    if (!logId) return;
    setSelectedReturnedLogIds((prev) =>
      prev.includes(logId) ?
        prev.filter((id) => id !== logId) :
        [...prev, logId]
    );
  };

  const handleToggleSelectAllReturnedLogs = () => {
    setSelectedReturnedLogIds((prev) => {
      if (allVisibleReturnedLogsSelected) {
        return prev.filter((id) => !paginatedReturnedLogIds.includes(id));
      }
      const merged = new Set(prev);
      paginatedReturnedLogIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  };

  const handleExportButtonClick = () => {
    if (!isExportSelectionMode) {
      setIsExportSelectionMode(true);
      if (activeTab === "returned") {
        setSelectedReturnedLogIds([]);
      } else {
        setSelectedTransactionIds([]);
      }
      return;
    }
    if (activeTab === "returned") {
      handleExportReturnedLogsToCSV();
      return;
    }
    handleExportToCSV();
  };

  const handleCancelExportSelection = () => {
    setIsExportSelectionMode(false);
    setSelectedTransactionIds([]);
    setSelectedReturnedLogIds([]);
  };

  const renderStatusPill = (status = "Completed") =>
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-transform ${STATUS_STYLES[status]}`}>

      {statusIcon[status]}
      {status}
    </span>;


  const isTransactionReturnable = (transaction) => {
    if (!transaction || !transaction.checkedOutAt) return false;
    const transactionDate = new Date(transaction.checkedOutAt);
    const now = new Date();
    const diffTime = Math.abs(now - transactionDate);
    const diffHours = diffTime / (1000 * 60 * 60);
    return diffHours <= 48;
  };

  const handleViewClick = (transaction) => {
    setTransactionToView(transaction);
    setShowViewModal(true);
  };

  const handlePrintClick = (transaction) => {
    setTransactionToPrint(transaction);
    setShowPrintModal(true);
  };

  const handleExportToCSV = () => {
    try {
      const transactionsToExport =
        selectedTransactionIds.length > 0 ?
          filteredTransactions.filter((trx) =>
            selectedTransactionIds.includes(trx._id)
          ) :
          [];

      if (transactionsToExport.length === 0) {
        alert("Please select at least one transaction to export.");
        return;
      }

      const headers = [
        "Receipt No.",
        "Transaction ID",
        "Date",
        "Time",
        "User ID",
        "Performed By ID",
        "Performed By Name",
        "Payment Method",
        "Reference No.",
        "Total Amount",
        "Amount Received",
        "Change Given",
        "Status",
        "Item Count",
        "Items (Name)",
        "Items (SKU)",
        "Items (Variant)",
        "Items (Size)",
        "Items (Qty)",
        "Items (Price)",
        "Items (Subtotal)",
        "Voided By",
        "Voided By Name",
        "Voided At",
        "Void Reason",
        "Original Transaction ID",
        "Created At",
        "Updated At"];


      const escapeCSV = (value) => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = transactionsToExport.map((trx) => {
        const checkoutDate = trx.checkedOutAt ?
          new Date(trx.checkedOutAt) :
          new Date(trx.createdAt);
        const createdDate = trx.createdAt ? new Date(trx.createdAt) : null;
        const updatedDate = trx.updatedAt ? new Date(trx.updatedAt) : null;
        const voidedDate = trx.voidedAt ? new Date(trx.voidedAt) : null;


        const itemNames =
          trx.items?.map((item) => item.itemName || "").join("; ") || "";
        const itemSkus =
          trx.items?.map((item) => item.sku || "").join("; ") || "";
        const itemVariants =
          trx.items?.map((item) => item.variant || "").join("; ") || "";
        const itemSizes =
          trx.items?.map((item) => item.selectedSize || "").join("; ") || "";
        const itemQtys =
          trx.items?.map((item) => item.quantity || 0).join("; ") || "";
        const itemPrices =
          trx.items?.map((item) => item.price || 0).join("; ") || "";
        const itemSubtotals =
          trx.items?.
            map((item) => (item.quantity || 0) * (item.price || 0)).
            join("; ") || "";

        return [
          escapeCSV(trx.receiptNo || ""),
          escapeCSV(trx._id || ""),
          escapeCSV(checkoutDate.toLocaleDateString()),
          escapeCSV(checkoutDate.toLocaleTimeString()),
          escapeCSV(trx.userId || ""),
          escapeCSV(trx.performedById || ""),
          escapeCSV(trx.performedByName || ""),
          escapeCSV(trx.paymentMethod || ""),
          escapeCSV(trx.referenceNo || ""),
          escapeCSV(trx.totalAmount || 0),
          escapeCSV(trx.amountReceived || 0),
          escapeCSV(trx.changeGiven || 0),
          escapeCSV(trx.status || ""),
          escapeCSV(trx.items?.length || 0),
          escapeCSV(itemNames),
          escapeCSV(itemSkus),
          escapeCSV(itemVariants),
          escapeCSV(itemSizes),
          escapeCSV(itemQtys),
          escapeCSV(itemPrices),
          escapeCSV(itemSubtotals),
          escapeCSV(trx.voidedBy || ""),
          escapeCSV(trx.voidedByName || ""),
          escapeCSV(voidedDate ? voidedDate.toLocaleString() : ""),
          escapeCSV(trx.voidReason || ""),
          escapeCSV(trx.originalTransactionId || ""),
          escapeCSV(createdDate ? createdDate.toLocaleString() : ""),
          escapeCSV(updatedDate ? updatedDate.toLocaleString() : "")].
          join(",");
      });

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `transactions_export_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert("Transactions exported successfully!");
      setIsExportSelectionMode(false);
      setSelectedTransactionIds([]);
    } catch (error) {
      console.error("Error exporting transactions:", error);
      alert("Failed to export transactions. Please try again.");
    }
  };

  const handleExportReturnedLogsToCSV = () => {
    try {
      const rowsToExport =
        selectedReturnedLogIds.length > 0 ?
          filteredReturnedLogs.filter((row) =>
            selectedReturnedLogIds.includes(row._id)
          ) :
          [];

      if (rowsToExport.length === 0) {
        alert("Please select at least one returned log to export.");
        return;
      }

      const headers = [
        "Receipt No.",
        "Transaction ID",
        "Returned Date",
        "Performed By",
        "Returned By",
        "Reason",
        "Original Amount",
        "Discounted Amount",
        "Returned Amount",
        "Final Total"
      ];

      const escapeCSV = (value) => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRows = rowsToExport.map((row) =>
        [
          escapeCSV(row.receiptNo ? `#${row.receiptNo}` : ""),
          escapeCSV(row.transactionId || ""),
          escapeCSV(
            row.returnedAt ?
              row.returnedAt.toLocaleDateString() :
              ""
          ),
          escapeCSV(row.performedByName || ""),
          escapeCSV(row.returnedByName || ""),
          escapeCSV(row.reason || ""),
          escapeCSV(row.originalAmount || 0),
          escapeCSV(row.discountedAmount || 0),
          escapeCSV(-Math.abs(row.returnedAmount || 0)),
          escapeCSV(row.totalAmount || 0)
        ].join(",")
      );

      const csvContent = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `returned_logs_export_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert("Returned logs exported successfully!");
      setIsExportSelectionMode(false);
      setSelectedReturnedLogIds([]);
    } catch (error) {
      console.error("Error exporting returned logs:", error);
      alert("Failed to export returned logs. Please try again.");
    }
  };

  const handleImportFromCSV = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      alert(
        "Transaction import is not supported. Transactions are created through the POS terminal."
      );
      event.target.value = "";
    } catch (error) {
      console.error("Error with import:", error);
      event.target.value = "";
    }
  };

  const handleReturnClick = (transaction) => {
    if (!isTransactionReturnable(transaction)) {
      alert("This transaction is more than 2 days old and cannot be returned.");
      return;
    }
    if (transaction.status === "Returned" || transaction.status === "Voided") {
      alert("This transaction has already been returned or voided.");
      return;
    }
    setTransactionToReturn(transaction);
    setShowReturnModal(true);
  };

  const handleReturnConfirm = async (itemsToReturn, transaction, approverInfo = {}) => {
    try {
      setLoading(true);
      console.log("Processing return for items:", itemsToReturn);
      const returnProcessorId = String(currentUser?._id || currentUser?.id || "");
      const returnProcessorName =
        currentUser?.name ||
        `${currentUser?.firstName || ""} ${currentUser?.lastName || ""}`.trim() ||
        transaction.performedByName ||
        "System";
      // Use the approver name from PIN verification (the owner/manager who approved)
      const approverReturnName = approverInfo.returnedByName || returnProcessorName;


      const returnedIndices = itemsToReturn.map((item) => item.originalIndex);


      // Rule:
      // - Damaged / Defective / Expired (and similar) -> Archive only (no stock-in)
      // - Wrong item, size issue, changed mind, Other, etc. -> Stock-In (restock sellable inventory)
      const isArchiveReturnReason = (reason) => {
        const raw = String(reason || "").trim();
        const head = raw.split(":")[0].trim().toLowerCase();
        const archiveHeads = new Set([
          "damaged",
          "defective",
          "expired"
        ]);
        if (archiveHeads.has(head)) return true;
        return false;
      };
      const damagedItems = itemsToReturn.filter((item) =>
        isArchiveReturnReason(item.reason)
      );
      const returnableItems = itemsToReturn.filter(
        (item) => !isArchiveReturnReason(item.reason)
      );

      console.log("Damaged items (to archive):", damagedItems.length);
      console.log("Returnable items (to stock):", returnableItems.length);



      const updatedItems = transaction.items.map((item, idx) => {
        if (returnedIndices.includes(idx)) {
          const returnedItem = itemsToReturn.find(
            (ri) => ri.originalIndex === idx
          );
          const returnedQty = returnedItem?.quantity || item.quantity;
          const originalQty = item.quantity;


          if (returnedQty >= originalQty) {
            return {
              ...item,
              returnStatus: "Returned",
              returnReason: returnedItem?.reason || "Returned",
              returnedQuantity: originalQty
            };
          } else {

            return {
              ...item,
              quantity: originalQty - returnedQty,
              returnStatus: "Partially Returned",
              returnReason: returnedItem?.reason || "Returned",
              returnedQuantity: returnedQty
            };
          }
        }
        return item;
      });


      const fullyReturnedCount = updatedItems.filter(
        (item) => item.returnStatus === "Returned"
      ).length;
      const partiallyReturnedCount = updatedItems.filter(
        (item) => item.returnStatus === "Partially Returned"
      ).length;
      const allItemsFullyReturned = fullyReturnedCount === updatedItems.length;
      const hasAnyReturns =
        fullyReturnedCount > 0 || partiallyReturnedCount > 0;

      let newStatus = "Completed";
      if (allItemsFullyReturned) {
        newStatus = "Returned";
      } else if (hasAnyReturns) {
        newStatus = "Partially Returned";
      }


      const newTotalAmount = updatedItems.
        filter((item) => item.returnStatus !== "Returned").
        reduce(
          (sum, item) =>
            sum + item.quantity * (item.price || item.itemPrice || 0),
          0
        );


      // Preserve the original total amount (before any returns) so the subtotal line
      // on the receipt always reflects the original purchase value.
      const originalTotalAmount = transaction.originalTotalAmount ||
        originalSubtotalFromItems(transaction);

      const updatePayload = {
        status: newStatus,
        items: updatedItems,
        totalAmount: newTotalAmount,
        originalTotalAmount: originalTotalAmount,
        returnedByName: approverReturnName
      };
      console.log("Updating original transaction FIRST:", updatePayload);

      const updateResponse = await fetch(
        `${API_BASE_URL}/api/transactions/${transaction._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload)
        }
      );
      const updateData = await updateResponse.json();
      console.log("Transaction update response:", updateData);


      if (!updateResponse.ok || !updateData.success) {
        throw new Error(updateData.message || "Failed to update transaction");
      }

      const updatedOriginalTransaction = updateData.data || {
        ...transaction,
        ...updatePayload
      };

      setTransactions((prev) => {
        const next = prev.map((trx) =>
          sameTransactionId(trx, transaction)
            ? { ...trx, ...updatedOriginalTransaction }
            : trx
        );
        setCachedDataRef.current("transactions", next);
        return next;
      });

      setSelectedTransaction((prev) => {
        if (!prev || !sameTransactionId(prev, transaction)) {
          return prev;
        }
        return { ...prev, ...updatedOriginalTransaction };
      });


      for (const item of damagedItems) {

        let productDetails = null;
        try {
          const productResponse = await fetch(
            `${API_BASE_URL}/api/products/${item.productId}`
          );
          const productData = await productResponse.json();
          if (productData.success) {
            productDetails = productData.data;
          }
        } catch (error) {
          console.warn("Failed to fetch product details for archiving:", error);
        }


        const archivePayload = {
          productId: item.productId,
          itemName: item.itemName,
          sku: item.sku || "N/A",
          variant: item.variant || "",
          selectedSize: item.selectedSize || "",
          category: productDetails?.category || "Others",
          brandName: productDetails?.brandName || "",
          itemPrice: item.price || 0,
          costPrice: productDetails?.costPrice || 0,
          quantity: item.quantity,
          itemImage: productDetails?.itemImage || "",
          reason: item.reason,
          returnReason: item.reason,
          originalTransactionId: transaction._id,
          archivedBy: transaction.performedByName || "System",
          archivedById: transaction.performedById || "",
          notes: `Returned due to: ${item.reason}`
        };

        console.log("Archiving item:", archivePayload);
        const archiveResponse = await fetch(
          `${API_BASE_URL}/api/archive`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(archivePayload)
          }
        );
        const archiveData = await archiveResponse.json();
        console.log("Archive response:", archiveData);

        if (!archiveData.success) {
          console.error("Failed to archive item:", archiveData);
          // Don't hide/remove the product if we failed to record the archive.
          continue;
        }

        // Important: For returns we only archive the *returned stock* (qty + size/variant),
        // not the entire product. So we DO NOT set `isArchived` on the product here.
      }

      // Stock-in items that are returned but NOT damaged/defective/expired
      let stockUpdateFailed = false;
      if (returnableItems.length > 0) {
        const stockUpdatePayload = {
          items: returnableItems.map((item) => {
            const orig = transaction.items?.[item.originalIndex];
            const sizeRaw =
              item.selectedSize ||
              item.size ||
              orig?.selectedSize ||
              orig?.size ||
              "";
            const size =
              sizeRaw && String(sizeRaw).trim()
                ? String(sizeRaw).trim()
                : null;
            const variantRaw =
              item.variant ||
              item.selectedVariation ||
              orig?.variant ||
              orig?.selectedVariation ||
              "";
            const variant =
              variantRaw && String(variantRaw).trim()
                ? String(variantRaw).trim()
                : null;
            return {
              _id: item.productId,
              sku: item.sku || orig?.sku,
              size,
              selectedSize: size,
              variant,
              selectedVariation: variant,
              quantity: item.quantity,
              price: item.price ?? orig?.price ?? orig?.itemPrice,
              originalTransactionId: transaction._id,
              originalLineIndex: item.originalIndex,
              batchAllocations: orig?.batchAllocations
            };
          }),
          performedByName: returnProcessorName,
          performedById: returnProcessorId,
          reason: "Returned Item",
          type: "Stock-In"
        };

        console.log("Updating stock (Stock-In):", stockUpdatePayload);
        const stockResponse = await fetch(
          `${API_BASE_URL}/api/products/update-stock`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(stockUpdatePayload)
          }
        );
        let stockData = {};
        try {
          stockData = await stockResponse.json();
        } catch {
          stockData = {};
        }
        console.log("Stock update response:", stockData);

        if (!stockResponse.ok || !stockData.success) {
          stockUpdateFailed = true;
          console.error("Failed to update stock:", stockData);
          alert(
            stockData.message ||
              "Inventory could not be updated. Ensure this sale recorded size and variant correctly, then try again or adjust stock manually."
          );
        }
      }

      for (const item of itemsToReturn) {
        const returnTransaction = {
          userId: returnProcessorId || transaction.userId || "system",
          items: [
            {
              productId: item.productId,
              itemName: item.itemName,
              sku: item.sku,
              variant: item.variant,
              selectedSize: item.selectedSize,
              quantity: item.quantity,
              price: item.price,
              returnReason: item.reason
            }],

          paymentMethod: "return",
          amountReceived: 0,
          changeGiven: 0,
          referenceNo: `RET-${transaction.referenceNo || transaction._id?.substring(0, 12)}-${Date.now()}-${itemsToReturn.indexOf(item)}`,
          receiptNo: null,
          totalAmount: item.quantity * item.price,
          performedById: returnProcessorId || transaction.performedById || "",
          performedByName: returnProcessorName,
          returnedBy: returnProcessorId || undefined,
          returnedById: returnProcessorId || undefined,
          returnedByName: approverReturnName,
          status: "Returned",
          originalTransactionId: transaction._id,
          checkedOutAt: new Date()
        };

        console.log("Creating return transaction:", returnTransaction);
        const returnTrxResponse = await fetch(
          `${API_BASE_URL}/api/transactions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(returnTransaction)
          }
        );
        const returnTrxData = await returnTrxResponse.json();
        console.log("Return transaction response:", returnTrxData);
      }

      await fetchTransactions();

      if (!stockUpdateFailed) {
        setShowReturnSuccessModal(true);
      }
    } catch (error) {
      console.error("Error processing return:", error);
      alert("Failed to process return. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isReturnedLogsTab = activeTab === "returned";
  const activeRowCount = isReturnedLogsTab ?
    filteredReturnedLogs.length :
    filteredTransactions.length;
  const totalPages = Math.ceil(activeRowCount / rowsPerPage) || 1;
  const transactionTableColumnCount = isExportSelectionMode ? 11 : 10;
  const returnedTableColumnCount = isExportSelectionMode ? 10 : 9;
  const showingStart = activeRowCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const showingEnd = Math.min(currentPage * rowsPerPage, activeRowCount);


  if (isInitialLoading.current && transactions.length === 0) {
    return (
      <div
        className="p-6 min-h-screen flex items-center justify-center"
        style={{ background: "#FFFFFF" }}>

        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B7355] mb-4"></div>
          <p className="text-gray-600">Loading transactions...</p>
        </div>
      </div>);

  }

  return (
    <div
      className={`p-6 h-screen overflow-hidden flex flex-col ${theme === "dark" ? "bg-[#1E1B18]" : "bg-[#F9FAFB]"}`}>

      <>
        <Header
          pageName="Transactions"
          showBorder={false}
          profileBackground="" />

        <div className="mt-4 mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`px-5 py-2.5 rounded-xl text-base font-semibold border transition-all ${theme === "dark" ?
              "bg-[#2A2724] border-gray-600 text-gray-200" :
              "bg-white border-gray-200 text-[#22314A]"} ${activeTab === "transactions" ?
                "shadow-[0_4px_0_0_rgba(173,127,101,0.75)] !text-[#AD7F65]" :
                "shadow-[0_6px_14px_rgba(15,23,42,0.08)] hover:-translate-y-0.5"}`
            }
          >
            Transaction Logs
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("returned")}
            className={`px-5 py-2.5 rounded-xl text-base font-semibold border transition-all ${theme === "dark" ?
              "bg-[#2A2724] border-gray-600 text-gray-200" :
              "bg-white border-gray-200 text-[#22314A]"} ${activeTab === "returned" ?
                "shadow-[0_4px_0_0_rgba(173,127,101,0.75)] !text-[#AD7F65]" :
                "shadow-[0_6px_14px_rgba(15,23,42,0.08)] hover:-translate-y-0.5"}`
            }
          >
            Returned Logs
          </button>
        </div>


        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-4 w-full">
          <div className="contents">
            {[
              {
                label: "Total Sales",
                value: formatCurrencyCompact(kpis.totalSales),
                barGradient: "linear-gradient(180deg, #2563EB 0%, #60A5FA 100%)",
                textColor: "#2563EB",
                iconBgClass: "bg-blue-100",
                icon: (
                  <img
                    src={ShopBagSales}
                    alt="Total Sales"
                    className="w-10 h-10"
                  />
                )
              },
              {
                label: "Total Transactions",
                value: kpis.transactionTotal,
                barGradient: "linear-gradient(180deg, #22C55E 0%, #4ADE80 100%)",
                textColor: "#22C55E",
                iconBgClass: "bg-green-100",
                icon: (
                  <img
                    src={TransactionsTotalGreen}
                    alt="Transactions"
                    className="w-10 h-10"
                  />
                )
              },
              {
                label: "Returned",
                value: kpis.returnedItems,
                barGradient: "linear-gradient(180deg, #D97706 0%, #F59E0B 100%)",
                textColor: "#F59E0B",
                iconBgClass: "bg-orange-100",
                icon: <FaUndoAlt className="text-xl" />
              }
            ].map((card) => (
              <motion.div
                key={card.label}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden text-left w-full min-h-[92px] ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`}
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-2"
                  style={{ backgroundImage: card.barGradient }}
                />

                <div className="ml-2">
                  <motion.p
                    key={card.value}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl lg:text-3xl font-extrabold"
                    style={{ color: card.textColor }}
                  >
                    {card.value}
                  </motion.p>
                  <p className="text-xs mt-0.5" style={{ color: card.textColor }}>
                    {card.label}
                  </p>
                </div>

                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${card.iconBgClass}`}
                  style={{ color: card.textColor }}
                >
                  {card.icon}
                </div>
              </motion.div>
            ))}

            {/* Ready to Remit Card */}
            <motion.div
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden cursor-pointer ${theme === "dark" ? "bg-[#1a2332]" : "bg-[#E8F0FE]"} w-full min-h-[92px]`}
              onClick={() => setShowRemittanceModal(true)}
            >
              <div>
                <p className={`text-base font-bold ${theme === "dark" ? "text-blue-300" : "text-[#1a3a5c]"}`}>
                  Ready to Remit?
                </p>
                <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-blue-400/70" : "text-[#5a7a9a]"}`}>
                  Submit you remittance by the end of the day.
                </p>
                <button
                  className="mt-2 bg-[#1a3a5c] hover:bg-[#0f2a4a] text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRemittanceModal(true);
                  }}
                >
                  <FaClipboardList className="text-xs" />
                  Start Remittance
                </button>
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${theme === "dark" ? "bg-blue-900/40" : "bg-[#d0e0f0]"}`}>
                <img
                  src={HandCashIcon}
                  alt="Hand Cash"
                  className="w-8 h-8"
                />
              </div>
            </motion.div>
          </div>

        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col lg:flex-row gap-6">
          <div
            className={`flex-1 min-h-0 flex flex-col rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 border overflow-hidden ${theme === "dark" ?
              "bg-[#2A2724] border-[#4A4037]" :
              "bg-white border-white/80"}`
            }>

            <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-4">
              <div className="relative flex-1 min-w-0 w-full xl:max-w-xs 2xl:max-w-sm">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#AD7F65]" />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by receipt number..."
                  className={`w-full border rounded-2xl h-12 pl-12 pr-4 shadow-inner focus:outline-none focus:border-[#AD7F65] focus:ring focus:ring-[#AD7F65]/20 transition-all ${theme === "dark" ?
                    "bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500" :
                    "bg-white border-gray-200 text-gray-900"}`
                  } />

              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Dropdown
                  label="Date"
                  options={dateOptions}
                  selected={filters.date}
                  showAllAsOptionLabel
                  onSelect={(value) => {
                    setCurrentPage(1);
                    if (value !== "Custom") {
                      setDateRange([null, null]);
                    }
                    if (value === "Custom") {
                      setPickerOpen(true);
                    }
                    setFilters((prev) => ({ ...prev, date: value }));
                  }}
                  isOpen={dropdownOpen.date}
                  setIsOpen={(value) =>
                    setDropdownOpen((prev) => ({ ...prev, date: value }))
                  } />

                <div className="relative z-[100] flex-shrink-0">
                  <DatePicker
                    selectsRange
                    selected={startDate}
                    onChange={(update) => {
                      setDateRange(update);
                      setFilters((prev) => ({ ...prev, date: "Custom" }));
                      setCurrentPage(1);
                      if (update?.[0] && update?.[1]) setPickerOpen(false);
                    }}
                    startDate={startDate}
                    endDate={endDate}
                    open={pickerOpen}
                    onInputClick={() => setPickerOpen(true)}
                    onClickOutside={() => setPickerOpen(false)}
                    dateFormat="MMM d, yyyy"
                    popperPlacement="bottom-start"
                    popperClassName="z-[100]"
                    customInput={
                      <CalendarTrigger
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${filters.date === "Custom" && startDate && endDate ?
                          "border-[#AD7F65] bg-[#AD7F65]/10" :
                          theme === "dark" ?
                            "border-gray-600 bg-[#2A2724] hover:border-[#AD7F65]" :
                            "border-gray-200 bg-white hover:border-[#AD7F65]"
                        }`}
                      />
                    }
                  />
                </div>

                <Dropdown
                  label="User"
                  options={userDropdownOptions}
                  selected={filters.user}
                  onSelect={(value) => {
                    setFilters((prev) => ({ ...prev, user: value }));
                    setCurrentPage(1);
                  }}
                  isOpen={dropdownOpen.user}
                  setIsOpen={(value) =>
                    setDropdownOpen((prev) => ({ ...prev, user: value }))
                  } />

                {isReturnedLogsTab &&
                  <Dropdown
                    label="Returned By"
                    options={returnedByDropdownOptions}
                    selected={filters.returnedBy}
                    onSelect={(value) => {
                      setFilters((prev) => ({ ...prev, returnedBy: value }));
                      setCurrentPage(1);
                    }}
                    isOpen={dropdownOpen.returnedBy}
                    setIsOpen={(value) =>
                      setDropdownOpen((prev) => ({ ...prev, returnedBy: value }))
                    } />
                }

                {!isReturnedLogsTab &&
                  <>
                    <Dropdown
                      label="Payment Method"
                      options={paymentOptions}
                      selected={filters.method}
                      onSelect={(value) =>
                        setFilters((prev) => ({ ...prev, method: value }))
                      }
                      isOpen={dropdownOpen.method}
                      setIsOpen={(value) =>
                        setDropdownOpen((prev) => ({ ...prev, method: value }))
                      } />

                    <Dropdown
                      label="Status"
                      options={statusOptions}
                      selected={filters.status}
                      onSelect={(value) =>
                        setFilters((prev) => ({ ...prev, status: value }))
                      }
                      isOpen={dropdownOpen.status}
                      setIsOpen={(value) =>
                        setDropdownOpen((prev) => ({ ...prev, status: value }))
                      } />
                  </>
                }

              </div>

              <div className="flex items-center gap-3">
              <button
                onClick={handleExportButtonClick}
                className={`rounded-xl shadow-md flex items-center justify-center gap-2 px-4 py-2.5 transition-colors ${isExportSelectionMode ?
                  "border border-[#AD7F65] bg-[#AD7F65]/5" :
                  theme === "dark" ?
                    "bg-[#2A2724] hover:bg-[#352F2A]" :
                    "bg-white hover:bg-gray-50"
                  }`}
                style={{ minWidth: "120px" }}
              >
                <svg
                  className={`w-5 h-5 ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}
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
                <span className={`text-xs font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
                  {isExportSelectionMode ? "Export Selected" : "Export"}
                </span>
              </button>

              {isExportSelectionMode && (
                <button
                  onClick={handleCancelExportSelection}
                  className={`rounded-xl shadow-md px-3 py-2 text-xs font-medium border transition-colors ${theme === "dark" ?
                    "bg-[#2A2724] border-gray-600 text-gray-400 hover:bg-[#352F2A]" :
                    "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  Cancel
                </button>
              )}
            </div>
            </div>

            <div className="relative overflow-x-auto overflow-y-auto flex-1 min-h-0">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0">
                  <tr
                    className={`${theme === "dark" ? "bg-[#352F2A] text-[#C2A68C]" : "bg-[#F6EEE7] text-[#4A3B2F]"} text-xs uppercase tracking-wider`}>
                    {isExportSelectionMode &&
                      <th className="px-4 py-3 font-semibold">
                        <label
                          className={`flex items-center gap-2 ${theme === "dark" ? "text-[#C2A68C]" : "text-[#4A3B2F]"}`}>
                          <input
                            ref={isReturnedLogsTab ? selectAllReturnedLogsRef : selectAllTransactionsRef}
                            type="checkbox"
                            className="w-4 h-4 text-[#AD7F65] border-[#AD7F65] rounded focus:ring-[#AD7F65]"
                            onChange={isReturnedLogsTab ? handleToggleSelectAllReturnedLogs : handleToggleSelectAllTransactions}
                            checked={
                              isExportSelectionMode ?
                                isReturnedLogsTab ?
                                  allVisibleReturnedLogsSelected :
                                  allVisibleTransactionsSelected :
                                false
                            } />
                          <span className="text-[11px] tracking-wide">All</span>
                        </label>
                      </th>
                    }
                    {(isReturnedLogsTab ?
                      [
                        "Receipt No.",
                        "Transaction ID",
                        "Returned Date",
                        "Performed By",
                        "Returned By",
                        "Reason",
                        "Original Amount",
                        "Discounted Amount",
                        "Returned",
                        "Final Total"] :
                      [
                        "Receipt No.",
                        "Transaction ID",
                        "Date",
                        "Performed By",
                        "Payment Method",
                        "Original Amount",
                        "Discounted Amount",
                        "Total",
                        "Status",
                        "Quick Action"]).
                      map((col) =>
                        <th key={col} className="px-4 py-3 font-semibold">
                          {col}
                        </th>
                      )}
                  </tr>
                </thead>
                <tbody>
                  {loading && activeRowCount === 0 &&
                    <tr>
                      <td
                        colSpan={isReturnedLogsTab ? returnedTableColumnCount : transactionTableColumnCount}
                        className="py-10 text-center text-gray-500">
                        Loading transactions...
                      </td>
                    </tr>
                  }
                  {!loading && activeRowCount === 0 &&
                    <tr>
                      <td
                        colSpan={isReturnedLogsTab ? returnedTableColumnCount : transactionTableColumnCount}
                        className="py-10 text-center text-gray-400 italic">
                        {isReturnedLogsTab ?
                          "No returned transactions found" :
                          "No transactions found"}
                      </td>
                    </tr>
                  }
                  {isReturnedLogsTab ?
                    paginatedReturnedLogs.map((row) => {
                      const isActive = selectedTransaction?._id === row._id;
                      return (
                        <tr
                          key={row._id}
                          onClick={() => {
                            const transactionRecord = transactions.find((t) =>
                              sameTransactionId(t, row._id)
                            );
                            if (transactionRecord) {
                              handleRowClick(transactionRecord);
                            }
                          }}
                          className={`cursor-pointer border-b transition-all ${theme === "dark" ?
                            "border-gray-700" :
                            "border-gray-100"} ${isActive ?
                              theme === "dark" ?
                                "bg-[#352F2A]" :
                                "bg-[#FDF7F1] shadow-inner" :
                              theme === "dark" ?
                                "hover:bg-[#2A2521] text-gray-300" :
                                "hover:bg-[#F9F2EC]"}`
                          }>
                          {isExportSelectionMode &&
                            <td
                              className="px-4 py-3"
                              onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-[#AD7F65] border-[#AD7F65] rounded focus:ring-[#AD7F65]"
                                checked={selectedReturnedLogIds.includes(row._id)}
                                onChange={() =>
                                  handleToggleReturnedLogSelection(row._id)
                                }
                                disabled={!row._id} />
                            </td>
                          }
                          <td
                            className={`px-4 py-3 font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                            {row.receiptNo ? `#${row.receiptNo}` : "---"}
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
                            {row.transactionId}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {row.returnedAt.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </td>
                          <td
                            className={`px-4 py-3 align-middle ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <span className="w-8 h-8 rounded-full bg-[#F0E5DB] flex items-center justify-center text-xs font-bold text-[#8B6B55] shrink-0">
                                {getInitials(row.performedByName || "Staff")}
                              </span>
                              <span className="truncate">{row.performedByName || "Staff"}</span>
                            </div>
                          </td>
                          <td
                            className={`px-4 py-3 align-middle ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <span className="w-8 h-8 rounded-full bg-[#F0E5DB] flex items-center justify-center text-xs font-bold text-[#8B6B55] shrink-0">
                                {getInitials(row.returnedByName || "Staff")}
                              </span>
                              <span className="truncate">{row.returnedByName || "Staff"}</span>
                            </div>
                          </td>
                          <td
                            className={`px-4 py-3 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>
                            {row.reason}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(row.originalAmount)}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(row.discountedAmount)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-orange-600">
                            {formatCurrency(-Math.abs(row.returnedAmount))}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(row.totalAmount)}
                          </td>
                        </tr>
                      );
                    }) :
                     paginatedTransactions.map((trx) => {
                      const isActive = selectedTransaction?._id === trx._id;
                      const lineSub = originalSubtotalFromItems(trx) || trx.originalTotalAmount || trx.totalAmount || 0;
                      const hasReturnActivity =
                        (trx.returnTransactions?.length || 0) > 0 ||
                        trx.status === "Returned" ||
                        trx.status === "Partially Returned";
                      const discountedAmount = resolveTransactionDiscount(trx, lineSub, {
                        skipInference: hasReturnActivity
                      });
                      return (
                        <tr
                          key={trx._id}
                          onClick={() => handleRowClick(trx)}
                          className={`cursor-pointer border-b transition-all ${theme === "dark" ?
                            "border-gray-700" :
                            "border-gray-100"} ${isActive ?
                              theme === "dark" ?
                                "bg-[#352F2A]" :
                                "bg-[#FDF7F1] shadow-inner" :
                              theme === "dark" ?
                                "hover:bg-[#2A2521] text-gray-300" :
                                "hover:bg-[#F9F2EC]"}`
                          }>
                          {isExportSelectionMode &&
                            <td
                              className="px-4 py-3"
                              onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-[#AD7F65] border-[#AD7F65] rounded focus:ring-[#AD7F65]"
                                checked={selectedTransactionIds.includes(trx._id)}
                                onChange={() =>
                                  handleToggleTransactionSelection(trx._id)
                                }
                                disabled={!trx._id} />
                            </td>
                          }
                          <td
                            className={`px-4 py-3 font-semibold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                            {trx.receiptNo ? `#${trx.receiptNo}` : "---"}
                          </td>
                          <td
                            className={`px-4 py-3 font-semibold text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-700"}`}>
                            {trx.referenceNo ||
                              trx._id?.substring(0, 12) ||
                              "---"}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(trx.checkedOutAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              }
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 flex items-center gap-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                            <span className="w-8 h-8 rounded-full bg-[#F0E5DB] flex items-center justify-center text-xs font-bold text-[#8B6B55]">
                              {getInitials(trx.performedByName || "Staff")}
                            </span>
                            {trx.performedByName || "Staff"}
                          </td>
                          <td className="px-4 py-3 capitalize">
                            {trx.paymentMethod}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(lineSub)}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(discountedAmount)}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {formatCurrency(trx.totalAmount)}
                          </td>
                          <td className="px-4 py-3">
                            {renderStatusPill(trx.status)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                title="View"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewClick(trx);
                                }}
                                className={`w-9 h-9 border rounded-xl flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 whitespace-nowrap transition-all ${theme === "dark" ?
                                  "bg-[#2A2724] border-gray-600 text-gray-400 hover:border-green-500 hover:text-green-500" :
                                  "bg-white border-gray-200 text-gray-500 hover:border-green-500 hover:text-green-600"}`
                                }>
                                <FaEye />
                              </button>
                              <button
                                title="Print"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePrintClick(trx);
                                }}
                                className={`w-9 h-9 border rounded-xl flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${theme === "dark" ?
                                  "bg-[#2A2724] border-gray-600 text-gray-400 hover:border-blue-500 hover:text-blue-500" :
                                  "bg-white border-gray-200 text-gray-500 hover:border-blue-500 hover:text-blue-600"}`
                                }>
                                <FaPrint />
                              </button>
                              {isTransactionReturnable(trx) &&
                                trx.status !== "Returned" &&
                                trx.status !== "Voided" &&
                                <button
                                  title="Return"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReturnClick(trx);
                                  }}
                                  className={`w-9 h-9 border rounded-xl flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all ${theme === "dark" ?
                                    "bg-[#2A2724] border-gray-600 text-gray-400 hover:border-orange-500 hover:text-orange-500" :
                                    "bg-white border-gray-200 text-gray-500 hover:border-orange-500 hover:text-orange-600"}`
                                  }>
                                  <FaUndoAlt />
                                </button>
                              }
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-5">
              <div
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                Showing {showingStart}-{showingEnd} of {activeRowCount}
              </div>
              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1 shadow-inner ${theme === "dark" ?
                  "bg-[#1E1B18] border-gray-600" :
                  "bg-white border-gray-200"}`
                }>

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={`p-2 rounded-full ${currentPage === 1 ?
                    theme === "dark" ?
                      "text-gray-600" :
                      "text-gray-300" :
                    theme === "dark" ?
                      "hover:bg-[#2A2724] text-gray-400" :
                      "hover:bg-gray-50 text-gray-600"}`
                  }>

                  <FaChevronLeft />
                </button>
                {Array.from({ length: totalPages }).
                  slice(0, 5).
                  map((_, idx) => {
                    const pageNumber = idx + 1;
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`w-8 h-8 rounded-full text-sm font-semibold ${currentPage === pageNumber ?
                          "bg-[#AD7F65] text-white shadow-md" :
                          "text-gray-600 hover:bg-gray-50"}`
                        }>

                        {pageNumber}
                      </button>);

                  })}
                <span className="text-gray-400 px-2">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className={`w-8 h-8 rounded-full text-sm font-semibold ${currentPage === totalPages ?
                    "bg-[#AD7F65] text-white shadow-md" :
                    "text-gray-600 hover:bg-gray-50"}`
                  }>

                  {totalPages}
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-full ${currentPage === totalPages ?
                    theme === "dark" ?
                      "text-gray-600" :
                      "text-gray-300" :
                    theme === "dark" ?
                      "hover:bg-[#2A2724] text-gray-400" :
                      "hover:bg-gray-50 text-gray-600"}`
                  }>

                  <FaChevronRight />
                </button>
              </div>
            </div>
          </div>

          {!isReturnedLogsTab &&
            <div className="w-full lg:w-[380px] xl:w-[420px]">
            <div
              className={`rounded-2xl border shadow-[0_20px_45px_rgba(0,0,0,0.08)] p-6 sticky top-8 ${theme === "dark" ?
                "bg-[#2A2724] border-[#4A4037]" :
                "bg-white border-white"}`
              }>

              <div className="mb-4">
                <p className="text-sm text-gray-400">{receiptBranding.storeName}</p>
                {receiptBranding.receiptTagline ?
                <p className="text-[11px] text-gray-500 mb-0.5">
                    {receiptBranding.receiptTagline}
                  </p> :
                null}
                <p className="text-xs text-gray-400">
                  {receiptBranding.location}
                </p>
              </div>
              <div
                className={`font-mono text-xs space-y-2 ${theme === "dark" ? "text-gray-300" : ""}`}>

                {!isReturnedLogsTab &&
                  <div className="flex justify-between text-gray-500">
                    <span>Receipt No:</span>
                    <span className="font-bold text-[#AD7F65]">
                      {selectedTransaction?.status === "Completed" &&
                        selectedTransaction?.receiptNo ?
                        `#${selectedTransaction.receiptNo}` :
                        "---"}
                    </span>
                  </div>
                }
                <div className="flex justify-between text-gray-500">
                  <span>Date:</span>
                  <span>
                    {selectedTransaction ?
                      new Date(
                        selectedTransaction.checkedOutAt
                      ).toLocaleString() :
                      "-"}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Cashier:</span>
                  <span>{selectedTransaction?.performedByName || "---"}</span>
                </div>
              </div>
              <div
                className={`border-t border-b my-4 py-3 font-mono text-sm ${theme === "dark" ? "border-gray-700 text-gray-300" : "border-gray-200"}`}>

                <div className="flex justify-between font-semibold">
                  <span>Item</span>
                  <span>Qty x Price</span>
                </div>
                <div
                  className={`mt-2 space-y-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                  {selectedTransaction?.items?.map((item, idx) =>
                    <div key={idx} className="flex justify-between">
                      <span>{item.itemName}</span>
                      <span>
                        {item.quantity} x {formatCurrency(item.price)}
                      </span>
                    </div>
                  ) || <p className="text-center text-gray-400">No items</p>}
                </div>
              </div>
              <div
                className={`font-mono text-xs space-y-1 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>

                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="uppercase">
                    {selectedTransaction?.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>
                    {formatCurrency(sidebarReceiptTotals.lineSub)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>
                    {formatCurrency(sidebarReceiptTotals.discount)}
                  </span>
                </div>
                {sidebarReceiptTotals.hasVat &&
                  <div className="space-y-1 pt-1 border-t border-dashed border-gray-600/40">
                    <div className="flex justify-between">
                      <span>Net (vatable) sales</span>
                      <span>{formatCurrency(sidebarReceiptTotals.netOfVat)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        VAT {Number(selectedTransaction.vatRateApplied ?? receiptBranding.vatRatePercent)}%
                      </span>
                      <span>{formatCurrency(sidebarReceiptTotals.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT Exempt Sales</span>
                      <span>{formatCurrency(sidebarReceiptTotals.vatExemptSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Zero-Rated Sales</span>
                      <span>{formatCurrency(0)}</span>
                    </div>
                  </div>}
                <div
                  className={`flex justify-between font-semibold text-base pt-2 border-t ${theme === "dark" ? "text-white border-gray-700" : "text-gray-800 border-gray-100"}`}>

                  <span>
                    {sidebarReceiptTotals.hasVat ? "Total (incl. VAT)" : "Total"}
                  </span>
                  <span>
                    {formatCurrency(selectedTransaction?.totalAmount || 0)}
                  </span>
                </div>
              </div>
              <button
                className="w-full mt-6 py-3 rounded-xl text-white font-semibold shadow-lg transition-all hover:shadow-xl hover:brightness-105 active:scale-98"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #AD7F65 0%, #76462B 100%)",
                  boxShadow: "0 12px 20px rgba(118,70,43,0.25)"
                }}>

                Print Receipt
              </button>
              <p className="text-center text-[11px] text-gray-400 mt-4 tracking-wide">
                This is not an official receipt
              </p>
            </div>
          </div>
          }
        </div>

        <ViewTransactionModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setTransactionToView(null);
          }}
          transaction={transactionToView}
          onReturnItems={(trx) => {
            setShowViewModal(false);
            setTransactionToView(null);
            handleReturnClick(trx);
          }}
          onPrintReceipt={(trx) => {
            setShowViewModal(false);
            setTransactionToView(null);
            handlePrintClick(trx);
          }} />


        <PrintReceiptModal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setTransactionToPrint(null);
          }}
          transaction={transactionToPrint} />


        <ReturnItemsModal
          isOpen={showReturnModal}
          onClose={() => {
            setShowReturnModal(false);
            setTransactionToReturn(null);
          }}
          transaction={transactionToReturn}
          onConfirm={handleReturnConfirm} />


        { }
        {showReturnSuccessModal &&
          <div className="fixed inset-0 flex items-center justify-center z-[10002] bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-2xl text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                <FaCheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Return Processed!
              </h3>
              <p className="text-gray-500 mb-6">
                The return has been processed successfully.
              </p>
              <button
                onClick={() => {
                  setShowReturnSuccessModal(false);
                }}
                className="px-8 py-3 rounded-lg text-white font-semibold transition-all hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, #22C55E 0%, #16A34A 100%)"
                }}>

                OK
              </button>
            </div>
          </div>
        }

        <RemittanceModal
          isOpen={showRemittanceModal}
          onClose={() => setShowRemittanceModal(false)}
          employeeId={currentUser?._id}
          employeeName={currentUser?.name || currentUser?.firstName || ""}
        />
      </>
    </div>);

};

export default memo(Transaction);