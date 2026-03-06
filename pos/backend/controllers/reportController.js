const SalesTransaction = require("../models/SalesTransaction");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

/**
 * Helper: get date range from timeframe string
 * Matches the Dashboard chart ranges for consistency
 */
const getDateRange = (timeframe, customStartDate, customEndDate) => {
  const now = new Date();
  let start, end;

  end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (timeframe === "custom" && customStartDate && customEndDate) {
    start = new Date(customStartDate);
    start.setHours(0, 0, 0, 0);
    end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  switch (timeframe) {
    case "daily":
      // Last 7 days (matches Dashboard chart)
      start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      // Last 12 weeks
      start = new Date(now);
      start.setDate(start.getDate() - 12 * 7);
      start.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      // Last 12 months
      start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case "yearly":
      // Last 5 years
      start = new Date(now.getFullYear() - 4, 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
  }
  return { start, end };
};

/**
 * GET /api/reports/inventory-analytics
 * Returns all data needed for the Inventory & Product analytics tab
 */
exports.getInventoryAnalytics = async (req, res) => {
  try {
    const {
      timeframe = "daily",
      startDate: customStart,
      endDate: customEnd,
    } = req.query;
    const { start, end } = getDateRange(timeframe, customStart, customEnd);

    // ── 1. Fetch all products for inventory value calculations ──
    const products = await Product.find({}).lean();

    const inventoryValue = products.reduce(
      (sum, p) => sum + (p.itemPrice || 0) * (p.currentStock || 0),
      0,
    );
    const totalItems = products.length;

    // ── 2. Fetch completed transactions in the time range ──
    const transactions = await SalesTransaction.find({
      $or: [
        { checkedOutAt: { $gte: start, $lte: end } },
        {
          checkedOutAt: { $exists: false },
          createdAt: { $gte: start, $lte: end },
        },
      ],
      status: { $not: { $regex: /^voided$/i } },
      paymentMethod: { $ne: "return" },
    }).lean();

    // Calculate Total Sales (Revenue)
    const totalSales = transactions.reduce(
      (sum, t) => sum + (t.totalAmount || 0),
      0,
    );
    const totalTransactions = transactions.length;

    // Calculate total units sold
    let totalUnitsSold = 0;
    for (const txn of transactions) {
      for (const item of txn.items || []) {
        totalUnitsSold += item.quantity || 1;
      }
    }

    // Build product cost lookup
    const productCostMap = {};
    products.forEach((p) => {
      productCostMap[p._id.toString()] = p.costPrice || 0;
    });

    // Calculate COGS & Profit from transactions
    let cogs = 0;
    for (const txn of transactions) {
      for (const item of txn.items || []) {
        const costPrice = productCostMap[item.productId?.toString()] || 0;
        cogs += costPrice * (item.quantity || 1);
      }
    }
    const totalProfit = totalSales - cogs;
    const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Product stock breakdown
    const inStockCount = products.filter(
      (p) => (p.currentStock || 0) > (p.reorderNumber || 10),
    ).length;
    const lowStockCount = products.filter(
      (p) =>
        (p.currentStock || 0) > 0 &&
        (p.currentStock || 0) <= (p.reorderNumber || 10),
    ).length;
    const outOfStockCount = products.filter(
      (p) => (p.currentStock || 0) === 0,
    ).length;
    const totalStockUnits = products.reduce(
      (sum, p) => sum + (p.currentStock || 0),
      0,
    );
    const costValue = products.reduce(
      (sum, p) => sum + (p.costPrice || 0) * (p.currentStock || 0),
      0,
    );

    // ── 3. Fetch stock movements in the time range ──
    const movements = await StockMovement.find({
      createdAt: { $gte: start, $lte: end },
    }).lean();

    // Count by type
    let stockInCount = 0;
    let stockOutCount = 0;
    let pullOutCount = 0;
    movements.forEach((m) => {
      if (m.type === "Stock-In") stockInCount += Math.abs(m.quantity);
      else if (m.type === "Stock-Out") stockOutCount += Math.abs(m.quantity);
      else if (m.type === "Pull-Out") pullOutCount += Math.abs(m.quantity);
    });

    // ── 4. Build Inventory Analysis chart data (Stock-In vs Stock-Out per period) ──
    const inventoryChartData = buildTimeSeriesData(
      movements,
      timeframe,
      start,
      end,
    );

    // ── 5. Build Profit Analysis chart data (Revenue, COGS, Profit per period) ──
    const profitChartData = await buildProfitChartData(
      transactions,
      timeframe,
      start,
      end,
      productCostMap,
    );

    // ── 6. Damaged & Expired stock data ──
    const damagedExpiredMovements = movements
      .filter((m) => ["Damaged", "Expired", "Lost"].includes(m.reason))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20)
      .map((m) => ({
        itemName: m.itemName || "Unknown",
        sku: m.sku || "-",
        category: m.category || "-",
        type: m.reason,
        quantity: Math.abs(m.quantity),
        date: m.createdAt,
        handledBy: m.handledBy || "Unknown",
        notes: m.notes || "",
      }));

    // Total damaged/expired/lost quantities
    const damagedTotal = movements
      .filter((m) => m.reason === "Damaged")
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const expiredTotal = movements
      .filter((m) => m.reason === "Expired")
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);
    const lostTotal = movements
      .filter((m) => m.reason === "Lost")
      .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

    res.json({
      success: true,
      data: {
        // KPI Cards
        kpis: {
          totalSales,
          totalTransactions,
          totalUnitsSold,
          cogs,
          totalProfit,
          profitMargin: Math.round(profitMargin * 100) / 100,
          inventoryValue,
          costValue,
          totalStockUnits,
        },
        // Stat Cards
        stats: {
          totalItems,
          inStockCount,
          lowStockCount,
          outOfStockCount,
          stockInCount,
          stockOutCount,
          pullOutCount,
        },
        // Chart: Inventory Analysis (Stock-In vs Stock-Out bars)
        inventoryChartData,
        // Chart: Profit Analysis (Revenue, COGS, Profit bars)
        profitChartData,
        // Table: Damaged & Expired
        damagedExpired: {
          items: damagedExpiredMovements,
          summary: {
            damaged: damagedTotal,
            expired: expiredTotal,
            lost: lostTotal,
            total: damagedTotal + expiredTotal + lostTotal,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error fetching inventory analytics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching inventory analytics",
      error: error.message,
    });
  }
};

/**
 * Build time series data for stock movements (Stock-In vs Stock-Out vs Pull-Out)
 */
function buildTimeSeriesData(movements, timeframe, start, end) {
  const buckets = generateBuckets(timeframe, start, end);

  movements.forEach((m) => {
    const date = new Date(m.createdAt);
    const bucketKey = getBucketKey(date, timeframe, buckets);
    const bucket = buckets.find((b) => b.key === bucketKey);
    if (bucket) {
      const qty = Math.abs(m.quantity);
      if (m.type === "Stock-In") bucket.stockIn += qty;
      else if (m.type === "Stock-Out") bucket.stockOut += qty;
      else if (m.type === "Pull-Out") bucket.pullOut += qty;
    }
  });

  return buckets.map((b) => ({
    period: b.label,
    stockIn: b.stockIn,
    stockOut: b.stockOut,
    pullOut: b.pullOut,
  }));
}

/**
 * Build time series data for profit analysis (Revenue, COGS, Profit)
 */
async function buildProfitChartData(
  transactions,
  timeframe,
  start,
  end,
  costMap,
) {
  const buckets = generateBuckets(timeframe, start, end);

  for (const txn of transactions) {
    const date = new Date(txn.checkedOutAt || txn.createdAt);
    const bucketKey = getBucketKey(date, timeframe, buckets);
    const bucket = buckets.find((b) => b.key === bucketKey);
    if (bucket) {
      bucket.revenue += txn.totalAmount || 0;
      for (const item of txn.items || []) {
        const cost = costMap[item.productId?.toString()] || 0;
        bucket.cogs += cost * (item.quantity || 1);
      }
    }
  }

  return buckets.map((b) => ({
    period: b.label,
    revenue: Math.round(b.revenue * 100) / 100,
    cogs: Math.round(b.cogs * 100) / 100,
    profit: Math.round((b.revenue - b.cogs) * 100) / 100,
  }));
}

/**
 * Generate time buckets matching the Dashboard sales chart format
 */
function generateBuckets(timeframe, start, end) {
  const buckets = [];
  const now = new Date();

  switch (timeframe) {
    case "daily": {
      // Last 7 days: "Feb 9", "Feb 10", ... "Feb 15"
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const label = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        buckets.push({
          key: `day_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`,
          label,
          date: new Date(d),
          stockIn: 0,
          stockOut: 0,
          pullOut: 0,
          revenue: 0,
          cogs: 0,
        });
      }
      break;
    }
    case "weekly": {
      // Last 12 weeks
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - dayOfWeek - i * 7);
        weekStart.setHours(0, 0, 0, 0);
        const label = `Week ${weekStart.getDate()}`;
        buckets.push({
          key: `week_${i}`,
          label,
          date: new Date(weekStart),
          stockIn: 0,
          stockOut: 0,
          pullOut: 0,
          revenue: 0,
          cogs: 0,
        });
      }
      break;
    }
    case "monthly": {
      // Last 12 months: "Mar", "Apr", ... "Feb"
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        d.setHours(0, 0, 0, 0);
        const label = d.toLocaleDateString("en-US", { month: "short" });
        buckets.push({
          key: `month_${d.getFullYear()}_${d.getMonth()}`,
          label,
          date: new Date(d),
          stockIn: 0,
          stockOut: 0,
          pullOut: 0,
          revenue: 0,
          cogs: 0,
        });
      }
      break;
    }
    case "yearly": {
      // Last 5 years: "2022", "2023", "2024", "2025", "2026"
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const label = year.toString();
        buckets.push({
          key: `year_${year}`,
          label,
          date: new Date(year, 0, 1),
          stockIn: 0,
          stockOut: 0,
          pullOut: 0,
          revenue: 0,
          cogs: 0,
        });
      }
      break;
    }
    default: {
      // Custom range: auto-detect granularity
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays <= 31) {
        // Day by day
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const label = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          buckets.push({
            key: `cd_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`,
            label,
            date: new Date(d),
            stockIn: 0,
            stockOut: 0,
            pullOut: 0,
            revenue: 0,
            cogs: 0,
          });
        }
      } else if (diffDays <= 180) {
        // Weekly
        const weeks = Math.ceil(diffDays / 7);
        for (let i = 0; i < weeks; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i * 7);
          const label = `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          buckets.push({
            key: `cw_${i}`,
            label,
            date: new Date(d),
            stockIn: 0,
            stockOut: 0,
            pullOut: 0,
            revenue: 0,
            cogs: 0,
          });
        }
      } else {
        // Monthly
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
          const label = current.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });
          buckets.push({
            key: `cm_${current.getFullYear()}_${current.getMonth()}`,
            label,
            date: new Date(current),
            stockIn: 0,
            stockOut: 0,
            pullOut: 0,
            revenue: 0,
            cogs: 0,
          });
          current.setMonth(current.getMonth() + 1);
        }
      }
    }
  }

  return buckets;
}

/**
 * Get the bucket key for a given date and timeframe
 */
function getBucketKey(date, timeframe, buckets) {
  switch (timeframe) {
    case "daily": {
      return `day_${date.getFullYear()}_${date.getMonth()}_${date.getDate()}`;
    }
    case "weekly": {
      // Find which weekly bucket this date falls into
      for (let i = 0; i < buckets.length; i++) {
        const bucketStart = buckets[i].date;
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketEnd.getDate() + 7);
        if (date >= bucketStart && date < bucketEnd) {
          return buckets[i].key;
        }
      }
      return null;
    }
    case "monthly": {
      return `month_${date.getFullYear()}_${date.getMonth()}`;
    }
    case "yearly": {
      return `year_${date.getFullYear()}`;
    }
    default: {
      // Custom: find matching bucket by date range
      const diffDays =
        buckets.length > 1 && buckets[1].key.startsWith("cw_") ? 7 : 1;
      if (diffDays === 1) {
        return `cd_${date.getFullYear()}_${date.getMonth()}_${date.getDate()}`;
      } else if (buckets[0] && buckets[0].key.startsWith("cw_")) {
        for (let i = 0; i < buckets.length; i++) {
          const bucketStart = buckets[i].date;
          const bucketEnd = new Date(bucketStart);
          bucketEnd.setDate(bucketEnd.getDate() + 7);
          if (date >= bucketStart && date < bucketEnd) {
            return buckets[i].key;
          }
        }
      } else {
        return `cm_${date.getFullYear()}_${date.getMonth()}`;
      }
      return null;
    }
  }
}
