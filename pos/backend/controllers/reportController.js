const SalesTransaction = require("../models/SalesTransaction");
const Product = require("../models/Product");
const StockMovement = require("../models/StockMovement");

/**
 * Helper: get date range from timeframe string
 * Matches the Dashboard chart ranges for consistency
 */
const getDateRange = (timeframe, customStartDate, customEndDate) => {
  const now = new Date();
  let kpiStart, chartStart, end;

  end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (timeframe === "custom" && customStartDate && customEndDate) {
    kpiStart = new Date(customStartDate);
    kpiStart.setHours(0, 0, 0, 0);
    chartStart = kpiStart;
    end = new Date(customEndDate);
    end.setHours(23, 59, 59, 999);
    return { kpiStart, chartStart, end };
  }

  switch (timeframe) {
    case "daily":
      // KPI: Today
      kpiStart = new Date(now);
      kpiStart.setHours(0, 0, 0, 0);
      // Chart: Last 7 days (matches Dashboard chart)
      chartStart = new Date(now);
      chartStart.setDate(chartStart.getDate() - 6);
      chartStart.setHours(0, 0, 0, 0);
      break;
    case "weekly":
      // KPI: This Week
      kpiStart = new Date(now);
      const day = kpiStart.getDay();
      kpiStart.setDate(kpiStart.getDate() - day);
      kpiStart.setHours(0, 0, 0, 0);
      // Chart: Last 12 weeks
      chartStart = new Date(now);
      chartStart.setDate(chartStart.getDate() - 12 * 7);
      chartStart.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      // KPI: This Month
      kpiStart = new Date(now.getFullYear(), now.getMonth(), 1);
      kpiStart.setHours(0, 0, 0, 0);
      // Chart: Last 12 months
      chartStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      chartStart.setHours(0, 0, 0, 0);
      break;
    case "yearly":
      // KPI: This Year
      kpiStart = new Date(now.getFullYear(), 0, 1);
      kpiStart.setHours(0, 0, 0, 0);
      // Chart: Last 5 years
      chartStart = new Date(now.getFullYear() - 4, 0, 1);
      chartStart.setHours(0, 0, 0, 0);
      break;
    default:
      kpiStart = new Date(now);
      kpiStart.setHours(0, 0, 0, 0);
      chartStart = new Date(now);
      chartStart.setDate(chartStart.getDate() - 6);
      chartStart.setHours(0, 0, 0, 0);
  }
  return { kpiStart, chartStart, end };
};

/**
 * GET /api/reports/inventory-analytics
 * Returns all data needed for the Inventory & Product analytics tab
 * 
 * OPTIMIZED: Uses MongoDB aggregation pipelines and parallel queries
 * to avoid loading entire collections into Node.js memory.
 * This prevents Render free-tier 30s timeout.
 */
