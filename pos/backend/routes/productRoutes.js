const express = require('express');
const router = express.Router();
const apicache = require('apicache');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  searchProducts,
  updateStockAfterTransaction,
  stockInProduct,
  stockOutProduct,
  toggleDisplayInTerminal,
  getInventoryStats,
  archiveProduct
} = require('../controllers/productController');

// Cache middleware — caches GET responses in memory
const cache = apicache.middleware;

// Clear product cache on any write operation
const clearCache = (req, res, next) => {
  apicache.clear();
  next();
};


router.route('/')
  .get(cache('30 seconds'), getAllProducts)
  .post(clearCache, createProduct);

router.get('/search/:query', searchProducts);
router.get('/inventory-stats', getInventoryStats);

// Get low stock and out of stock products (optimized)
router.get('/low-stock', async (req, res) => {
  try {
    const Product = require('../models/Product');
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const products = await Product.find({ isArchived: { $ne: true } })
      .select(
        'itemName sku currentStock reorderNumber itemImage category expirationDate expirationThresholdDays sizes',
      )
      .lean();

    const normalizeDateStart = (value) => {
      if (!value) return null;
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return null;
      d.setHours(0, 0, 0, 0);
      return d;
    };

    const getNearestActiveExpiration = (product) => {
      const candidates = [];
      const stock = Number(product?.currentStock || 0);
      if (product?.expirationDate && stock > 0) {
        candidates.push(product.expirationDate);
      }

      const sizes = product?.sizes;
      if (sizes && typeof sizes === 'object') {
        Object.values(sizes).forEach((sizeData) => {
          if (!sizeData || typeof sizeData !== 'object') return;

          if (Array.isArray(sizeData.batches)) {
            sizeData.batches.forEach((batch) => {
              if ((batch?.qty || 0) > 0 && batch?.expirationDate) {
                candidates.push(batch.expirationDate);
              }
            });
          }

          if (sizeData.variants && typeof sizeData.variants === 'object') {
            Object.values(sizeData.variants).forEach((variantData) => {
              if (!variantData || typeof variantData !== 'object') return;
              if (!Array.isArray(variantData.batches)) return;
              variantData.batches.forEach((batch) => {
                if ((batch?.qty || 0) > 0 && batch?.expirationDate) {
                  candidates.push(batch.expirationDate);
                }
              });
            });
          }
        });
      }

      const dates = candidates
        .map((value) => normalizeDateStart(value))
        .filter(Boolean)
        .sort((a, b) => a - b);
      return dates[0] || null;
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertItems = [];

    products.forEach((product) => {
      const stock = Number(product.currentStock || 0);
      const effectiveThreshold = Math.max(Number(product.reorderNumber || 0), 10);
      const baseData = {
        _id: String(product._id),
        itemName: product.itemName || 'Unnamed Product',
        sku: product.sku || '',
        currentStock: stock,
        itemImage: product.itemImage || '',
        category: product.category || '',
      };

      if (stock <= effectiveThreshold) {
        alertItems.push({
          ...baseData,
          alertKey: `${String(product._id)}:stock`,
          alertType: stock === 0 ? 'out_of_stock' : 'low_stock',
          effectiveThreshold,
        });
      }

      const nearestExpiry = getNearestActiveExpiration(product);
      if (nearestExpiry && stock > 0) {
        const daysUntilExpiration = Math.ceil(
          (nearestExpiry.getTime() - today.getTime()) / MS_PER_DAY,
        );
        const expirationThresholdDays = Math.max(
          0,
          parseInt(product.expirationThresholdDays, 10) || 30,
        );

        if (daysUntilExpiration < 0 || daysUntilExpiration <= expirationThresholdDays) {
          alertItems.push({
            ...baseData,
            alertKey: `${String(product._id)}:expiry`,
            alertType: daysUntilExpiration < 0 ? 'expired' : 'expiring_soon',
            expirationDate: nearestExpiry.toISOString().slice(0, 10),
            expirationThresholdDays,
            daysUntilExpiration,
          });
        }
      }
    });

    const alertPriority = {
      expired: 0,
      out_of_stock: 1,
      expiring_soon: 2,
      low_stock: 3,
    };

    alertItems.sort((a, b) => {
      const pa = alertPriority[a.alertType] ?? 99;
      const pb = alertPriority[b.alertType] ?? 99;
      if (pa !== pb) return pa - pb;
      if (a.alertType === 'expiring_soon' || a.alertType === 'expired') {
        return (a.daysUntilExpiration ?? Number.MAX_SAFE_INTEGER) - (b.daysUntilExpiration ?? Number.MAX_SAFE_INTEGER);
      }
      return (a.currentStock ?? 0) - (b.currentStock ?? 0);
    });

    const limitedItems = alertItems.slice(0, 50);

    res.json({
      success: true,
      count: limitedItems.length,
      data: limitedItems
    });
  } catch (error) {
    console.error('Error fetching stock alert products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock alert products',
      error: error.message
    });
  }
});

// Update stock after successful transaction
router.post('/update-stock', clearCache, updateStockAfterTransaction);

// Stock-in/out endpoints (server-side FIFO batching)
router.post('/:id/stock-in', clearCache, stockInProduct);
router.post('/:id/stock-out', clearCache, stockOutProduct);

// Get SKU counts by brand for dashboard chart
router.get('/sku-stats', cache('2 minutes'), async (req, res) => {
  try {
    const Product = require('../models/Product');
    const products = await Product.find({}).select('brandName currentStock').lean();

    // Group products by brand name and count SKUs
    const brandStats = {};
    products.forEach(product => {
      const brand = product.brandName?.trim() || 'Unbranded';
      if (!brandStats[brand]) {
        brandStats[brand] = {
          brand,
          skuCount: 0,
          totalStock: 0
        };
      }
      brandStats[brand].skuCount += 1;
      brandStats[brand].totalStock += product.currentStock || 0;
    });

    // Convert to array and sort by SKU count descending
    const statsArray = Object.values(brandStats)
      .sort((a, b) => b.skuCount - a.skuCount);

    res.json({
      success: true,
      data: statsArray
    });
  } catch (error) {
    console.error('Error fetching SKU stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching SKU stats',
      error: error.message
    });
  }
});

router.get('/category/:category', getProductsByCategory);


router.route('/:id')
  .get(getProductById)
  .put(clearCache, updateProduct)
  .delete(clearCache, deleteProduct);

router.patch('/:id/toggle-display', clearCache, toggleDisplayInTerminal);
router.patch('/:id/archive', clearCache, archiveProduct);

module.exports = router;

