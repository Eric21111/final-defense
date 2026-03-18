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

    // Find products where currentStock <= max(reorderNumber, 10)
    // reorderNumber defaults to 0 in DB, so we use max with 10 as the minimum threshold
    const stockAlertItems = await Product.aggregate([
      {
        $project: {
          itemName: 1,
          sku: 1,
          currentStock: { $ifNull: ["$currentStock", 0] },
          // Use the higher of the stored reorderNumber or 10 as the effective threshold
          effectiveThreshold: {
            $max: [{ $ifNull: ["$reorderNumber", 0] }, 10]
          },
          itemImage: { $ifNull: ["$itemImage", ""] },
          category: { $ifNull: ["$category", ""] },
          alertType: {
            $cond: {
              if: { $eq: [{ $ifNull: ["$currentStock", 0] }, 0] },
              then: 'out_of_stock',
              else: 'low_stock'
            }
          }
        }
      },
      {
        $match: {
          $expr: { $lte: ["$currentStock", "$effectiveThreshold"] }
        }
      },
      {
        $sort: {
          alertType: -1,
          currentStock: 1
        }
      },
      { $limit: 50 }
    ]);

    res.json({
      success: true,
      count: stockAlertItems.length,
      data: stockAlertItems
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

