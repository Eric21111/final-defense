import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { brandPartnerAPI, categoryAPI, productAPI, transactionAPI } from '../services/api';

const DataContext = createContext(null);

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export function DataProvider({ children }) {
  // Products state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const productsLastFetch = useRef(null);

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const transactionsLastFetch = useRef(null);

  // Brands state
  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const brandsLastFetch = useRef(null);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const categoriesLastFetch = useRef(null);

  const [dashboardStats, setDashboardStats] = useState({
    totalSalesToday: 0,
    totalTransactions: 0,
    averageTransactionValue: 0,
    lowStockItems: 0,
  });
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    inventoryValue: 0,
    totalCostValue: 0,
    grossMargin: 0,
  });
  const dashboardLastFetch = useRef(null);

  // Check if cache is valid
  const isCacheValid = (lastFetch) => {
    if (!lastFetch) return false;
    return Date.now() - lastFetch < CACHE_DURATION;
  };

  // Fetch products with caching and pagination
  // params: { page: 1, limit: 20, query: '' }
  const fetchProducts = useCallback(async (forceRefresh = false, params = {}) => {
    // If no params and valid cache, return existing (but this might be partial data now)
    // We should be careful. Usually List views will manage their own pagination state
    // and call this to append data.

    // For specific page fetches, we usually bypass the "all" cache check
    const isPagination = params.page && params.page > 1;

    try {
      setProductsLoading(true);
      const response = await productAPI.getAll(params);

      if (response.success && response.data) {
        if (isPagination) {
          setProducts(prev => {
            // Avoid duplicates based on _id
            const newItems = response.data.filter(newItem =>
              !prev.some(existing => existing._id === newItem._id)
            );
            return [...prev, ...newItems];
          });
        } else {
          // Reset data if page 1 or refresh
          setProducts(response.data);
          productsLastFetch.current = Date.now();
        }
        return response; // Return full response for pagination metadata (totalPages etc)
      }
      return { data: products }; // Fallback
    } catch (error) {
      console.error('Error fetching products:', error);
      return { data: products };
    } finally {
      setProductsLoading(false);
    }
  }, [products]);

  // Fetch transactions with caching and pagination
  const fetchTransactions = useCallback(async (forceRefresh = false, params = {}) => {
    const isPagination = params.page && params.page > 1;

    if (!forceRefresh && !isPagination && isCacheValid(transactionsLastFetch.current) && transactions.length > 0) {
      return { data: transactions };
    }

    try {
      setTransactionsLoading(true);
      // Remove hardcoded limit, default to backend (20) or provided params
      const response = await transactionAPI.getAll(params);

      if (response.success && response.data) {
        if (isPagination) {
          setTransactions(prev => {
            // Avoid duplicates
            const newItems = response.data.filter(newItem =>
              !prev.some(existing => existing._id === newItem._id)
            );
            return [...prev, ...newItems];
          });
        } else {
          setTransactions(response.data);
          transactionsLastFetch.current = Date.now();
        }
        return response;
      }
      return { data: transactions };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return { data: transactions };
    } finally {
      setTransactionsLoading(false);
    }
  }, [transactions]);

  // Fetch brands with caching
  const fetchBrands = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid(brandsLastFetch.current) && brands.length > 0) {
      return brands;
    }

    try {
      setBrandsLoading(true);
      const response = await brandPartnerAPI.getAll();
      if (response.success && response.data) {
        setBrands(response.data);
        brandsLastFetch.current = Date.now();
        return response.data;
      }
      return brands;
    } catch (error) {
      console.error('Error fetching brands:', error);
      return brands;
    } finally {
      setBrandsLoading(false);
    }
  }, [brands]);

  // Fetch categories with caching
  const fetchCategories = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid(categoriesLastFetch.current) && categories.length > 0) {
      return categories;
    }

    try {
      setCategoriesLoading(true);
      const response = await categoryAPI.getAll();
      if (response.success && response.data) {
        setCategories(response.data);
        categoriesLastFetch.current = Date.now();
        return response.data;
      }
      return categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return categories;
    } finally {
      setCategoriesLoading(false);
    }
  }, [categories]);

  // Calculate dashboard stats (Fetch from API for performance)
  const calculateDashboardStats = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid(dashboardLastFetch.current)) {
      return dashboardStats;
    }

    try {
      // Fetch stats from backend APIs instead of downloading all data
      const [txnStatsResponse, inventoryStatsResponse] = await Promise.all([
        transactionAPI.getDashboardStats(), // You might need to ensure this endpoint exists and returns correct structure
        productAPI.getInventoryStats()
      ]);

      let newStats = {
        totalSalesToday: 0,
        totalTransactions: 0,
        averageTransactionValue: 0,
        lowStockItems: 0,
      };

      if (txnStatsResponse.success && txnStatsResponse.data) {
        newStats.totalSalesToday = txnStatsResponse.data.totalSales || 0;
        newStats.totalTransactions = txnStatsResponse.data.transactionCount || 0;
        newStats.averageTransactionValue = txnStatsResponse.data.averageValue || 0;
      }

      if (inventoryStatsResponse.success && inventoryStatsResponse.data) {
        newStats.lowStockItems = inventoryStatsResponse.data.lowStock || 0;
        setInventoryStats(inventoryStatsResponse.data); // Save full stats for Inventory screen
      }

      setDashboardStats(newStats);
      dashboardLastFetch.current = Date.now();
      return newStats;
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
      return dashboardStats;
    }
  }, [dashboardStats]);

  // Invalidate specific cache
  const invalidateCache = useCallback((type) => {
    switch (type) {
      case 'products':
        productsLastFetch.current = null;
        break;
      case 'transactions':
        transactionsLastFetch.current = null;
        break;
      case 'brands':
        brandsLastFetch.current = null;
        break;
      case 'categories':
        categoriesLastFetch.current = null;
        break;
      case 'dashboard':
        dashboardLastFetch.current = null;
        break;
      case 'all':
        productsLastFetch.current = null;
        transactionsLastFetch.current = null;
        brandsLastFetch.current = null;
        categoriesLastFetch.current = null;
        dashboardLastFetch.current = null;
        break;
    }
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    invalidateCache('all');
    await Promise.all([
      fetchProducts(true),
      fetchTransactions(true),
      fetchBrands(true),
      fetchCategories(true),
    ]);
  }, [invalidateCache, fetchProducts, fetchTransactions, fetchBrands, fetchCategories]);

  // Memoized context value
  const value = useMemo(() => ({
    // Products
    products,
    productsLoading,
    fetchProducts,
    setProducts,

    // Transactions
    transactions,
    transactionsLoading,
    fetchTransactions,
    setTransactions,

    // Brands
    brands,
    brandsLoading,
    fetchBrands,

    // Categories
    categories,
    categoriesLoading,
    fetchCategories,

    // Dashboard
    dashboardStats,
    inventoryStats,
    calculateDashboardStats,

    // Cache management
    invalidateCache,
    refreshAll,
  }), [
    products, productsLoading, fetchProducts,
    transactions, transactionsLoading, fetchTransactions,
    brands, brandsLoading, fetchBrands,
    categories, categoriesLoading, fetchCategories,
    dashboardStats, inventoryStats, calculateDashboardStats,
    invalidateCache, refreshAll
  ]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export default DataContext;
