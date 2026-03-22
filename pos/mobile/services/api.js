import config from '../config/api';
import NetworkService from './NetworkService';
import OfflineService from './OfflineService';

// Initialize Network Service
NetworkService.init();

// Sync queue when coming back online
NetworkService.subscribe(async (isConnected) => {
  if (isConnected) {
    console.log('Network restored. Syncing offline queue...');
    await syncOfflineQueue();
  }
});

// Helper function to create a timeout promise
const timeoutPromise = (ms) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
};

// Process offline queue
const syncOfflineQueue = async () => {
  const queue = await OfflineService.getQueue();
  if (queue.length === 0) return;

  console.log(`Syncing ${queue.length} offline actions...`);

  for (const action of queue) {
    try {
      console.log('Replaying action:', action);
      // We need to reconstruct the API call
      // This is a simplified replay. In a real app, we might need more complex logic
      // to handle dependent actions (e.g. create item, then update it).

      const { endpoint, options, id } = action;

      // Call the actual API (force online mode for this call to avoid loop)
      await apiCall(endpoint, options, true);

      // Remove from queue if successful
      await OfflineService.removeFromQueue(id);
    } catch (error) {
      console.error('Failed to sync action:', action, error);
      // Keep in queue to retry later? Or move to a "failed" queue?
      // For now, we leave it. It will retry next time we sync.
    }
  }
};

// Helper function to make API calls with timeout
const apiCall = async (endpoint, options = {}, forceOnline = false) => {
  const isConnected = NetworkService.getIsConnected();
  const method = options.method || 'GET';

  // OFFLINE MODE
  if (!isConnected && !forceOnline) {
    console.log(`[OFFLINE] ${method} ${endpoint}`);

    if (method === 'GET') {
      // Try to get from cache
      const cachedData = await OfflineService.getCache(endpoint);
      if (cachedData) {
        console.log('Serving from cache');
        return cachedData;
      } else {
        throw new Error('No internet connection and no cached data available.');
      }
    } else {
      // Queue write operations
      const success = await OfflineService.queueAction({ endpoint, options });
      if (success) {
        console.log('Action queued for sync');
        // Return a mock success response
        return { success: true, message: 'Action queued (Offline Mode)', data: {} };
      } else {
        throw new Error('Failed to queue offline action.');
      }
    }
  }

  // ONLINE MODE
  const url = `${config.API_URL}${endpoint}`;
  const timeout = config.TIMEOUT || 30000;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    // Race between fetch and timeout
    const response = await Promise.race([
      fetch(url, finalOptions),
      timeoutPromise(timeout)
    ]);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    // Cache successful GET requests
    if (method === 'GET') {
      OfflineService.saveCache(endpoint, data);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);

    // Fallback to cache if request fails (and it's a GET request)
    if (method === 'GET') {
      console.log('Request failed, attempting to serve from cache...');
      const cachedData = await OfflineService.getCache(endpoint);
      if (cachedData) {
        console.log('Serving from cache (fallback)');
        return cachedData;
      }
    }

    throw error;
  }
};

