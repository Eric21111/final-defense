










export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';


export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws');





export const resolveApiUrl = (url) => {
  if (typeof url !== 'string') return url;


  if (url.includes('http://localhost:5000')) {
    return url.replace('http://localhost:5000', API_BASE_URL);
  }


  if (url.includes('ws://localhost:5000')) {
    return url.replace('ws://localhost:5000', WS_BASE_URL);
  }

  return url;
};


export const apiUrl = (path) => {

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};


export const API_ENDPOINTS = {

  products: `${API_BASE_URL}/api/products`,
  productById: (id) => `${API_BASE_URL}/api/products/${id}`,
  productsLowStock: `${API_BASE_URL}/api/products/low-stock`,
  productsUpdateStock: `${API_BASE_URL}/api/products/update-stock`,


  categories: `${API_BASE_URL}/api/categories`,
  categoryById: (id) => `${API_BASE_URL}/api/categories/${id}`,
  categoryArchive: (id) => `${API_BASE_URL}/api/categories/${id}/archive`,


  brandPartners: `${API_BASE_URL}/api/brand-partners`,
  brandPartnerById: (id) => `${API_BASE_URL}/api/brand-partners/${id}`,


  employees: `${API_BASE_URL}/api/employees`,
  employeeById: (id) => `${API_BASE_URL}/api/employees/${id}`,
  employeePin: (id) => `${API_BASE_URL}/api/employees/${id}/pin`,
  employeeSendTempPin: (id) => `${API_BASE_URL}/api/employees/${id}/send-temporary-pin`,
  employeeVerifyPin: `${API_BASE_URL}/api/employees/verify-pin`,
  employeeLogout: `${API_BASE_URL}/api/employees/logout`,
  employeesOnline: `${API_BASE_URL}/api/employees/online`,
  employeeSearch: (firstName) => `${API_BASE_URL}/api/employees/search/${encodeURIComponent(firstName)}`,


  transactions: `${API_BASE_URL}/api/transactions`,
  transactionById: (id) => `${API_BASE_URL}/api/transactions/${id}`,
  transactionsDashboardStats: `${API_BASE_URL}/api/transactions/dashboard/stats`,
  transactionsSalesOverTime: `${API_BASE_URL}/api/transactions/sales-over-time`,
  transactionsSalesByCategory: `${API_BASE_URL}/api/transactions/sales-by-category`,
  transactionsTopSelling: `${API_BASE_URL}/api/transactions/top-selling`,


  cart: `${API_BASE_URL}/api/cart`,
  cartById: (id) => `${API_BASE_URL}/api/cart/${encodeURIComponent(id)}`,


  discounts: `${API_BASE_URL}/api/discounts`,
  discountById: (id) => `${API_BASE_URL}/api/discounts/${id}`,


  archive: `${API_BASE_URL}/api/archive`,
  archiveAll: `${API_BASE_URL}/api/archive/all`,


  stockMovements: `${API_BASE_URL}/api/stock-movements`,
  stockMovementsBulk: `${API_BASE_URL}/api/stock-movements/bulk`,
  stockMovementsStatsToday: `${API_BASE_URL}/api/stock-movements/stats/today`,


  voidLogs: `${API_BASE_URL}/api/void-logs`,


  verificationSendCode: `${API_BASE_URL}/api/verification/send-code`,
  verificationVerifyCode: `${API_BASE_URL}/api/verification/verify-code`,


  reportsInventoryAnalytics: `${API_BASE_URL}/api/reports/inventory-analytics`,


  syncAll: `${API_BASE_URL}/api/sync/all`,


  gcashSettings: `${API_BASE_URL}/api/gcash`,
  merchantSettings: `${API_BASE_URL}/api/merchant-settings`,


  dataManagement: `${API_BASE_URL}/api/data-management`,

  remittances: `${API_BASE_URL}/api/remittances`,
  remittanceSummary: `${API_BASE_URL}/api/remittances/summary`
};






export const initializeApiInterceptor = () => {

  const originalFetch = window.fetch;


  window.fetch = function (input, init) {
    let url = input;


    if (input instanceof Request) {
      const resolvedUrl = resolveApiUrl(input.url);
      if (resolvedUrl !== input.url) {

        url = new Request(resolvedUrl, input);
      }
    } else if (typeof input === 'string') {
      url = resolveApiUrl(input);
    }

    return originalFetch.call(this, url, init);
  };


  const OriginalWebSocket = window.WebSocket;


  window.WebSocket = function (url, protocols) {
    const resolvedUrl = resolveApiUrl(url);
    return new OriginalWebSocket(resolvedUrl, protocols);
  };


  Object.keys(OriginalWebSocket).forEach((key) => {
    window.WebSocket[key] = OriginalWebSocket[key];
  });


  window.WebSocket.prototype = OriginalWebSocket.prototype;

  console.log('[API] Interceptor initialized. API_BASE_URL:', API_BASE_URL);
};

export default API_BASE_URL;