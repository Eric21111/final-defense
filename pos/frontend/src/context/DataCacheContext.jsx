import { createContext, useContext, useState, useCallback } from 'react';

const DataCacheContext = createContext();

export const DataCacheProvider = ({ children }) => {
  const [cache, setCache] = useState({
    products: null,
    transactions: null,
    stockMovements: null,
    employees: null,
    stats: null
  });

  const [cacheTimestamps, setCacheTimestamps] = useState({
    products: null,
    transactions: null,
    stockMovements: null,
    employees: null,
    stats: null
  });

  // Cache duration in milliseconds (5 minutes)
  const CACHE_DURATION = 5 * 60 * 1000;

  const isCacheValid = useCallback((key) => {
    const timestamp = cacheTimestamps[key];
    if (!timestamp) return false;
    return Date.now() - timestamp < CACHE_DURATION;
  }, [cacheTimestamps]);

  const getCachedData = useCallback((key) => {
    if (isCacheValid(key)) {
      return cache[key];
    }
    return null;
  }, [cache, isCacheValid]);

  const setCachedData = useCallback((key, data) => {
    setCache(prev => ({
      ...prev,
      [key]: data
    }));
    setCacheTimestamps(prev => ({
      ...prev,
      [key]: Date.now()
    }));
  }, []);

  const invalidateCache = useCallback((key) => {
    setCache(prev => ({
      ...prev,
      [key]: null
    }));
    setCacheTimestamps(prev => ({
      ...prev,
      [key]: null
    }));
  }, []);

  const clearAllCache = useCallback(() => {
    setCache({
      products: null,
      transactions: null,
      stockMovements: null,
      employees: null,
      stats: null
    });
    setCacheTimestamps({
      products: null,
      transactions: null,
      stockMovements: null,
      employees: null,
      stats: null
    });
  }, []);

  return (
    <DataCacheContext.Provider
      value={{
        cache,
        getCachedData,
        setCachedData,
        invalidateCache,
        clearAllCache,
        isCacheValid
      }}
    >
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => {
  const context = useContext(DataCacheContext);
  if (!context) {
    throw new Error('useDataCache must be used within a DataCacheProvider');
  }
  return context;
};