// ==================== PRODUCTS ====================
export const productAPI = {
  // Get all products (uses minimal fields to exclude heavy base64 images)
  getAll: async (params = {}) => {
    const queryParams = { fields: 'minimal', ...params };
    const queryString = new URLSearchParams(queryParams).toString();
    const endpoint = `/products${queryString ? `?${queryString}` : ''}`;
    return apiCall(endpoint);
  },

  // Get product by ID
  getById: async (id) => {
    return apiCall(`/products/${id}`);
  },

  // Search products
  search: async (query) => {
    return apiCall(`/products/search/${encodeURIComponent(query)}`);
  },

  // Get products by category
  getByCategory: async (category) => {
    return apiCall(`/products/category/${encodeURIComponent(category)}`);
  },

  // Create product
  create: async (productData) => {
    return apiCall('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  // Update product
  update: async (id, productData) => {
    return apiCall(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  // Delete product
  delete: async (id) => {
    return apiCall(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  // Update stock after transaction
  updateStock: async (items, performedByName, performedById) => {
    return apiCall('/products/update-stock', {
      method: 'POST',
      body: JSON.stringify({
        items,
        performedByName,
        performedById,
      }),
    });
  },

  // Get inventory stats (value, margins, counts)
  getInventoryStats: async () => {
    return apiCall('/products/inventory-stats');
  },
};

// ==================== TRANSACTIONS ====================
export const transactionAPI = {
  // Get all transactions
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`;
    return apiCall(endpoint);
  },

  // Get transaction by ID
  getById: async (id) => {
    return apiCall(`/transactions/${id}`);
  },

  // Create transaction
  create: async (transactionData) => {
    return apiCall('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  },

  // Update transaction
  update: async (id, transactionData) => {
    return apiCall(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(transactionData),
    });
  },

  // Get dashboard stats
  getDashboardStats: async (timeframe = 'daily') => {
    return apiCall(`/transactions/dashboard/stats?timeframe=${encodeURIComponent(timeframe)}`);
  },

  // Get sales over time (for charts)
  getSalesOverTime: async (timeframe = 'daily') => {
    const tf = timeframe.toLowerCase();
    return apiCall(`/transactions/sales-over-time?timeframe=${encodeURIComponent(tf)}`);
  },

  // Get sales by category
  getSalesByCategory: async () => {
    return apiCall('/transactions/sales-by-category');
  },

  // Get top selling products
  getTopSelling: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiCall(`/transactions/top-selling${queryString ? `?${queryString}` : ''}`);
  },
};

// ==================== EMPLOYEES ====================
export const employeeAPI = {
  // Get all employees
  getAll: async () => {
    return apiCall('/employees');
  },

  /** Same source as web dashboard: staff with isOnline + recent heartbeat; Owner excluded server-side */
  getOnline: async () => {
    return apiCall('/employees/online');
  },

  // Get employee by ID
  getById: async (id) => {
    return apiCall(`/employees/${id}`);
  },

  // Search employees by first name
  search: async (query) => {
    return apiCall(`/employees/search/${encodeURIComponent(query)}`);
  },

  // Create employee
  create: async (employeeData) => {
    return apiCall('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  },

  // Update employee
  update: async (id, employeeData) => {
    return apiCall(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  },

  // Delete employee
  delete: async (id) => {
    return apiCall(`/employees/${id}`, {
      method: 'DELETE',
    });
  },

  // Verify PIN
  verifyPin: async (pin, employeeId) => {
    return apiCall('/employees/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin, employeeId }),
    });
  },

  /**
   * Verify Owner PIN (for mobile app - only accepts owner accounts)
   * This function enforces owner-only access to the mobile application.
   * 
   * @param {string} pin - The 6-digit PIN to verify
   * @returns {Promise<{success: boolean, message: string, data: object|null}>}
   */
  verifyOwnerPin: async (pin) => {
    // Validate PIN format
    if (!pin || typeof pin !== 'string' || pin.length !== 6) {
      return {
        success: false,
        message: 'Invalid PIN format. PIN must be 6 digits.',
        data: null
      };
    }

    try {
      const response = await apiCall('/employees/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin }),
      });

      // Check if the verified employee is an Owner
      if (response.success && response.data) {
        // Only allow Owner role to access mobile app
        if (response.data.role !== 'Owner') {
          return {
            success: false,
            message: 'Only owner account can access the mobile app.',
            data: null
          };
        }

        // Owner verified successfully
        return {
          success: true,
          message: 'Owner PIN verified successfully',
          data: response.data,
          requiresPinReset: response.requiresPinReset || false
        };
      }

      return response;
    } catch (error) {
      // Handle network or API errors
      return {
        success: false,
        message: error.message || 'Failed to verify PIN. Please check your connection.',
        data: null
      };
    }
  },

  // Update PIN
  updatePin: async (id, pinData) => {
    return apiCall(`/employees/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify(pinData),
    });
  },
};

// ==================== CART ====================
export const cartAPI = {
  // Get cart by user ID
  getByUserId: async (userId) => {
    return apiCall(`/cart/${encodeURIComponent(userId)}`);
  },

  // Save cart
  save: async (userId, items) => {
    return apiCall(`/cart/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },
};

// ==================== STOCK MOVEMENTS ====================
export const stockMovementAPI = {
  // Get all stock movements
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/stock-movements${queryString ? `?${queryString}` : ''}`;
    return apiCall(endpoint);
  },

  // Create stock movement
  create: async (movementData) => {
    return apiCall('/stock-movements', {
      method: 'POST',
      body: JSON.stringify(movementData),
    });
  },

  // Get stock stats over time
  getStockStatsOverTime: async (timeframe = 'daily') => {
    return apiCall(`/stock-movements/stats/over-time?timeframe=${encodeURIComponent(timeframe)}`);
  },
};

// ==================== ARCHIVE ====================
export const archiveAPI = {
  // Get all archived items
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/archive${queryString ? `?${queryString}` : ''}`;
    return apiCall(endpoint);
  },

  // Archive item
  archive: async (itemData) => {
    return apiCall('/archive', {
      method: 'POST',
      body: JSON.stringify(itemData),
    });
  },

  // Restore archived item
  restore: async (id) => {
    return apiCall(`/archive/${id}/restore`, {
      method: 'PUT',
    });
  },
};

// ==================== VOID LOGS ====================
export const voidLogAPI = {
  // Get all void logs
  getAll: async (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/void-logs${queryString ? `?${queryString}` : ''}`;
    return apiCall(endpoint);
  },

  // Create void log
  create: async (voidLogData) => {
    return apiCall('/void-logs', {
      method: 'POST',
      body: JSON.stringify(voidLogData),
    });
  },
};

// ==================== DISCOUNTS ====================
export const discountAPI = {
  // Get all discounts
  getAll: async () => {
    return apiCall('/discounts');
  },

  // Get discount by ID
  getById: async (id) => {
    return apiCall(`/discounts/${id}`);
  },

  // Create discount
  create: async (discountData) => {
    return apiCall('/discounts', {
      method: 'POST',
      body: JSON.stringify(discountData),
    });
  },

  // Update discount
  update: async (id, discountData) => {
    return apiCall(`/discounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(discountData),
    });
  },

  // Delete discount
  delete: async (id) => {
    return apiCall(`/discounts/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== CATEGORIES ====================
export const categoryAPI = {
  // Get all categories
  getAll: async () => {
    return apiCall('/categories');
  },

  // Get category by ID
  getById: async (id) => {
    return apiCall(`/categories/${id}`);
  },

  // Create category
  create: async (categoryData) => {
    return apiCall('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  },

  // Update category
  update: async (id, categoryData) => {
    return apiCall(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  },

  // Delete category
  delete: async (id) => {
    return apiCall(`/categories/${id}`, {
      method: 'DELETE',
    });
  },
};

// ==================== SYNC ====================
export const syncAPI = {
  // Sync all data
  syncAll: async () => {
    return apiCall('/sync/all', {
      method: 'POST',
    });
  },
};

// ==================== BRAND PARTNERS ====================
export const brandPartnerAPI = {
  // Get all brand partners
  getAll: async () => {
    return apiCall('/brand-partners');
  },

  // Get brand partner by ID
  getById: async (id) => {
    return apiCall(`/brand-partners/${id}`);
  },

  // Create brand partner
  create: async (brandData) => {
    return apiCall('/brand-partners', {
      method: 'POST',
      body: JSON.stringify(brandData),
    });
  },
};

// ==================== STOCK ALERTS ====================
export const stockAPI = {
  // Get low stock and out of stock items
  getLowStock: async () => {
    return apiCall('/products/low-stock');
  },
};

