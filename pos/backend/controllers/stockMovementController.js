const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');

// Create a stock movement log
exports.createStockMovement = async (req, res) => {
  try {
    const {
      productId,
      type,
      quantity,
      stockBefore,
      stockAfter,
      reason,
      handledBy,
      handledById,
      notes
    } = req.body;

    if (!productId || !type || !quantity || stockBefore === undefined || stockAfter === undefined || !reason || !handledBy) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const stockMovement = await StockMovement.create({
      productId,
      sku: product.sku,
      itemName: product.itemName,
      itemImage: product.itemImage || '',
      category: product.category,
      brandName: product.brandName || '',
      type,
      quantity,
      stockBefore,
      stockAfter,
      reason,
      handledBy,
      handledById: handledById || '',
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: 'Stock movement logged successfully',
      data: stockMovement
    });
  } catch (error) {
    console.error('Error creating stock movement:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating stock movement',
      error: error.message
    });
  }
};


// Get all stock movements with filters
exports.getStockMovements = async (req, res) => {
  try {
    const {
      search = '',
      category,
      type,
      brand,
      reason,
      date,
      sortBy = 'date-desc',
      page = 1,
      limit = 60
    } = req.query;



    const query = {};

    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchTrimmed = String(search || "").trim();
    if (searchTrimmed) {
      // Avoid slow unanchored regex scans when logs get large.
      // - If it looks like a SKU/code (no spaces), use prefix regex on sku (index-friendly).
      // - Otherwise, use $text search (uses text index).
      const looksLikeCode = /^[a-zA-Z0-9_-]+$/.test(searchTrimmed);
      if (looksLikeCode && searchTrimmed.length >= 2) {
        query.sku = { $regex: `^${escapeRegex(searchTrimmed)}`, $options: "i" };
      } else if (searchTrimmed.length >= 3) {
        query.$text = { $search: searchTrimmed };
      } else {
        // Keep old behavior for very short searches.
        query.$or = [
          { itemName: { $regex: escapeRegex(searchTrimmed), $options: "i" } },
          { sku: { $regex: escapeRegex(searchTrimmed), $options: "i" } },
          { handledBy: { $regex: escapeRegex(searchTrimmed), $options: "i" } }
        ];
      }
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (type && type !== 'All') {
      query.type = type;
    }

    if (brand && brand !== 'All') {
      query.brandName = brand;
    }

    if (reason && reason !== 'All') {
      query.reason = reason;
    }

    if (date && date !== 'All') {
      const now = new Date();
      let startDate, endDate;

      if (date === 'Today') {
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      } else if (date === 'This Week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      } else if (date === 'This Month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Assume it's a specific date string
        startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
      }

      query.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Determine sort order
    let sort = { createdAt: -1 };
    switch (sortBy) {
      case 'date-asc':
        sort = { createdAt: 1 };
        break;
      case 'quantity-desc':
        sort = { quantity: -1 };
        break;
      case 'quantity-asc':
        sort = { quantity: 1 };
        break;
      case 'name-asc':
        sort = { itemName: 1 };
        break;
      case 'name-desc':
        sort = { itemName: -1 };
        break;
      case 'sku-asc':
        sort = { sku: 1 };
        break;
      case 'sku-desc':
        sort = { sku: -1 };
        break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);



    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StockMovement.countDocuments(query)
    ]);



    res.json({
      success: true,
      data: movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock movements',
      error: error.message
    });
  }
};

// Get stock movement stats for today
exports.getTodayStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Use aggregation pipeline instead of fetching all documents
    const result = await StockMovement.aggregate([
      { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$quantity' },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      stockIn: 0,
      stockOut: 0,
      pullOut: 0,
      totalMovements: 0
    };

    result.forEach(r => {
      if (r._id === 'Stock-In') stats.stockIn = r.total;
      else if (r._id === 'Stock-Out') stats.stockOut = r.total;
      else if (r._id === 'Pull-Out') stats.pullOut = r.total;
      stats.totalMovements += r.count;
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching today stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today stats',
      error: error.message
    });
  }
};