exports.getInventoryAnalytics = async (req, res) => {
  try {
    const {
      timeframe = "daily",
      startDate: customStart,
      endDate: customEnd,
    } = req.query;
    const { kpiStart, chartStart, end } = getDateRange(timeframe, customStart, customEnd);

    // ── Run all queries in parallel for speed ──
    const [
      inventoryAgg,
      salesAgg,
      movementAgg,
      movementTimeSeries,
      salesTimeSeries,
      damagedExpiredItems,
    ] = await Promise.all([
      // 1. Product inventory aggregation (replaces Product.find({}).lean())
      Product.aggregate([
        {
          $match: {
            isArchived: false
          }
        },
        {
          $group: {
            _id: null,
            totalItems: { $sum: 1 },
            inventoryValue: {
              $sum: { $multiply: [{ $ifNull: ["$itemPrice", 0] }, { $ifNull: ["$currentStock", 0] }] },
            },
            costValue: {
              $sum: { $multiply: [{ $ifNull: ["$costPrice", 0] }, { $ifNull: ["$currentStock", 0] }] },
            },
            totalStockUnits: { $sum: { $ifNull: ["$currentStock", 0] } },
            inStockCount: {
              $sum: {
                $cond: [
                  { $gt: [{ $ifNull: ["$currentStock", 0] }, { $ifNull: ["$reorderNumber", 10] }] },
                  1,
                  0,
                ],
              },
            },
            lowStockCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: [{ $ifNull: ["$currentStock", 0] }, 0] },
                      { $lte: [{ $ifNull: ["$currentStock", 0] }, { $ifNull: ["$reorderNumber", 10] }] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            outOfStockCount: {
              $sum: {
                $cond: [{ $eq: [{ $ifNull: ["$currentStock", 0] }, 0] }, 1, 0],
              },
            },
          },
        },
      ]),

      // 2. Sales transaction aggregation with COGS calculation
      SalesTransaction.aggregate([
        {
          $match: {
            $or: [
              { checkedOutAt: { $gte: kpiStart, $lte: end } },
              {
                checkedOutAt: { $exists: false },
                createdAt: { $gte: kpiStart, $lte: end },
              },
            ],
            status: { $not: { $regex: /^voided$/i } },
            paymentMethod: { $ne: "return" },
          },
        },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo",
            pipeline: [{ $project: { costPrice: 1, sizes: 1 } }],
          },
        },
        { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            sizeData: {
              $let: {
                vars: {
                  matchedSize: {
                    $first: {
                      $filter: {
                        input: {
                          $objectToArray: { $ifNull: ["$productInfo.sizes", {}] },
                        },
                        as: "sz",
                        cond: { $eq: ["$$sz.k", "$items.selectedSize"] },
                      },
                    },
                  },
                },
                in: "$$matchedSize.v",
              },
            },
          },
        },
        {
          $addFields: {
            variantCostPrice: {
              $let: {
                vars: {
                  matchedVariantCostFromVariants: {
                    $first: {
                      $filter: {
                        input: {
                          $objectToArray: { $ifNull: ["$sizeData.variants", {}] },
                        },
                        as: "vn",
                        cond: { $eq: ["$$vn.k", "$items.variant"] },
                      },
                    },
                  },
                  firstVariantCostFromVariants: {
                    $arrayElemAt: [
                      {
                        $objectToArray: { $ifNull: ["$sizeData.variants", {}] },
                      },
                      0,
                    ],
                  },
                  matchedVariantCostFromLegacyMap: {
                    $first: {
                      $filter: {
                        input: {
                          $objectToArray: {
                            $ifNull: ["$sizeData.variantCostPrices", {}],
                          },
                        },
                        as: "lvc",
                        cond: { $eq: ["$$lvc.k", "$items.variant"] },
                      },
                    },
                  },
                },
                in: {
                  $ifNull: [
                    "$$matchedVariantCostFromVariants.v.costPrice",
                    {
                      $ifNull: [
                        "$$firstVariantCostFromVariants.v.costPrice",
                        "$$matchedVariantCostFromLegacyMap.v",
                      ],
                    },
                  ],
                },
              },
            },
            sizeCostPrice: {
              $cond: [
                { $eq: [{ $type: "$sizeData" }, "object"] },
                { $ifNull: ["$sizeData.costPrice", null] },
                null,
              ],
            },
            itemCostPrice: {
              $let: {
                vars: {
                  computedCost: {
                    $ifNull: [
                      "$variantCostPrice",
                      { $ifNull: ["$sizeCostPrice", { $ifNull: ["$productInfo.costPrice", 0] }] },
                    ],
                  },
                  firstSizeEntry: {
                    $arrayElemAt: [
                      { $objectToArray: { $ifNull: ["$productInfo.sizes", {}] } },
                      0,
                    ],
                  },
                },
                in: {
                  $cond: [
                    { $gt: ["$$computedCost", 0] },
                    "$$computedCost",
                    {
                      $let: {
                        vars: {
                          fallbackVariantCostPrice: {
                            $let: {
                              vars: {
                                firstVariantEntry: {
                                  $arrayElemAt: [
                                    {
                                      $objectToArray: {
                                        $ifNull: ["$$firstSizeEntry.v.variants", {}],
                                      },
                                    },
                                    0,
                                  ],
                                },
                                matchedVariantFromVariants: {
                                  $first: {
                                    $filter: {
                                      input: {
                                        $objectToArray: {
                                          $ifNull: ["$$firstSizeEntry.v.variants", {}],
                                        },
                                      },
                                      as: "vn",
                                      cond: { $eq: ["$$vn.k", "$items.variant"] },
                                    },
                                  },
                                },
                                matchedVariantFromLegacyMap: {
                                  $first: {
                                    $filter: {
                                      input: {
                                        $objectToArray: {
                                          $ifNull: ["$$firstSizeEntry.v.variantCostPrices", {}],
                                        },
                                      },
                                      as: "lvc",
                                      cond: { $eq: ["$$lvc.k", "$items.variant"] },
                                    },
                                  },
                                },
                              },
                              in: {
                                $ifNull: [
                                  "$$matchedVariantFromVariants.v.costPrice",
                                  {
                                    $ifNull: [
                                      "$$firstVariantEntry.v.costPrice",
                                      "$$matchedVariantFromLegacyMap.v",
                                    ],
                                  },
                                ],
                              },
                            },
                          },
                        },
                        in: {
                          $ifNull: [
                            "$$fallbackVariantCostPrice",
                            {
                              $ifNull: [
                                "$$firstSizeEntry.v.costPrice",
                                { $ifNull: ["$productInfo.costPrice", 0] },
                              ],
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            effectiveSoldQty: {
              $cond: [
                { $eq: ["$items.returnStatus", "Returned"] },
                0,
                { $ifNull: ["$items.quantity", 1] },
              ],
            },
          },
        },
        {
          $group: {
            _id: "$_id",
            totalAmount: { $first: "$totalAmount" },
            totalUnitsSold: { $sum: "$effectiveSoldQty" },
            cogs: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$itemCostPrice", 0] },
                  "$effectiveSoldQty",
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: { $ifNull: ["$totalAmount", 0] } },
            totalTransactions: { $sum: 1 },
            totalUnitsSold: { $sum: "$totalUnitsSold" },
            cogs: { $sum: "$cogs" },
          },
        },
      ]),

      // 3. Stock movement counts aggregation
      StockMovement.aggregate([
        { $match: { createdAt: { $gte: kpiStart, $lte: end } } },
        {
          $group: {
            _id: "$type",
            totalQuantity: { $sum: { $abs: "$quantity" } },
          },
        },
      ]),

      // 4. Stock movement time series (for inventory chart)
      StockMovement.aggregate([
        { $match: { createdAt: { $gte: chartStart, $lte: end } } },
        {
          $group: {
            _id: getTimeSeriesGroupId(timeframe),
            stockIn: {
              $sum: {
                $cond: [{ $eq: ["$type", "Stock-In"] }, { $abs: "$quantity" }, 0],
              },
            },
            stockOut: {
              $sum: {
                $cond: [{ $eq: ["$type", "Stock-Out"] }, { $abs: "$quantity" }, 0],
              },
            },
            pullOut: {
              $sum: {
                $cond: [{ $eq: ["$type", "Pull-Out"] }, { $abs: "$quantity" }, 0],
              },
            },
            sortDate: { $min: "$createdAt" },
          },
        },
        { $sort: { sortDate: 1 } },
      ]),

      // 5. Sales time series (for profit chart)
      SalesTransaction.aggregate([
        {
          $match: {
            $or: [
              { checkedOutAt: { $gte: chartStart, $lte: end } },
              {
                checkedOutAt: { $exists: false },
                createdAt: { $gte: chartStart, $lte: end },
              },
            ],
            status: { $not: { $regex: /^voided$/i } },
            paymentMethod: { $ne: "return" },
          },
        },
        { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productInfo",
            pipeline: [{ $project: { costPrice: 1, sizes: 1 } }],
          },
        },
        { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            sizeData: {
              $let: {
                vars: {
                  matchedSize: {
                    $first: {
                      $filter: {
                        input: {
                          $objectToArray: { $ifNull: ["$productInfo.sizes", {}] },
                        },
                        as: "sz",
                        cond: { $eq: ["$$sz.k", "$items.selectedSize"] },
                      },
                    },
                  },
                },
                in: "$$matchedSize.v",
              },
            },
          },
        },
        {
          $addFields: {
            variantCostPrice: {
              $let: {
                vars: {
                  matchedVariantCostFromVariants: {
                    $first: {
                      $filter: {
                        input: {
                          $objectToArray: { $ifNull: ["$sizeData.variants", {}] },
                        },
                        as: "vn",
                        cond: { $eq: ["$$vn.k", "$items.variant"] },
                      },
                    },
                  },
                  firstVariantCostFromVariants: {
                    $arrayElemAt: [
                      {
                        $objectToArray: { $ifNull: ["$sizeData.variants", {}] },
                      },
                      0,
                    ],
                  },
                  matchedVariantCostFromLegacyMap: {
                    $first: {
                      $filter: {
                        input: {
                          $objectToArray: {
                            $ifNull: ["$sizeData.variantCostPrices", {}],
                          },
                        },
                        as: "lvc",
                        cond: { $eq: ["$$lvc.k", "$items.variant"] },
                      },
                    },
                  },
                },
                in: {
                  $ifNull: [
                    "$$matchedVariantCostFromVariants.v.costPrice",
                    {
                      $ifNull: [
                        "$$firstVariantCostFromVariants.v.costPrice",
                        "$$matchedVariantCostFromLegacyMap.v",
                      ],
                    },
                  ],
                },
              },
            },
            sizeCostPrice: {
              $cond: [
                { $eq: [{ $type: "$sizeData" }, "object"] },
                { $ifNull: ["$sizeData.costPrice", null] },
                null,
              ],
            },
            itemCostPrice: {
              $let: {
                vars: {
                  computedCost: {
                    $ifNull: [
                      "$variantCostPrice",
                      { $ifNull: ["$sizeCostPrice", { $ifNull: ["$productInfo.costPrice", 0] }] },
                    ],
                  },
                  firstSizeEntry: {
                    $arrayElemAt: [
                      { $objectToArray: { $ifNull: ["$productInfo.sizes", {}] } },
                      0,
                    ],
                  },
                },
                in: {
                  $cond: [
                    { $gt: ["$$computedCost", 0] },
                    "$$computedCost",
                    {
                      $let: {
                        vars: {
                          fallbackVariantCostPrice: {
                            $let: {
                              vars: {
                                firstVariantEntry: {
                                  $arrayElemAt: [
                                    {
                                      $objectToArray: {
                                        $ifNull: ["$$firstSizeEntry.v.variants", {}],
                                      },
                                    },
                                    0,
                                  ],
                                },
                                matchedVariantFromVariants: {
                                  $first: {
                                    $filter: {
                                      input: {
                                        $objectToArray: {
                                          $ifNull: ["$$firstSizeEntry.v.variants", {}],
                                        },
                                      },
                                      as: "vn",
                                      cond: { $eq: ["$$vn.k", "$items.variant"] },
                                    },
                                  },
                                },
                                matchedVariantFromLegacyMap: {
                                  $first: {
                                    $filter: {
                                      input: {
                                        $objectToArray: {
                                          $ifNull: ["$$firstSizeEntry.v.variantCostPrices", {}],
                                        },
                                      },
                                      as: "lvc",
                                      cond: { $eq: ["$$lvc.k", "$items.variant"] },
                                    },
                                  },
                                },
                              },
                              in: {
                                $ifNull: [
                                  "$$matchedVariantFromVariants.v.costPrice",
                                  {
                                    $ifNull: [
                                      "$$firstVariantEntry.v.costPrice",
                                      "$$matchedVariantFromLegacyMap.v",
                                    ],
                                  },
                                ],
                              },
                            },
                          },
                        },
                        in: {
                          $ifNull: [
                            "$$fallbackVariantCostPrice",
                            {
                              $ifNull: [
                                "$$firstSizeEntry.v.costPrice",
                                { $ifNull: ["$productInfo.costPrice", 0] },
                              ],
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
            effectiveSoldQty: {
              $cond: [
                { $eq: ["$items.returnStatus", "Returned"] },
                0,
                { $ifNull: ["$items.quantity", 1] },
              ],
            },
            dateField: { $ifNull: ["$checkedOutAt", "$createdAt"] },
          },
        },
        {
          $group: {
            _id: {
              txnId: "$_id",
              period: getTimeSeriesGroupIdForDate(timeframe, "$dateField"),
            },
            revenue: { $first: "$totalAmount" },
            cogs: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$itemCostPrice", 0] },
                  "$effectiveSoldQty",
                ],
              },
            },
            sortDate: { $min: "$dateField" },
          },
        },
        {
          $group: {
            _id: "$_id.period",
            revenue: { $sum: { $ifNull: ["$revenue", 0] } },
            cogs: { $sum: "$cogs" },
            sortDate: { $min: "$sortDate" },
          },
        },
        { $sort: { sortDate: 1 } },
      ]),

      // 6. Damaged & expired items (limited to 20)
      StockMovement.aggregate([
        {
          $match: {
            createdAt: { $gte: kpiStart, $lte: end },
            reason: { $in: ["Damaged", "Expired", "Lost"] },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 20 },
        {
          $project: {
            itemName: { $ifNull: ["$itemName", "Unknown"] },
            sku: { $ifNull: ["$sku", "-"] },
            category: { $ifNull: ["$category", "-"] },
            type: "$reason",
            quantity: { $abs: "$quantity" },
            date: "$createdAt",
            handledBy: { $ifNull: ["$handledBy", "Unknown"] },
            notes: { $ifNull: ["$notes", ""] },
          },
        },
      ]),
    ]);

    // ── Process results ──

    // Inventory stats
    const inv = inventoryAgg[0] || {
      totalItems: 0,
      inventoryValue: 0,
      costValue: 0,
      totalStockUnits: 0,
      inStockCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
    };

    // Sales stats
    const sales = salesAgg[0] || {
      totalSales: 0,
      totalTransactions: 0,
      totalUnitsSold: 0,
      cogs: 0,
    };

    const totalProfit = sales.totalSales - sales.cogs;
    const profitMargin =
      sales.totalSales > 0 ? (totalProfit / sales.totalSales) * 100 : 0;

    // Stock movement counts
    let stockInCount = 0,
      stockOutCount = 0,
      pullOutCount = 0;
    movementAgg.forEach((m) => {
      if (m._id === "Stock-In") stockInCount = m.totalQuantity;
      else if (m._id === "Stock-Out") stockOutCount = m.totalQuantity;
      else if (m._id === "Pull-Out") pullOutCount = m.totalQuantity;
    });

    // Build inventory chart data with proper labels
    const inventoryChartData = buildChartFromAggregation(
      movementTimeSeries,
      timeframe,
      chartStart,
      end,
      "inventory",
    );

    // Build profit chart data with proper labels
    const profitChartData = buildChartFromAggregation(
      salesTimeSeries,
      timeframe,
      chartStart,
      end,
      "profit",
    );

    // Damaged/expired summary
    let damagedTotal = 0,
      expiredTotal = 0,
      lostTotal = 0;
    damagedExpiredItems.forEach((item) => {
      if (item.type === "Damaged") damagedTotal += item.quantity;
      else if (item.type === "Expired") expiredTotal += item.quantity;
      else if (item.type === "Lost") lostTotal += item.quantity;
    });

    res.json({
      success: true,
      data: {
        // KPI Cards
        kpis: {
          totalSales: sales.totalSales,
          totalTransactions: sales.totalTransactions,
          totalUnitsSold: sales.totalUnitsSold,
          cogs: sales.cogs,
          totalProfit,
          profitMargin: Math.round(profitMargin * 100) / 100,
          inventoryValue: inv.inventoryValue,
          costValue: inv.costValue,
          totalStockUnits: inv.totalStockUnits,
        },
        // Stat Cards
        stats: {
          totalItems: inv.totalItems,
          inStockCount: inv.inStockCount,
          lowStockCount: inv.lowStockCount,
          outOfStockCount: inv.outOfStockCount,
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
          items: damagedExpiredItems,
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
 * Get MongoDB $group _id expression for time series bucketing (using createdAt)
 */
function getTimeSeriesGroupId(timeframe) {
  switch (timeframe) {
    case "daily":
      return {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
    case "weekly":
      return {
        year: { $isoWeekYear: "$createdAt" },
        week: { $isoWeek: "$createdAt" },
      };
    case "monthly":
      return {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
      };
    case "yearly":
      return { year: { $year: "$createdAt" } };
    default:
      return {
        year: { $year: "$createdAt" },
        month: { $month: "$createdAt" },
        day: { $dayOfMonth: "$createdAt" },
      };
  }
}

/**
 * Get MongoDB $group _id expression for time series bucketing (using a specified field)
 */
function getTimeSeriesGroupIdForDate(timeframe, dateField) {
  switch (timeframe) {
    case "daily":
      return {
        year: { $year: dateField },
        month: { $month: dateField },
        day: { $dayOfMonth: dateField },
      };
    case "weekly":
      return {
        year: { $isoWeekYear: dateField },
        week: { $isoWeek: dateField },
      };
    case "monthly":
      return {
        year: { $year: dateField },
        month: { $month: dateField },
      };
    case "yearly":
      return { year: { $year: dateField } };
    default:
      return {
        year: { $year: dateField },
        month: { $month: dateField },
        day: { $dayOfMonth: dateField },
      };
  }
}

/**
 * Build chart data array with proper period labels from aggregation results.
 * Generates all expected time buckets and fills in aggregation data.
 */
function buildChartFromAggregation(aggResults, timeframe, start, end, chartType) {
  const buckets = generateBuckets(timeframe, start, end);

  // Map aggregation results by bucket key
  const dataMap = {};
  aggResults.forEach((item) => {
    const key = aggIdToKey(item._id, timeframe);
    dataMap[key] = item;
  });

  return buckets.map((bucket) => {
    const data = dataMap[bucket.key];
    if (chartType === "inventory") {
      return {
        period: bucket.label,
        stockIn: data ? data.stockIn : 0,
        stockOut: data ? data.stockOut : 0,
        pullOut: data ? data.pullOut : 0,
      };
    } else {
      // profit
      const revenue = data ? data.revenue : 0;
      const cogs = data ? data.cogs : 0;
      return {
        period: bucket.label,
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        profit: Math.round((revenue - cogs) * 100) / 100,
      };
    }
  });
}

/**
 * Convert aggregation _id to bucket key string
 */
function aggIdToKey(id, timeframe) {
  if (!id) return "unknown";
  switch (timeframe) {
    case "daily":
      return `day_${id.year}_${id.month - 1}_${id.day}`;
    case "weekly":
      return `week_${id.year}_${id.week}`;
    case "monthly":
      return `month_${id.year}_${id.month - 1}`;
    case "yearly":
      return `year_${id.year}`;
    default:
      if (id.day !== undefined) return `day_${id.year}_${id.month - 1}_${id.day}`;
      if (id.month !== undefined) return `month_${id.year}_${id.month - 1}`;
      return `year_${id.year}`;
  }
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
        // Calculate ISO week number
        const tempDate = new Date(weekStart);
        tempDate.setHours(0, 0, 0, 0);
        tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
        const week1 = new Date(tempDate.getFullYear(), 0, 4);
        const isoWeek =
          1 +
          Math.round(
            ((tempDate.getTime() - week1.getTime()) / 86400000 -
              3 +
              ((week1.getDay() + 6) % 7)) /
            7,
          );
        const label = `Week ${weekStart.getDate()}`;
        buckets.push({
          key: `week_${weekStart.getFullYear()}_${isoWeek}`,
          label,
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
        });
      }
      break;
    }
    case "yearly": {
      // Last 5 years: "2022", "2023", "2024", "2025", "2026"
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        buckets.push({
          key: `year_${year}`,
          label: year.toString(),
        });
      }
      break;
    }
    default: {
      // Custom range: auto-detect granularity
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays <= 31) {
        for (let i = 0; i <= diffDays; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          const label = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          buckets.push({
            key: `day_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`,
            label,
          });
        }
      } else if (diffDays <= 180) {
        const weeks = Math.ceil(diffDays / 7);
        for (let i = 0; i < weeks; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i * 7);
          const label = `Week of ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          buckets.push({
            key: `day_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`,
            label,
          });
        }
      } else {
        let current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
          const label = current.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });
          buckets.push({
            key: `month_${current.getFullYear()}_${current.getMonth()}`,
            label,
          });
          current.setMonth(current.getMonth() + 1);
        }
      }
    }
  }

  return buckets;
}
