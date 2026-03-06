import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaSearch } from 'react-icons/fa';
import PullOutIcon from '../assets/logs/pull_out.svg';
import StockInIcon from '../assets/logs/stock-in.svg';
import StockOutIcon from '../assets/logs/stock-out.svg';
import ViewVoidLogModal from '../components/logs/ViewVoidLogModal';
import Header from '../components/shared/header';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { useDataCache } from '../context/DataCacheContext';
import { useTheme } from '../context/ThemeContext';

const Logs = () => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const { getCachedData, setCachedData, isCacheValid, invalidateCache } = useDataCache();
  const [activeTab, setActiveTab] = useState('stock-movement');
  const [movements, setMovements] = useState(() => getCachedData('stockMovements') || []);
  const [voidLogs, setVoidLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showVoidLogModal, setShowVoidLogModal] = useState(false);
  const [selectedVoidLog, setSelectedVoidLog] = useState(null);
  const [stats, setStats] = useState(() => getCachedData('stats') || {
    stockIns: 0,
    stockOuts: 0,
    pullOuts: 0
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [filterBrand, setFilterBrand] = useState('All');
  const [filterDate, setFilterDate] = useState('All');
  const [filterReason, setFilterReason] = useState('All');
  const [sortBy, setSortBy] = useState('date-desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [voidCurrentPage, setVoidCurrentPage] = useState(1);
  const rowsPerPage = 8;
  const [selectedMovementIds, setSelectedMovementIds] = useState([]);
  const [isMovementExportMode, setIsMovementExportMode] = useState(false);

  const categories = ['All', 'Tops', 'Bottoms', 'Dresses', 'Makeup', 'Accessories', 'Shoes', 'Head Wear', 'Foods'];
  const types = ['All', 'Stock-In', 'Stock-Out', 'Pull-Out'];
  const reasons = ['All', 'Restock', 'Sold', 'Returned Item', 'Return', 'Exchange', 'Damaged', 'Lost', 'Expired', 'Adjustment', 'Initial Stock', 'Other'];
  const dateOptions = ['All', 'Today', 'This Week', 'This Month'];
  const sortOptions = [
    { value: 'date-desc', label: 'Date: Newest First' },
    { value: 'date-asc', label: 'Date: Oldest First' },
    { value: 'name-asc', label: 'Name: A-Z' },
    { value: 'name-desc', label: 'Name: Z-A' },
    { value: 'sku-asc', label: 'SKU: A-Z' },
    { value: 'sku-desc', label: 'SKU: Z-A' }
  ];

  // Only fetch if cache is empty or invalid
  useEffect(() => {
    const cachedMovements = getCachedData('stockMovements');
    const cachedStats = getCachedData('stats');

    if (!cachedMovements || !isCacheValid('stockMovements')) {
      fetchMovements();
    } else {
      setMovements(cachedMovements);
    }

    if (!cachedStats || !isCacheValid('stats')) {
      fetchStats();
    } else {
      setStats(cachedStats);
    }
  }, []);

  // Fetch void logs when void logs tab is active
  useEffect(() => {
    if (activeTab === 'void-logs') {
      fetchVoidLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'stock-movement') {
      setIsMovementExportMode(false);
      setSelectedMovementIds([]);
    }
  }, [activeTab]);

  // Refetch movements when filters change (but use cache for initial load)
  const isInitialMount = useRef(true);
  const selectAllMovementsRef = useRef(null);
  useEffect(() => {
    // Skip on initial mount (already handled by first useEffect)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // Refetch when filters change (but not when page changes - we'll handle that client-side)
    setCurrentPage(1); // Reset to first page when filters change
    fetchMovements();
  }, [searchQuery, filterCategory, filterType, filterBrand, filterDate, filterReason, sortBy]);

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/stock-movements/stats/today');
      const data = await response.json();
      if (data.success) {
        // Map backend response to frontend expected format
        const mappedStats = {
          stockIns: data.data.stockIn || 0,
          stockOuts: data.data.stockOut || 0,
          pullOuts: data.data.pullOut || 0
        };
        setStats(mappedStats);
        setCachedData('stats', mappedStats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        search: searchQuery,
        category: filterCategory,
        type: filterType,
        brand: filterBrand,
        date: filterDate,
        reason: filterReason,
        sortBy: sortBy,
        limit: '1000' // Fetch all movements, paginate client-side
      });

      const response = await fetch(`http://localhost:5000/api/stock-movements?${params}`);
      const data = await response.json();

      if (data.success) {
        setMovements(data.data || []);
        setCachedData('stockMovements', data.data || []);
      }
    } catch (error) {
      console.error('Error fetching movements:', error);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVoidLogs = async () => {
    try {
      setLoading(true);
      // Fetch from VoidLog collection which has the voidId
      const response = await fetch('http://localhost:5000/api/void-logs?limit=1000&sortBy=voidedAt&sortOrder=desc');
      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setVoidLogs(data.data);
      } else {
        setVoidLogs([]);
      }
    } catch (error) {
      console.error('Error fetching void logs:', error);
      setVoidLogs([]);
    } finally {
      setLoading(false);
    }
  };


  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getTypeBadge = (type) => {
    const styles = {
      'Stock-In': 'bg-green-100 text-green-700',
      'Stock-Out': 'bg-red-100 text-red-700',
      'Pull-Out': 'bg-orange-100 text-orange-700'
    };

    const dotStyles = {
      'Stock-In': 'bg-green-600',
      'Stock-Out': 'bg-red-600',
      'Pull-Out': 'bg-orange-600'
    };

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${styles[type] || 'bg-gray-100 text-gray-700'}`}>
        <span className={`w-2 h-2 rounded-full ${dotStyles[type] || 'bg-gray-500'}`}></span>
        {type}
      </span>
    );
  };

  const getQuantityColor = (type, quantity) => {
    if (type === 'Stock-In') return 'text-green-600';
    if (type === 'Stock-Out') return 'text-red-600';
    if (type === 'Pull-Out') return 'text-orange-600';
    return 'text-gray-600';
  };

  const handleToggleMovementSelection = (movementId) => {
    if (!movementId) return;
    setSelectedMovementIds((prev) =>
      prev.includes(movementId)
        ? prev.filter((id) => id !== movementId)
        : [...prev, movementId]
    );
  };

  const handleToggleSelectAllMovements = () => {
    setSelectedMovementIds((prev) => {
      if (allVisibleMovementsSelected) {
        return prev.filter((id) => !paginatedMovementIds.includes(id));
      }
      const merged = new Set(prev);
      paginatedMovementIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  };

  const handleMovementExportButtonClick = () => {
    if (!isMovementExportMode) {
      setIsMovementExportMode(true);
      setSelectedMovementIds([]);
      return;
    }
    handleExport();
  };

  const handleCancelMovementSelection = () => {
    setIsMovementExportMode(false);
    setSelectedMovementIds([]);
  };

  const handleExport = () => {
    // Export all stock movements to CSV with all details
    const movementsToExport = selectedMovementIds.length > 0
      ? filteredMovements.filter((movement) => selectedMovementIds.includes(movement._id))
      : [];

    if (movementsToExport.length === 0) {
      alert('Please select at least one stock movement to export.');
      return;
    }

    const headers = [
      'ID',
      'SKU',
      'Item Name',
      'Category',
      'Brand',
      'Type',
      'Quantity',
      'Size Breakdown',
      'Stock Before',
      'Stock After',
      'Reason',
      'Handled By',
      'Handled By ID',
      'Notes',
      'Item Image',
      'Date & Time',
      'Created At',
      'Updated At'
    ];

    const csvData = movementsToExport.map(m => [
      m._id || '',
      m.sku || '',
      m.itemName || '',
      m.category || '',
      m.brandName || '',
      m.type || '',
      m.quantity || 0,
      m.sizeQuantities ? JSON.stringify(m.sizeQuantities) : '',
      m.stockBefore || 0,
      m.stockAfter || 0,
      m.reason || '',
      m.handledBy || '',
      m.handledById || '',
      m.notes || '',
      m.itemImage || '',
      formatDateTime(m.createdAt),
      m.createdAt || '',
      m.updatedAt || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `stock_movements_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsMovementExportMode(false);
    setSelectedMovementIds([]);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          alert('CSV file is empty or invalid');
          return;
        }

        // Parse CSV (skip header row)
        const dataRows = lines.slice(1);
        const importedMovements = [];

        for (const row of dataRows) {
          // Parse CSV row (handle quoted values)
          const values = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];

          if (values.length >= 11) {
            importedMovements.push({
              sku: values[1],
              itemName: values[2],
              category: values[3],
              brandName: values[4],
              type: values[5],
              quantity: parseInt(values[6]) || 0,
              sizeQuantities: values[7] ? JSON.parse(values[7]) : null,
              stockBefore: parseInt(values[8]) || 0,
              stockAfter: parseInt(values[9]) || 0,
              reason: values[10],
              handledBy: values[11] || currentUser?.name || 'System',
              handledById: values[12] || currentUser?._id || '',
              notes: values[13] || 'Imported from CSV'
            });
          }
        }

        if (importedMovements.length === 0) {
          alert('No valid data found in CSV file');
          return;
        }

        // Send to backend
        const response = await fetch('http://localhost:5000/api/stock-movements/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ movements: importedMovements })
        });

        const result = await response.json();

        if (result.success) {
          alert(`Successfully imported ${importedMovements.length} stock movements`);
          fetchMovements();
          fetchStats();
        } else {
          alert(`Import failed: ${result.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import CSV file. Please check the file format.');
      }
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  const handleView = (item) => {
    // For void logs, open the void log modal
    if (activeTab === 'void-logs') {
      setSelectedVoidLog(item);
      setShowVoidLogModal(true);
    } else {
      // For stock movements, just log for now
      console.log('View movement:', item);
    }
  };

  // Get unique brands from movements
  const uniqueBrands = useMemo(() => {
    const brands = new Set(movements.map(m => m.brandName).filter(Boolean));
    return ['All', ...Array.from(brands).sort()];
  }, [movements]);

  // Filter movements client-side (similar to transaction.jsx)
  const filteredMovements = useMemo(() => {
    let filtered = movements;

    // Filter by category
    if (filterCategory !== 'All') {
      filtered = filtered.filter(m => m.category === filterCategory);
    }

    // Filter by type
    if (filterType !== 'All') {
      filtered = filtered.filter(m => m.type === filterType);
    }

    // Filter by brand
    if (filterBrand !== 'All') {
      filtered = filtered.filter(m => m.brandName === filterBrand);
    }

    // Filter by reason
    if (filterReason !== 'All') {
      filtered = filtered.filter(m => m.reason === filterReason);
    }

    // Filter by date
    if (filterDate !== 'All') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today);
      thisWeek.setDate(today.getDate() - 7);
      const thisMonth = new Date(today);
      thisMonth.setMonth(today.getMonth() - 1);

      filtered = filtered.filter(m => {
        const movementDate = new Date(m.createdAt || 0);
        switch (filterDate) {
          case 'Today':
            return movementDate >= today;
          case 'This Week':
            return movementDate >= thisWeek;
          case 'This Month':
            return movementDate >= thisMonth;
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.itemName?.toLowerCase().includes(query) ||
        m.sku?.toLowerCase().includes(query) ||
        m.handledBy?.toLowerCase().includes(query)
      );
    }

    // Sort movements
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        case 'date-asc':
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case 'name-asc':
          return (a.itemName || '').localeCompare(b.itemName || '');
        case 'name-desc':
          return (b.itemName || '').localeCompare(a.itemName || '');
        case 'sku-asc':
          return (a.sku || '').localeCompare(b.sku || '');
        case 'sku-desc':
          return (b.sku || '').localeCompare(a.sku || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [movements, filterCategory, filterType, filterBrand, filterReason, searchQuery, sortBy]);

  // Paginate movements client-side (similar to transaction.jsx)
  const paginatedMovements = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredMovements.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredMovements, currentPage, rowsPerPage]);
  const paginatedMovementIds = useMemo(
    () => paginatedMovements.map((movement) => movement._id).filter(Boolean),
    [paginatedMovements]
  );
  const allVisibleMovementsSelected =
    paginatedMovementIds.length > 0 &&
    paginatedMovementIds.every((id) => selectedMovementIds.includes(id));
  const someVisibleMovementsSelected = paginatedMovementIds.some((id) =>
    selectedMovementIds.includes(id)
  );

  // Paginate void logs client-side (similar to transaction.jsx)
  const paginatedVoidLogs = useMemo(() => {
    const startIndex = (voidCurrentPage - 1) * rowsPerPage;
    return voidLogs.slice(startIndex, startIndex + rowsPerPage);
  }, [voidLogs, voidCurrentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredMovements.length / rowsPerPage) || 1;
  const voidTotalPages = Math.ceil(voidLogs.length / rowsPerPage) || 1;
  const movementTableColumnCount = isMovementExportMode ? 8 : 7;

  useEffect(() => {
    setSelectedMovementIds((prev) =>
      prev.filter((id) => filteredMovements.some((movement) => movement._id === id))
    );
  }, [filteredMovements]);

  useEffect(() => {
    if (selectAllMovementsRef.current) {
      selectAllMovementsRef.current.indeterminate =
        isMovementExportMode &&
        !allVisibleMovementsSelected &&
        someVisibleMovementsSelected;
    }
  }, [isMovementExportMode, allVisibleMovementsSelected, someVisibleMovementsSelected]);

  return (
    <div className={`p-8 min-h-screen ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-50'}`}>
      <Header pageName={activeTab === 'stock-movement' ? 'Inventory Logs' : 'Void Logs'} showBorder={false} />

      {/* Tab Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('stock-movement')}
          className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md ${activeTab === 'stock-movement'
            ? `text-[#AD7F65] border-b-4 border-[#AD7F65] ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`
            : `${theme === 'dark' ? 'bg-[#2A2724] text-gray-300 border border-gray-700' : 'bg-white text-gray-800 border border-gray-200'}`
            }`}
        >
          Inventory Logs
        </button>
        <button
          onClick={() => setActiveTab('void-logs')}
          className={`px-6 py-3 font-bold rounded-xl transition-all shadow-md ${activeTab === 'void-logs'
            ? `text-[#AD7F65] border-b-4 border-[#AD7F65] ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`
            : `${theme === 'dark' ? 'bg-[#2A2724] text-gray-300 border border-gray-700' : 'bg-white text-gray-800 border border-gray-200'}`
            }`}
        >
          Void Logs
        </button>
      </div>

      {/* Inventory Logs Content */}
      {activeTab === 'stock-movement' && (
        <>
          {/* Summary Cards */}
          <div className="mb-6">
            <div className="flex justify-between items-center gap-4 flex-wrap">
              {/* Left: Stat Cards */}
              <div className="flex gap-4 flex-wrap">
                <div className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`} style={{ minWidth: '200px' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-500"></div>
                  <div className="ml-2">
                    <div className="text-3xl font-bold text-green-500">{stats.stockIns}</div>
                    <div className="text-xs text-green-400 mt-0.5">Stock-ins Today</div>
                  </div>
                  <div className="w-20 h-20  rounded-full flex items-center justify-center">
                    <img src={StockInIcon} alt="Stock In" className="w-16 h-16" />
                  </div>
                </div>

                <div className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`} style={{ minWidth: '200px' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-500"></div>
                  <div className="ml-2">
                    <div className="text-3xl font-bold text-red-500">{stats.stockOuts}</div>
                    <div className="text-xs text-red-400 mt-0.5">Stock-outs Today</div>
                  </div>
                  <div className="w-20 h-20  rounded-full flex items-center justify-center">
                    <img src={StockOutIcon} alt="Stock Out" className="w-16 h-16" />
                  </div>
                </div>

                <div className={`rounded-2xl shadow-md flex items-center justify-between px-5 py-4 relative overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`} style={{ minWidth: '200px' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-orange-500"></div>
                  <div className="ml-2">
                    <div className="text-3xl font-bold text-orange-500">{stats.pullOuts}</div>
                    <div className="text-xs text-orange-400 mt-0.5">Pull-Outs Today</div>
                  </div>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center">
                    <img src={PullOutIcon} alt="Pull Out" className="w-16 h-16" />
                  </div>
                </div>
              </div>

              {/* Right: Export/Import Buttons */}
              <div className="flex gap-4 items-center">
                <button
                  onClick={handleMovementExportButtonClick}
                  className={`rounded-2xl shadow-md flex flex-col items-center justify-center px-5 py-4 transition-colors ${theme === 'dark' ? 'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]' : 'bg-white text-gray-700 hover:bg-gray-50'} ${isMovementExportMode ? 'border border-[#AD7F65] bg-[#AD7F65]/5' : ''}`}
                  style={{ minWidth: '100px' }}
                >
                  <svg className="w-8 h-8 text-gray-700 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>
                    {isMovementExportMode ? 'Export Selected' : 'Export'}
                  </div>
                </button>
                {isMovementExportMode && (
                  <button
                    onClick={handleCancelMovementSelection}
                    className={`rounded-2xl shadow-md px-4 py-2 text-xs font-medium border transition-colors ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-gray-300 hover:bg-[#3A3734]' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Cancel
                  </button>
                )}

                <label
                  className={`rounded-2xl shadow-md flex flex-col items-center justify-center px-5 py-4 transition-colors cursor-pointer ${theme === 'dark' ? 'bg-[#2A2724] hover:bg-[#3A3734] text-gray-300' : 'bg-white hover:bg-gray-50'}`}
                  style={{ minWidth: '100px' }}
                >
                  <svg className="w-8 h-8 text-gray-700 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Import</div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center shadow-md overflow-hidden rounded-[10px]" style={{ width: '400px' }}>
                <button
                  type="button"
                  className="px-4 py-3 flex items-center justify-center h-10"
                  style={{
                    background: 'linear-gradient(135deg, rgba(173, 127, 101, 1) 0%,  rgba(118, 70, 43, 1) 100%)'
                  }}
                >
                  <FaSearch className="text-white text-sm" />
                </button>

                <input
                  type="text"
                  placeholder="Search for product, SKU, Employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`flex-1 px-4 py-3 h-10 focus:outline-none placeholder-gray-400 border-0 ${theme === 'dark' ? 'bg-[#2A2724] text-white' : 'bg-white text-gray-700'}`}
                />
              </div>

              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className={`h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] text-sm ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                style={{ minWidth: '140px', maxWidth: '160px' }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>By Category {cat !== 'All' ? `(${cat})` : ''}</option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className={`h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] text-sm ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                style={{ minWidth: '130px', maxWidth: '150px' }}
              >
                {types.map(type => (
                  <option key={type} value={type}>By Type {type !== 'All' ? `(${type})` : ''}</option>
                ))}
              </select>

              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className={`h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] text-sm ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                style={{ minWidth: '130px', maxWidth: '150px' }}
              >
                {uniqueBrands.map(brand => (
                  <option key={brand} value={brand}>By Brand {brand !== 'All' ? `(${brand})` : ''}</option>
                ))}
              </select>

              <select
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={`h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] text-sm ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                style={{ minWidth: '130px', maxWidth: '150px' }}
              >
                {dateOptions.map(date => (
                  <option key={date} value={date}>By Date {date !== 'All' ? `(${date})` : ''}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] text-sm ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                style={{ minWidth: '160px', maxWidth: '180px' }}
              >
                {sortOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>Sort By {opt.label}</option>
                ))}
              </select>

              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className={`h-10 px-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] text-sm ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700 text-white' : 'bg-white border-gray-300'}`}
                style={{ minWidth: '140px', maxWidth: '160px' }}
              >
                {reasons.map(reason => (
                  <option key={reason} value={reason}>By Reason {reason !== 'All' ? `(${reason})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className={`rounded-2xl shadow-md overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className={`${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-50'}`}>
                  <tr>
                    {isMovementExportMode && (
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            ref={selectAllMovementsRef}
                            type="checkbox"
                            className="w-4 h-4 text-[#AD7F65] border-[#AD7F65] rounded focus:ring-[#AD7F65]"
                            onChange={handleToggleSelectAllMovements}
                            checked={isMovementExportMode ? allVisibleMovementsSelected : false}
                          />
                          <span>All</span>
                        </label>
                      </th>
                    )}
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer ${theme === 'dark' ? 'text-gray-400 hover:bg-[#3A3734]' : 'text-gray-500 hover:bg-gray-100'}`}>
                      <div className="flex items-center gap-1">
                        Date & Time
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                        </svg>
                      </div>
                    </th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Type</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Quantity</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Before</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>After</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Reason</th>
                    <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Handled by</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'dark' ? 'bg-[#2A2724] divide-gray-700' : 'bg-white divide-gray-200'}`}>
                  {loading && movements.length === 0 ? (
                    <tr>
                      <td colSpan={movementTableColumnCount} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B7355] mb-2"></div>
                          <span>Loading...</span>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedMovements.length === 0 ? (
                    <tr>
                      <td colSpan={movementTableColumnCount} className="px-4 py-8 text-center text-gray-500">
                        No stock movements found
                      </td>
                    </tr>
                  ) : (
                    paginatedMovements.map((movement) => (
                      <tr key={movement._id} className={`${theme === 'dark' ? 'hover:bg-[#3A3734] hover:bg-opacity-50' : 'hover:bg-gray-50'}`}>
                        {isMovementExportMode && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-[#AD7F65] border-[#AD7F65] rounded focus:ring-[#AD7F65]"
                              checked={selectedMovementIds.includes(movement._id)}
                              onChange={() => handleToggleMovementSelection(movement._id)}
                              disabled={!movement._id}
                            />
                          </td>
                        )}
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{formatDateTime(movement.createdAt)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{getTypeBadge(movement.type)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${getQuantityColor(movement.type, movement.quantity)}`}>
                          {movement.type === 'Stock-In' ? '+' : '-'}{movement.quantity}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{movement.stockBefore}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{movement.stockAfter}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{movement.reason}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>{movement.handledBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - Same style as transaction.jsx */}
          {filteredMovements.length > 0 && (
            <div className="flex items-center justify-between mt-5">
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Showing {(currentPage - 1) * rowsPerPage + 1}-
                {Math.min(currentPage * rowsPerPage, filteredMovements.length)} of {filteredMovements.length}
              </div>
              {totalPages > 1 && (
                <div className={`flex items-center gap-2 rounded-full border px-3 py-1 shadow-inner ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700' : 'bg-white border-gray-200'}`}>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-full ${currentPage === 1 ? 'text-gray-300' : `${theme === 'dark' ? 'hover:bg-[#3A3734] text-gray-400' : 'hover:bg-gray-50 text-gray-600'}`}`}
                  >
                    <FaChevronLeft />
                  </button>
                  {Array.from({ length: totalPages }).slice(0, 5).map((_, idx) => {
                    const pageNumber = idx + 1;
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`w-8 h-8 rounded-full text-sm font-semibold ${currentPage === pageNumber
                          ? 'bg-[#AD7F65] text-white shadow-md'
                          : `${theme === 'dark' ? 'text-gray-400 hover:bg-[#3A3734]' : 'text-gray-600 hover:bg-gray-50'}`
                          }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  {totalPages > 5 && <span className="text-gray-400 px-2">...</span>}
                  {totalPages > 5 && (
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className={`w-8 h-8 rounded-full text-sm font-semibold ${currentPage === totalPages
                        ? 'bg-[#AD7F65] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {totalPages}
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-full ${currentPage === totalPages ? 'text-gray-300' : `${theme === 'dark' ? 'hover:bg-[#3A3734] text-gray-400' : 'hover:bg-gray-50 text-gray-600'}`
                      }`}
                  >
                    <FaChevronRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Void Logs Content */}
      {activeTab === 'void-logs' && (
        <div className={`rounded-2xl shadow-md overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-50'}`}>
                <tr>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Void Number</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Void ID</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Date & Time</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Handled By</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Approved By</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Total</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'bg-[#2A2724] divide-gray-700' : 'bg-white divide-gray-200'}`}>
                {loading && voidLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B7355] mb-2"></div>
                        <span>Loading...</span>
                      </div>
                    </td>
                  </tr>
                ) : voidLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No void logs found
                    </td>
                  </tr>
                ) : (
                  paginatedVoidLogs.map((log, index) => {
                    const voidNumber = voidLogs.length - (voidCurrentPage - 1) * rowsPerPage - index; // Most recent void gets highest number
                    // Determine approved by display - show name and role
                    const getApprovedByDisplay = () => {
                      if (log.approvedBy && log.approvedByRole) {
                        return `${log.approvedBy} (${log.approvedByRole})`;
                      }
                      if (log.approvedBy) {
                        return log.approvedBy;
                      }
                      if (log.approvedByRole) {
                        return log.approvedByRole;
                      }
                      // Fallback: if no approvedBy info, show N/A
                      return 'N/A';
                    };

                    return (
                      <tr
                        key={log._id}
                        className={`cursor-pointer ${theme === 'dark' ? 'hover:bg-[#3A3734] hover:bg-opacity-50' : 'hover:bg-gray-50'}`}
                        onClick={() => handleView(log)}
                      >
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                          #{voidNumber}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                          {log.voidId || 'N/A'}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                          {formatDateTime(log.voidedAt || log.checkedOutAt || log.createdAt)}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                          {log.voidedByName || log.performedByName || 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${log.approvedByRole === 'Owner'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : log.approvedByRole === 'Manager'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                            {getApprovedByDisplay()}
                          </span>
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>
                          ₱{parseFloat(log.totalAmount || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination for Void Logs - Same style as transaction.jsx */}
          {voidLogs.length > 0 && (
            <div className="flex items-center justify-between mt-5">
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Showing {(voidCurrentPage - 1) * rowsPerPage + 1}-
                {Math.min(voidCurrentPage * rowsPerPage, voidLogs.length)} of {voidLogs.length}
              </div>
              {voidTotalPages > 1 && (
                <div className={`flex items-center gap-2 rounded-full border px-3 py-1 shadow-inner ${theme === 'dark' ? 'bg-[#2A2724] border-gray-700' : 'bg-white border-gray-200'}`}>
                  <button
                    onClick={() => setVoidCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={voidCurrentPage === 1}
                    className={`p-2 rounded-full ${voidCurrentPage === 1 ? 'text-gray-300' : `${theme === 'dark' ? 'hover:bg-[#3A3734] text-gray-400' : 'hover:bg-gray-50 text-gray-600'}`}`}
                  >
                    <FaChevronLeft />
                  </button>
                  {Array.from({ length: voidTotalPages }).slice(0, 5).map((_, idx) => {
                    const pageNumber = idx + 1;
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setVoidCurrentPage(pageNumber)}
                        className={`w-8 h-8 rounded-full text-sm font-semibold ${voidCurrentPage === pageNumber
                          ? 'bg-[#AD7F65] text-white shadow-md'
                          : `${theme === 'dark' ? 'text-gray-400 hover:bg-[#3A3734]' : 'text-gray-600 hover:bg-gray-50'}`
                          }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  {voidTotalPages > 5 && <span className="text-gray-400 px-2">...</span>}
                  {voidTotalPages > 5 && (
                    <button
                      onClick={() => setVoidCurrentPage(voidTotalPages)}
                      className={`w-8 h-8 rounded-full text-sm font-semibold ${voidCurrentPage === voidTotalPages
                        ? 'bg-[#AD7F65] text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {voidTotalPages}
                    </button>
                  )}
                  <button
                    onClick={() => setVoidCurrentPage((prev) => Math.min(voidTotalPages, prev + 1))}
                    disabled={voidCurrentPage === voidTotalPages}
                    className={`p-2 rounded-full ${voidCurrentPage === voidTotalPages ? 'text-gray-300' : `${theme === 'dark' ? 'hover:bg-[#3A3734] text-gray-400' : 'hover:bg-gray-50 text-gray-600'}`
                      }`}
                  >
                    <FaChevronRight />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* View Void Log Modal */}
      <ViewVoidLogModal
        isOpen={showVoidLogModal}
        onClose={() => {
          setShowVoidLogModal(false);
          setSelectedVoidLog(null);
        }}
        voidLog={selectedVoidLog}
      />
    </div>
  );
};

export default memo(Logs);