// Get stock movements by product
exports.getMovementsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 50 } = req.query;

    const movements = await StockMovement.find({ productId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      count: movements.length,
      data: movements
    });
  } catch (error) {
    console.error('Error fetching product movements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product movements',
      error: error.message
    });
  }
};
// Get stock stats over time for charts (with filters)
exports.getStockStatsOverTime = async (req, res) => {
  try {
    const { timeframe = 'daily' } = req.query;
    const now = new Date();

    // Determine periods based on timeframe
    let periods = []; // Array of { start, end, label }
    let limit = 7;

    switch (timeframe.toLowerCase()) {
      case 'daily':
        limit = 7;
        for (let i = limit - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const start = new Date(d);
          start.setHours(0, 0, 0, 0);
          const end = new Date(d);
          end.setHours(23, 59, 59, 999);

          periods.push({ start, end, label });
        }
        break;

      case 'monthly':
        // Show last 4-5 weeks? Or just current week broken down?
        // Usually "Weekly" view shows days of the current week or last 7 days.
        // But if filtering by "Weekly", maybe it means "This Week" vs "Last Week"?
        // In the context of "Sales Over Time" chart in this app:
        // "Daily" -> Last 7 days
        // "Monthly" -> Last 6-12 months
        // "Yearly" -> Last 3-5 years

        // Let's follow the Sales Chart pattern (from analytics.jsx which sends "weekly" but means "This Week" broken down? No, it sends "daily" default)
        // If user selects "Monthly" tab, it shows data aggregated by month.

        // Let's implement:
        // Daily: Last 7 days (Day labels)
        // Monthly: Last 6 months (Month labels)
        // Yearly: Last 5 years (Year labels)

        // REVISIT: The tabs in Analytics.jsx are "daily", "monthly", "yearly".
        // "daily" shows last 7 days.

        // "monthly" usually shows breakdown BY MONTH for the last X months.
        limit = 6;
        for (let i = limit - 1; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = d.toLocaleDateString('en-US', { month: 'short' });

          const start = new Date(d);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

          periods.push({ start, end, label });
        }
        break;

      case 'yearly':
        limit = 5;
        for (let i = limit - 1; i >= 0; i--) {
          const year = now.getFullYear() - i;
          const label = year.toString();

          const start = new Date(year, 0, 1, 0, 0, 0, 0);
          const end = new Date(year, 11, 31, 23, 59, 59, 999);

          periods.push({ start, end, label });
        }
        break;

      default: // Default to daily
        limit = 7;
        for (let i = limit - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          const start = new Date(d);
          start.setHours(0, 0, 0, 0);
          const end = new Date(d);
          end.setHours(23, 59, 59, 999);

          periods.push({ start, end, label });
        }
    }

    // Initialize data arrays
    const stockIn = new Array(periods.length).fill(0);
    const pullOut = new Array(periods.length).fill(0);
    const labels = periods.map(p => p.label);

    // Aggregate in MongoDB (fast at scale), then map into the same UI periods.
    const globalStart = periods[0].start;
    const globalEnd = periods[periods.length - 1].end;

    const unit =
      timeframe.toLowerCase() === 'monthly' ? 'month' :
        timeframe.toLowerCase() === 'yearly' ? 'year' :
          'day';

    const agg = await StockMovement.aggregate([
      {
        $addFields: {
          effectiveType: { $ifNull: ['$type', '$movementType'] },
        },
      },
      {
        $match: {
          createdAt: { $gte: globalStart, $lte: globalEnd },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit } },
          stockIn: {
            $sum: {
              $cond: [
                { $in: ['$effectiveType', ['Stock-In', 'in', 'stock-in']] },
                { $ifNull: ['$quantity', 0] },
                0,
              ],
            },
          },
          pullOut: {
            $sum: {
              $cond: [
                {
                  $in: [
                    '$effectiveType',
                    ['Pull-Out', 'out', 'stock-out', 'pull-out'],
                  ],
                },
                { $ifNull: ['$quantity', 0] },
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byBucketIso = new Map(
      agg.map((r) => [
        new Date(r._id).toISOString(),
        { stockIn: r.stockIn || 0, pullOut: r.pullOut || 0 },
      ]),
    );

    periods.forEach((p, idx) => {
      const bucket = new Date(p.start);
      if (unit === 'day') {
        bucket.setHours(0, 0, 0, 0);
      } else if (unit === 'month') {
        bucket.setDate(1);
        bucket.setHours(0, 0, 0, 0);
      } else {
        bucket.setMonth(0, 1);
        bucket.setHours(0, 0, 0, 0);
      }
      const key = bucket.toISOString();
      const row = byBucketIso.get(key);
      if (row) {
        stockIn[idx] = row.stockIn;
        pullOut[idx] = row.pullOut;
      }
    });

    res.json({
      success: true,
      data: {
        labels,
        stockIn,
        pullOut
      }
    });
  } catch (error) {
    console.error('Error fetching stock stats over time:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock stats over time',
      error: error.message
    });
  }
};
