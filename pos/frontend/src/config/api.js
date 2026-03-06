/**
 * API Configuration for POS Frontend
 * 
 * Uses environment variables to determine the API base URL.
 * Set VITE_API_URL in your .env file for different environments:
 * 
 * Development: VITE_API_URL=http://localhost:5000
 * Production:  VITE_API_URL=https://your-backend.onrender.com
 */

// API Base URL - defaults to localhost for development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// WebSocket Base URL - derived from API_BASE_URL
export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');

/**
 * Helper function to convert localhost URLs to the configured API_BASE_URL
 * This allows gradual migration of hardcoded URLs
 */
export const resolveApiUrl = (url) => {
  if (typeof url !== 'string') return url;
  
  // Replace localhost:5000 with the configured API_BASE_URL
  if (url.includes('http://localhost:5000')) {
    return url.replace('http://localhost:5000', API_BASE_URL);
  }
  
  // Replace ws://localhost:5000 with WS_BASE_URL
  if (url.includes('ws://localhost:5000')) {
    return url.replace('ws://localhost:5000', WS_BASE_URL);
  }
  
  return url;
};

// Helper function to build API endpoints
export const apiUrl = (path) => {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

// Common API endpoints
export const API_ENDPOINTS = {
  // Products
  products: `${API_BASE_URL}/api/products`,
  productById: (id) => `${API_BASE_URL}/api/products/${id}`,
  productsLowStock: `${API_BASE_URL}/api/products/low-stock`,
  productsUpdateStock: `${API_BASE_URL}/api/products/update-stock`,
  
  // Categories
  categories: `${API_BASE_URL}/api/categories`,
  categoryById: (id) => `${API_BASE_URL}/api/categories/${id}`,
  categoryArchive: (id) => `${API_BASE_URL}/api/categories/${id}/archive`,
  
  // Brand Partners
  brandPartners: `${API_BASE_URL}/api/brand-partners`,
  brandPartnerById: (id) => `${API_BASE_URL}/api/brand-partners/${id}`,
  
  // Employees
  employees: `${API_BASE_URL}/api/employees`,
  employeeById: (id) => `${API_BASE_URL}/api/employees/${id}`,
  employeePin: (id) => `${API_BASE_URL}/api/employees/${id}/pin`,
  employeeSendTempPin: (id) => `${API_BASE_URL}/api/employees/${id}/send-temporary-pin`,
  employeeVerifyPin: `${API_BASE_URL}/api/employees/verify-pin`,
  employeeSearch: (firstName) => `${API_BASE_URL}/api/employees/search/${encodeURIComponent(firstName)}`,
  
  // Transactions
  transactions: `${API_BASE_URL}/api/transactions`,
  transactionById: (id) => `${API_BASE_URL}/api/transactions/${id}`,
  transactionsDashboardStats: `${API_BASE_URL}/api/transactions/dashboard/stats`,
  transactionsSalesOverTime: `${API_BASE_URL}/api/transactions/sales-over-time`,
  transactionsSalesByCategory: `${API_BASE_URL}/api/transactions/sales-by-category`,
  transactionsTopSelling: `${API_BASE_URL}/api/transactions/top-selling`,
  
  // Cart
  cart: `${API_BASE_URL}/api/cart`,
  cartById: (id) => `${API_BASE_URL}/api/cart/${encodeURIComponent(id)}`,
  
  // Discounts
  discounts: `${API_BASE_URL}/api/discounts`,
  discountById: (id) => `${API_BASE_URL}/api/discounts/${id}`,
  
  // Archive
  archive: `${API_BASE_URL}/api/archive`,
  archiveAll: `${API_BASE_URL}/api/archive/all`,
  
  // Stock Movements
  stockMovements: `${API_BASE_URL}/api/stock-movements`,
  stockMovementsBulk: `${API_BASE_URL}/api/stock-movements/bulk`,
  stockMovementsStatsToday: `${API_BASE_URL}/api/stock-movements/stats/today`,
  
  // Void Logs
  voidLogs: `${API_BASE_URL}/api/void-logs`,
  
  // Verification
  verificationSendCode: `${API_BASE_URL}/api/verification/send-code`,
  verificationVerifyCode: `${API_BASE_URL}/api/verification/verify-code`,
  
  // Reports
  reportsInventoryAnalytics: `${API_BASE_URL}/api/reports/inventory-analytics`,
  
  // Sync
  syncAll: `${API_BASE_URL}/api/sync/all`,
  
  // GCash/Payment
  gcashSettings: `${API_BASE_URL}/api/gcash`,
  merchantSettings: `${API_BASE_URL}/api/merchant-settings`,
  
  // Data Management
  dataManagement: `${API_BASE_URL}/api/data-management`,
};

/**
 * Initialize API URL interception
 * This patches the global fetch and WebSocket to automatically
 * rewrite localhost:5000 URLs to the configured API_BASE_URL
 */
export const initializeApiInterceptor = () => {
  // Store original fetch
  const originalFetch = window.fetch;
  
  // Override fetch to intercept URLs
  window.fetch = function(input, init) {
    let url = input;
    
    // Handle Request objects
    if (input instanceof Request) {
      const resolvedUrl = resolveApiUrl(input.url);
      if (resolvedUrl !== input.url) {
        // Create new request with resolved URL
        url = new Request(resolvedUrl, input);
      }
    } else if (typeof input === 'string') {
      url = resolveApiUrl(input);
    }
    
    return originalFetch.call(this, url, init);
  };
  
  // Store original WebSocket
  const OriginalWebSocket = window.WebSocket;
  
  // Override WebSocket to intercept URLs
  window.WebSocket = function(url, protocols) {
    const resolvedUrl = resolveApiUrl(url);
    return new OriginalWebSocket(resolvedUrl, protocols);
  };
  
  // Copy static properties
  Object.keys(OriginalWebSocket).forEach(key => {
    window.WebSocket[key] = OriginalWebSocket[key];
  });
  
  // Copy prototype
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  
  console.log('[API] Interceptor initialized. API_BASE_URL:', API_BASE_URL);
};

export default API_BASE_URL;
