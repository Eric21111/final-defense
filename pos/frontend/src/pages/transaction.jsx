import { AnimatePresence, motion } from "framer-motion";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from
  "react";
import {
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
import CompletedIcon from "../assets/completed.svg";
import TotalTransactionIcon from "../assets/total-transaction.svg";
import Header from "../components/shared/header";
import PrintReceiptModal from "../components/transaction/PrintReceiptModal";
import RemittanceModal from "../components/transaction/RemittanceModal";
import ReturnItemsModal from "../components/transaction/ReturnItemsModal";
import ViewTransactionModal from "../components/transaction/ViewTransactionModal";
import { API_BASE_URL } from "../config/api";
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
const dateOptions = ["All", "Today", "Last 7 days", "Last 30 days"];

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

const Dropdown = ({
  label,
  options,
  selected,
  onSelect,
  isOpen,
  setIsOpen
}) => {
  const dropdownRef = React.useRef(null);
  const { theme } = useTheme();

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
          {selected === "All" ? label : selected}
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

            {options.map((option) =>
              <li
                key={option}
                onClick={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${option === selected ?
                  "bg-[#F6EEE7] text-[#76462B] font-semibold" :
                  theme === "dark" ?
                    "text-gray-300 hover:bg-[#352F2A]" :
                    "text-gray-700 hover:bg-gray-50"}`
                }>

                {option}
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
  const { getCachedData, setCachedData, isCacheValid, invalidateCache } =
    useDataCache();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState({
    date: false,
    method: false,
    status: false,
    user: false
  });
  const [filters, setFilters] = useState({
    date: "All",
    method: "All",
    status: "All",
    user: "All"
  });
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
  const [isExportSelectionMode, setIsExportSelectionMode] = useState(false);
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const isInitialMount = useRef(true);
  const hasLoaded = useRef(false);
  const isInitialLoading = useRef(true);
  const setCachedDataRef = useRef(setCachedData);
  const selectAllTransactionsRef = useRef(null);


  useEffect(() => {
    setCachedDataRef.current = setCachedData;
  }, [setCachedData]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (filters.method !== "All")
        params.append("paymentMethod", filters.method);
      if (filters.status !== "All") params.append("status", filters.status);
      if (filters.user !== "All") params.append("userId", filters.user);


      params.append("limit", "500");
      const qs = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(
        `${API_BASE_URL}/api/transactions${qs}`
      );
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        const allTransactions = data.data;


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
        if (payload.length > 0) {
          setSelectedTransaction(payload[0]);
        }
      } else {
        setTransactions([]);
        setCachedDataRef.current("transactions", []);
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
      setTransactions([]);
      setCachedDataRef.current("transactions", []);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters.method, filters.status, filters.user]);


  useEffect(() => {
    if (hasLoaded.current) return;

    hasLoaded.current = true;

    const loadInitialData = async () => {
      try {
        const cachedTransactions = getCachedData("transactions");
        if (
          cachedTransactions &&
          isCacheValid("transactions") &&
          cachedTransactions.length > 0) {

          const sortedCached = [...cachedTransactions].sort((a, b) => {
            const dateA = new Date(
              a.checkedOutAt || a.createdAt || a.updatedAt || 0
            );
            const dateB = new Date(
              b.checkedOutAt || b.createdAt || b.updatedAt || 0
            );
            return dateB - dateA;
          });
          setTransactions(sortedCached);
          if (sortedCached.length > 0) {
            setSelectedTransaction(sortedCached[0]);
          }
          isInitialMount.current = false;
          isInitialLoading.current = false;
        } else {
          await fetchTransactions();
          isInitialMount.current = false;
          isInitialLoading.current = false;
        }
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

  const generateSampleTransactions = () => [];


  const allRegularTransactions = useMemo(() => {
    return transactions.filter(
      (trx) => !(trx.paymentMethod === "return" && trx.originalTransactionId)
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {


    const filtered = transactions.filter((trx) => {

      if (trx.paymentMethod === "return" && trx.originalTransactionId) {
        return false;
      }


      if (trx.status === "Voided") {
        return false;
      }


      if (trx.status === "Pending" || trx.status === "Failed") {
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

      const matchesUser =
        filters.user === "All" || trx.performedByName === filters.user;


      let matchesDate = true;
      if (filters.date !== "All") {
        const trxDate = new Date(trx.checkedOutAt || trx.createdAt);
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        if (filters.date === "Today") {
          const trxDay = new Date(
            trxDate.getFullYear(),
            trxDate.getMonth(),
            trxDate.getDate()
          );
          matchesDate = trxDay.getTime() === today.getTime();
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

    });



    return filtered.sort((a, b) => {
      const dateA = new Date(a.checkedOutAt || a.createdAt || a.updatedAt || 0);
      const dateB = new Date(b.checkedOutAt || b.createdAt || b.updatedAt || 0);
      return dateB - dateA;
    });
  }, [transactions, search, filters]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTransactions, currentPage]);
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

  const stats = useMemo(() => {

    const nonVoidedTransactions = transactions.filter(
      (trx) => trx.status !== "Voided"
    );
    const totals = {
      total: nonVoidedTransactions.length,
      Completed: 0,
      Returned: 0,
      "Partially Returned": 0,
      Voided: 0
    };

    nonVoidedTransactions.forEach((trx) => {
      totals[trx.status] = (totals[trx.status] || 0) + 1;
    });

    return totals;
  }, [transactions]);

  useEffect(() => {
    setSelectedTransactionIds((prev) =>
      prev.filter((id) => filteredTransactions.some((trx) => trx._id === id))
    );
  }, [filteredTransactions]);

  useEffect(() => {
    if (selectAllTransactionsRef.current) {
      selectAllTransactionsRef.current.indeterminate =
        isExportSelectionMode &&
        !allVisibleTransactionsSelected &&
        someVisibleTransactionsSelected;
    }
  }, [
    isExportSelectionMode,
    allVisibleTransactionsSelected,
    someVisibleTransactionsSelected]
  );


  const userDropdownOptions = useMemo(() => {
    const uniqueUsers = new Set();
    transactions.forEach((t) => {
      if (t.performedByName) {
        uniqueUsers.add(t.performedByName);
      }
    });
    return ["All", ...Array.from(uniqueUsers).sort()];
  }, [transactions]);

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

  const handleExportButtonClick = () => {
    if (!isExportSelectionMode) {
      setIsExportSelectionMode(true);
      setSelectedTransactionIds([]);
      return;
    }
    handleExportToCSV();
  };

  const handleCancelExportSelection = () => {
    setIsExportSelectionMode(false);
    setSelectedTransactionIds([]);
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

  const handleReturnConfirm = async (itemsToReturn, transaction) => {
    try {
      setLoading(true);
      console.log("Processing return for items:", itemsToReturn);


      const returnedIndices = itemsToReturn.map((item) => item.originalIndex);


      const damagedItems = itemsToReturn.filter(
        (item) =>
          item.reason === "Damaged" ||
          item.reason === "Defective" ||
          item.reason === "Expired"
      );
      const returnableItems = itemsToReturn.filter(
        (item) =>
          item.reason !== "Damaged" &&
          item.reason !== "Defective" &&
          item.reason !== "Expired"
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


      const updatePayload = {
        status: newStatus,
        items: updatedItems,
        totalAmount: newTotalAmount
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
          reason: item.reason === "Expired" ? "Other" : item.reason,
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
        }
      }


      if (returnableItems.length > 0) {
        const stockUpdatePayload = {
          items: returnableItems.map((item) => ({
            _id: item.productId,
            sku: item.sku,
            size: item.selectedSize,
            quantity: item.quantity
          })),
          performedByName: transaction.performedByName || "System",
          performedById: transaction.performedById || "",
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
        const stockData = await stockResponse.json();
        console.log("Stock update response:", stockData);

        if (!stockData.success) {
          console.error("Failed to update stock:", stockData);
        }
      }


      for (const item of itemsToReturn) {
        const returnTransaction = {
          userId: transaction.userId,
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
          performedById: transaction.performedById,
          performedByName: transaction.performedByName,
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

      setShowReturnSuccessModal(true);
    } catch (error) {
      console.error("Error processing return:", error);
      alert("Failed to process return. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(filteredTransactions.length / rowsPerPage) || 1;
  const transactionTableColumnCount = isExportSelectionMode ? 10 : 9;


  if (isInitialLoading.current && transactions.length === 0) {
    return (
      <div
        className="p-6 min-h-screen flex items-center justify-center"
        style={{ background: "#F5F5F5" }}>

        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#8B7355] mb-4"></div>
          <p className="text-gray-600">Loading transactions...</p>
        </div>
      </div>);

  }

  return (
    <div
      className={`p-6 min-h-screen ${theme === "dark" ? "bg-[#1E1B18]" : "bg-[#F5F5F5]"}`}>

      <>
        <Header
          pageName="POS Transactions"
          showBorder={false}
          profileBackground="" />


        <div className="flex gap-4 flex-wrap mb-6 mt-4 justify-between">
          <div className="flex gap-4 flex-wrap">
            {[
              {
                label: "Total Transactions",
                count: stats.total,
                borderColor: "#3B82F6",
                textColor: "#3B82F6",
                iconBg: "#DBEAFE",
                icon:
                  <img
                    src={TotalTransactionIcon}
                    alt="Total Transactions"
                    className="w-10 h-10" />


              },
              {
                label: "Completed",
                count: stats.Completed || 0,
                borderColor: "#22C55E",
                textColor: "#22C55E",
                iconBg: "#DCFCE7",
                icon:
                  <img
                    src={CompletedIcon}
                    alt="Completed"
                    className="w-10 h-10" />


              },
              {
                label: "Returned",
                count: stats.Returned || 0,
                borderColor: "#F97316",
                textColor: "#F97316",
                iconBg: "#FFEDD5",
                icon: <FaUndoAlt />
              }].
              map((card) =>
                <motion.div
                  key={card.label}
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden text-left ${theme === "dark" ? "bg-[#2A2724]" : "bg-white"}`
                  }
                  style={{ minWidth: "200px" }}>

                  <div
                    className="absolute left-0 top-0 bottom-0 w-2"
                    style={{ backgroundColor: card.borderColor }} />

                  <div className="ml-2">
                    <motion.p
                      key={card.count}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-3xl font-bold"
                      style={{ color: card.textColor }}>

                      {card.count}
                    </motion.p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: card.textColor }}>

                      {card.label}
                    </p>
                  </div>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                    style={{
                      backgroundColor: card.iconBg,
                      color: card.textColor
                    }}>

                    {card.icon}
                  </div>
                </motion.div>
              )}

            {/* Ready to Remit Card */}
            <motion.div
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden cursor-pointer ${theme === "dark" ? "bg-[#1a2332]" : "bg-[#E8F0FE]"
                }`}
              style={{ minWidth: "260px" }}
              onClick={() => setShowRemittanceModal(true)}
            >
              <div>
                <p className={`text-base font-bold ${theme === "dark" ? "text-blue-300" : "text-[#1a3a5c]"}`}>
                  Ready to Remit?
                </p>
                <p className={`text-xs mt-0.5 ${theme === "dark" ? "text-blue-400/70" : "text-[#5a7a9a]"}`}>
                  You can submit your remittance anytime
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
                <svg className={`w-7 h-7 ${theme === "dark" ? "text-blue-400" : "text-[#1a3a5c]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 7v4m0 0v4m0-4h4m-4 0H6" />
                </svg>
              </div>
            </motion.div>
          </div>

          <div className="flex gap-4 items-start">
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


          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div
            className={`flex-1 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.06)] p-6 border ${theme === "dark" ?
              "bg-[#2A2724] border-[#4A4037]" :
              "bg-white border-white/80"}`
            }>

            <div className="flex flex-col xl:flex-row xl:items-center gap-4 mb-4">
              <div className="relative flex-1">
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
              <div className="flex flex-wrap gap-3">
                <Dropdown
                  label="Date"
                  options={dateOptions}
                  selected={filters.date}
                  onSelect={(value) =>
                    setFilters((prev) => ({ ...prev, date: value }))
                  }
                  isOpen={dropdownOpen.date}
                  setIsOpen={(value) =>
                    setDropdownOpen((prev) => ({ ...prev, date: value }))
                  } />

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
                  label="User"
                  options={userDropdownOptions}
                  selected={filters.user}
                  onSelect={(value) =>
                    setFilters((prev) => ({ ...prev, user: value }))
                  }
                  isOpen={dropdownOpen.user}
                  setIsOpen={(value) =>
                    setDropdownOpen((prev) => ({ ...prev, user: value }))
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

              </div>
            </div>

            <div className="relative overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="sticky top-0">
                  <tr
                    className={`${theme === "dark" ? "bg-[#352F2A] text-[#C2A68C]" : "bg-[#F6EEE7] text-[#4A3B2F]"} text-xs uppercase tracking-wider`}>

                    {isExportSelectionMode &&
                      <th className="px-4 py-3 font-semibold">
                        <label
                          className={`flex items-center gap-2 ${theme === "dark" ? "text-[#C2A68C]" : "text-[#4A3B2F]"}`}>

                          <input
                            ref={selectAllTransactionsRef}
                            type="checkbox"
                            className="w-4 h-4 text-[#AD7F65] border-[#AD7F65] rounded focus:ring-[#AD7F65]"
                            onChange={handleToggleSelectAllTransactions}
                            checked={
                              isExportSelectionMode ?
                                allVisibleTransactionsSelected :
                                false
                            } />

                          <span className="text-[11px] tracking-wide">All</span>
                        </label>
                      </th>
                    }
                    {[
                      "Receipt No.",
                      "Transaction ID",
                      "Date",
                      "Performed By",
                      "Payment Method",
                      "Total",
                      "Status",
                      "Quick Action"].
                      map((col) =>
                        <th key={col} className="px-4 py-3 font-semibold">
                          {col}
                        </th>
                      )}
                  </tr>
                </thead>
                <tbody>
                  {loading && paginatedTransactions.length === 0 &&
                    <tr>
                      <td
                        colSpan={transactionTableColumnCount}
                        className="py-10 text-center text-gray-500">

                        Loading transactions...
                      </td>
                    </tr>
                  }
                  {!loading && paginatedTransactions.length === 0 &&
                    <tr>
                      <td
                        colSpan={transactionTableColumnCount}
                        className="py-10 text-center text-gray-400 italic">

                        No transactions found
                      </td>
                    </tr>
                  }
                  {paginatedTransactions.map((trx, index) => {
                    const isActive = selectedTransaction?._id === trx._id;
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
                      </tr>);

                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-5">
              <div
                className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>

                Showing {(currentPage - 1) * rowsPerPage + 1}-
                {Math.min(
                  currentPage * rowsPerPage,
                  filteredTransactions.length
                )}{" "}
                of {filteredTransactions.length}
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

          <div className="w-full lg:w-[380px] xl:w-[420px]">
            <div
              className={`rounded-2xl border shadow-[0_20px_45px_rgba(0,0,0,0.08)] p-6 sticky top-8 ${theme === "dark" ?
                "bg-[#2A2724] border-[#4A4037]" :
                "bg-white border-white"}`
              }>

              <div className="mb-4">
                <p className="text-sm text-gray-400">Create Your Style</p>
                <p className="text-xs text-gray-400">
                  Pasonanca, Zamboanga City
                </p>
              </div>
              <div
                className={`font-mono text-xs space-y-2 ${theme === "dark" ? "text-gray-300" : ""}`}>

                <div className="flex justify-between text-gray-500">
                  <span>Receipt No:</span>
                  <span className="font-bold text-[#AD7F65]">
                    {selectedTransaction?.status === "Completed" &&
                      selectedTransaction?.receiptNo ?
                      `#${selectedTransaction.receiptNo}` :
                      "---"}
                  </span>
                </div>
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
                <div
                  className={`flex justify-between font-semibold text-base pt-2 border-t ${theme === "dark" ? "text-white border-gray-700" : "text-gray-800 border-gray-100"}`}>

                  <span>Total</span>
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
                  window.location.reload();
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