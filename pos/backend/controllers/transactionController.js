const mongoose = require('mongoose');
const SalesTransaction = require('../models/SalesTransaction');
const GlobalSettings = require('../models/GlobalSettings');
const VoidLog = require('../models/VoidLog');
const Product = require('../models/Product');
const Discount = require('../models/Discount');
const { assertSaleStockAvailable } = require('../utils/saleStockValidation');
const { generateRandomReceiptNumber } = require('../utils/receiptNumbering');
const {
  computeVatInclusiveBreakdown,
  getNextSequentialReceiptNo,
} = require('../utils/birReceipt');
const { sanitizeItemImageForStorage } = require('../utils/itemImagePayload');

// Helper function to safely convert to ObjectId
const toObjectId = (id) => {
  if (!id) return null;
  try {
    if (mongoose.Types.ObjectId.isValid(id)) {
      return new mongoose.Types.ObjectId(id);
    }
    return null;
  } catch (e) {
    console.error('Error converting to ObjectId:', e);
    return null;
  }
};

/** Return reasons that should not restock inventory (unsellable / written off). */
const isArchiveReturnReason = (reason) => {
  const head = String(reason || '')
    .split(':')[0]
    .trim()
    .toLowerCase();
  return ['damaged', 'defective', 'expired'].includes(head);
};

// Generate a unique void ID
const generateVoidId = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let voidId;
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    voidId = 'VOID-';
    for (let i = 0; i < 6; i++) {
      voidId += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const existing = await SalesTransaction.findOne({ voidId });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    const timestamp = Date.now().toString().slice(-4);
    voidId = `VOID-${timestamp}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
  }

  return voidId;
};

exports.getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limitRaw = parseInt(req.query.limit);
    const limit = Math.min(Math.max(limitRaw || 20, 1), 500);
    const skip = (page - 1) * limit;

    const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const query = {};
    const search = String(req.query.search || "").trim();
    const paymentMethod = String(req.query.paymentMethod || "").trim();
    const status = String(req.query.status || "").trim();
    const userId = String(req.query.userId || "").trim();

    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (status) query.status = status;
    if (userId) query.userId = userId;

    if (search) {
      const safe = escapeRegex(search);
      query.$or = [
        { receiptNo: { $regex: safe, $options: "i" } },
        { referenceNo: { $regex: safe, $options: "i" } },
        { performedByName: { $regex: safe, $options: "i" } },
        { performedById: { $regex: safe, $options: "i" } },
        { "items.itemName": { $regex: safe, $options: "i" } },
        { "items.sku": { $regex: safe, $options: "i" } },
      ];
    }

    const transactions = await SalesTransaction.find(query)
      // Keep variant/selectedSize/sku on items — needed for returns and receipts (only strip heavy image)
      .select("-items.itemImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await SalesTransaction.countDocuments(query);

    res.json({
      success: true,
      count: transactions.length,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching transactions',
      error: error.message
    });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await SalesTransaction.findById(req.params.id).lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching transaction',
      error: error.message
    });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const transaction = await SalesTransaction.findById(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // Update allowed fields
    if (updateData.status) {
      transaction.status = updateData.status;
    }
    if (updateData.items) {
      transaction.items = updateData.items;
    }
    if (updateData.totalAmount !== undefined) {
      transaction.totalAmount = updateData.totalAmount;
    }
    if (updateData.originalTotalAmount !== undefined) {
      transaction.originalTotalAmount = updateData.originalTotalAmount;
    }
    if (updateData.returnedByName !== undefined) {
      transaction.returnedByName = updateData.returnedByName;
    }

    await transaction.save();

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating transaction',
      error: error.message
    });
  }
};

exports.createTransaction = async (req, res) => {
  try {
    const {
      items,
      subtotal,
      discount,
      discountType,
      discountValue,
      totalAmount,
      paymentMethod,
      amountPaid,
      amountReceived,
      change,
      changeGiven,
      cashierName,
      cashierId,
      userId,
      performedById,
      performedByName,
      status,
      customerName,
      customerType,
      seniorCitizenId,
      pwdId,
      referenceNo,
      receiptNo: providedReceiptNo,
      originalTransactionId,

      checkedOutAt,
      appliedDiscountIds, // Array of discount IDs used in this transaction
      terminalId: bodyTerminalId,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    try {
      await assertSaleStockAvailable(items);
    } catch (stockErr) {
      return res.status(400).json({
        success: false,
        message: stockErr.message || 'Insufficient stock for this sale'
      });
    }

    let gs = await GlobalSettings.findOne();
    if (!gs) {
      gs = await GlobalSettings.create({});
    }
    const birOn = !!gs.birCompliantEnabled;

    let receiptNo;
    let resolvedTerminalId = null;

    if (birOn) {
      try {
        const seq = await getNextSequentialReceiptNo(bodyTerminalId);
        receiptNo = seq.receiptNo;
        resolvedTerminalId = seq.terminalId;
      } catch (e) {
        if (e.code === 'TERMINAL_ID_REQUIRED') {
          return res.status(400).json({
            success: false,
            message:
              'Terminal ID is required for BIR-compliant sales. Set it under Settings → Receipt on this device.',
          });
        }
        throw e;
      }
    } else {
      receiptNo = providedReceiptNo || (await generateRandomReceiptNumber());
    }

    const vatRate = Number(gs.vatRatePercent ?? 12);
    const vatBreak =
      birOn && Number.isFinite(totalAmount)
        ? computeVatInclusiveBreakdown(totalAmount, vatRate)
        : null;

    const transactionData = {
      receiptNo,
      userId: userId || cashierId || performedById || 'system',
      performedById: performedById || cashierId || '',
      performedByName: performedByName || cashierName || '',
      items: items.map(item => {
        const productId = toObjectId(item._id || item.productId);
        if (!productId) {
          console.warn('Invalid productId for item:', item.itemName, 'ID:', item._id || item.productId);
        }
        return {
          productId: productId,
          itemName: item.itemName || 'Unknown Item',
          sku: item.sku || '',
          variant: item.variant || item.selectedVariation || null,
          selectedSize: item.selectedSize || item.size || null,
          quantity: item.quantity || 1,
          price: item.itemPrice || item.price || 0,
          itemImage: sanitizeItemImageForStorage(item.itemImage),
          returnReason: item.returnReason || null
        };
      }).filter(item => item.productId !== null),
      subtotal: subtotal || 0,
      discount: discount || 0,
      discountType: discountType || null,
      discountValue: discountValue || 0,
      totalAmount: totalAmount || 0,
      paymentMethod: paymentMethod || 'cash',
      amountReceived: amountReceived || amountPaid || 0,
      changeGiven: changeGiven || change || 0,
      status: status || 'Completed',
      customerName: customerName || null,
      customerType: customerType || 'regular',
      seniorCitizenId: seniorCitizenId || null,
      pwdId: pwdId || null,
      referenceNo: referenceNo || null,
      originalTransactionId: originalTransactionId || null,
      checkedOutAt: checkedOutAt || new Date(),
      terminalId: birOn ? resolvedTerminalId : null,
      netOfVat: vatBreak ? vatBreak.netOfVat : null,
      vatAmount: vatBreak ? vatBreak.vatAmount : null,
      vatRateApplied: vatBreak ? vatBreak.vatRateApplied : null,
      birTinSnapshot: birOn ? (gs.storeTin || '').trim() || null : null,
      birPtuSnapshot: birOn ? (gs.ptuNumber || '').trim() || null : null,
      appliedDiscountIds:
        Array.isArray(appliedDiscountIds) && appliedDiscountIds.length > 0 ?
          appliedDiscountIds.map((id) => toObjectId(id)).filter(Boolean) :
          undefined
    };

    // Validate that we have at least one valid item
    if (transactionData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid items to process. All product IDs were invalid.'
      });
    }

    console.log('Creating transaction, receiptNo:', transactionData.receiptNo, 'items:', transactionData.items.length);

    const transaction = await SalesTransaction.create(transactionData);

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });

    // Update discount usage counts asynchronously
    if (appliedDiscountIds && Array.isArray(appliedDiscountIds) && appliedDiscountIds.length > 0) {
      Promise.all(appliedDiscountIds.map(id =>
        Discount.findByIdAndUpdate(id, { $inc: { usageCount: 1 } })
      )).catch(err => console.error('Error updating discount usage counts:', err));
    }
  } catch (error) {
    console.error('Error creating transaction:', error);
    console.error('Error details:', error.errors || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      })) : null
    });
  }
};

exports.voidTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { voidReason, voidedBy, voidedById, voidedByName } = req.body;

    if (!voidReason || !voidedByName) {
      return res.status(400).json({
        success: false,
        message: 'Void reason and voided by name are required'
      });
    }

    const transaction = await SalesTransaction.findById(id);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status === 'Voided') {
      return res.status(400).json({
        success: false,
        message: 'Transaction is already voided'
      });
    }

    const voidId = await generateVoidId();

    // Update transaction status
    transaction.status = 'voided';
    transaction.voidId = voidId;
    transaction.voidReason = voidReason;
    transaction.voidedBy = voidedBy || voidedById;
    transaction.voidedById = voidedById || voidedBy;
    transaction.voidedByName = voidedByName;
    transaction.voidedAt = new Date();
    await transaction.save();

    // Create void log
    await VoidLog.create({
      voidId,
      items: transaction.items.map(item => ({
        productId: item.productId,
        itemName: item.itemName,
        sku: item.sku,
        variant: item.variant,
        selectedSize: item.selectedSize,
        quantity: item.quantity,
        price: item.price,
        itemImage: sanitizeItemImageForStorage(item.itemImage),
        voidReason
      })),
      totalAmount: transaction.totalAmount,
      voidReason,
      voidedBy: voidedBy || voidedById,
      voidedById: voidedById || voidedBy,
      voidedByName,
      voidedAt: new Date(),
      originalTransactionId: transaction._id,
      source: 'transaction'
    });

    // Restore stock for voided items
    for (const item of transaction.items) {
      try {
        const product = await Product.findById(item.productId);
        if (product) {
          if (product.sizes && item.selectedSize) {
            const sizeKey = Object.keys(product.sizes).find(
              key => key.toLowerCase() === item.selectedSize.toLowerCase()
            );
            if (sizeKey) {
              const sizeData = product.sizes[sizeKey];
              if (typeof sizeData === 'object' && sizeData.quantity !== undefined) {
                product.sizes[sizeKey].quantity += item.quantity;
              } else {
                product.sizes[sizeKey] = (sizeData || 0) + item.quantity;
              }
              product.markModified('sizes');
            }
          }
          product.currentStock += item.quantity;
          product.lastUpdated = Date.now();
          await product.save();
        }
      } catch (stockError) {
        console.error('Error restoring stock for item:', item.itemName, stockError);
      }
    }

    res.json({
      success: true,
      message: 'Transaction voided successfully',
      data: transaction
    });
  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to void transaction',
      error: error.message
    });
  }
};

exports.returnItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, returnReason, returnedBy, returnedById, returnedByName } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items to return are required'
      });
    }

    const originalTransaction = await SalesTransaction.findById(id);
    if (!originalTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Original transaction not found'
      });
    }

    // Calculate return amount
    let returnAmount = 0;
    const returnItems = items.map(item => {
      const originalItem = originalTransaction.items.find(
        oi => oi.productId?.toString() === item.productId?.toString() &&
          oi.selectedSize === item.selectedSize
      );

      const price = originalItem?.price || item.price || 0;
      returnAmount += price * item.quantity;

      return {
        productId: item.productId,
        itemName: item.itemName,
        sku: item.sku,
        variant: item.variant,
        selectedSize: item.selectedSize,
        quantity: item.quantity,
        price,
        itemImage: sanitizeItemImageForStorage(item.itemImage),
        returnReason: item.returnReason || returnReason
      };
    });

    const receiptNo = await generateRandomReceiptNumber();
    const processorIdFromAuth = req.user?._id || req.user?.id || '';
    const safeProcessorId =
      String(returnedById || processorIdFromAuth || originalTransaction.performedById || originalTransaction.userId || '').trim();
    const safeProcessorName =
      String(
        returnedByName ||
        req.user?.name ||
        `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() ||
        originalTransaction.performedByName ||
        ''
      ).trim();

    // Create return transaction
    const returnTransaction = await SalesTransaction.create({
      userId: safeProcessorId || String(originalTransaction.userId || 'guest'),
      performedById: safeProcessorId,
      performedByName: safeProcessorName,
      receiptNo,
      items: returnItems,
      subtotal: -returnAmount,
      discount: 0,
      totalAmount: -returnAmount,
      paymentMethod: 'return',
      amountPaid: 0,
      change: returnAmount,
      cashierName: safeProcessorName,
      cashierId: safeProcessorId,
      status: 'Completed',
      originalTransactionId: originalTransaction._id,
      returnReason,
      returnedBy: returnedBy || safeProcessorId,
      returnedById: safeProcessorId,
      returnedByName: safeProcessorName
    });

    // Update original transaction
    originalTransaction.hasReturns = true;
    originalTransaction.returnTransactionIds = originalTransaction.returnTransactionIds || [];
    originalTransaction.returnTransactionIds.push(returnTransaction._id);
    await originalTransaction.save();

    // Restore stock only for sellable returns (wrong item, wrong size, etc.)
    for (const item of returnItems) {
      const rr = item.returnReason || returnReason;
      if (isArchiveReturnReason(rr)) {
        continue;
      }
      try {
        const product = await Product.findById(item.productId);
        if (product) {
          if (product.sizes && item.selectedSize) {
            const sizeKey = Object.keys(product.sizes).find(
              key => key.toLowerCase() === item.selectedSize.toLowerCase()
            );
            if (sizeKey) {
              const sizeData = product.sizes[sizeKey];
              if (typeof sizeData === 'object' && sizeData.quantity !== undefined) {
                product.sizes[sizeKey].quantity += item.quantity;
              } else {
                product.sizes[sizeKey] = (sizeData || 0) + item.quantity;
              }
              product.markModified('sizes');
            }
          }
          product.currentStock += item.quantity;
          product.lastUpdated = Date.now();
          await product.save();
        }
      } catch (stockError) {
        console.error('Error restoring stock for returned item:', item.itemName, stockError);
      }
    }

    res.json({
      success: true,
      message: 'Items returned successfully',
      data: {
        returnTransaction,
        originalTransaction,
        returnAmount
      }
    });
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process return',
      error: error.message
    });
  }
};

exports.getTransactionStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Keep consistent with the rest of the app: ignore voided + returns/void rows.
    const query = {
      status: { $nin: ['Voided', 'voided'] },
      paymentMethod: { $nin: ['return', 'void'] },
    };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [totalTransactions, totalSales, byPaymentMethod] = await Promise.all([
      SalesTransaction.countDocuments(query),
      SalesTransaction.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      SalesTransaction.aggregate([
        { $match: query },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 }, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalTransactions,
        totalSales: totalSales[0]?.total || 0,
        byPaymentMethod: byPaymentMethod.reduce((acc, item) => {
          acc[item._id] = { count: item.count, total: item.total };
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction statistics',
      error: error.message
    });
  }
};

// Get dashboard stats (sales, transactions, profit, low stock) with timeframe support
// OPTIMIZED: Uses MongoDB aggregation pipelines instead of fetching all docs into memory
exports.getDashboardStats = async (req, res) => {
  try {
    const { timeframe = 'daily', startDate: customStartDate, endDate: customEndDate } = req.query;
    const now = new Date();

    // Helper to get date range
    const getDateRange = (tf, date = new Date()) => {
      let start, end;
      const d = new Date(date);

      if (tf.toLowerCase() === 'custom' && customStartDate && customEndDate) {
        start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return { start, end };
      }

      switch (tf.toLowerCase()) {
        case 'daily':
          start = new Date(d);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 1);
          break;
        case 'weekly':
          start = new Date(d);
          const day = start.getDay();
          start.setDate(start.getDate() - day);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 7);
          break;
        case 'monthly':
          start = new Date(d.getFullYear(), d.getMonth(), 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          break;
        case 'yearly':
          start = new Date(d.getFullYear(), 0, 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(d.getFullYear() + 1, 0, 1);
          break;
        default:
          start = new Date(d);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 1);
      }
      return { start, end };
    };

    // Current period
    const current = getDateRange(timeframe, now);

    // Previous period (for growth rate)
    let previousDate = new Date(now);
    let previous = { start: new Date(), end: new Date() };

    if (timeframe.toLowerCase() === 'custom' && customStartDate && customEndDate) {
      const duration = current.end.getTime() - current.start.getTime();
      const previousEnd = new Date(current.start.getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - duration);
      previous = { start: previousStart, end: previousEnd };
    } else {
      if (timeframe === 'daily') previousDate.setDate(previousDate.getDate() - 1);
      else if (timeframe === 'weekly') previousDate.setDate(previousDate.getDate() - 7);
      else if (timeframe === 'monthly') previousDate.setMonth(previousDate.getMonth() - 1);
      else if (timeframe === 'yearly') previousDate.setFullYear(previousDate.getFullYear() - 1);
      previous = getDateRange(timeframe, previousDate);
    }

    // Build match filter for non-voided, non-return transactions in a date range
    const buildMatchFilter = (start, end) => ({
      $or: [
        { checkedOutAt: { $gte: start, $lte: end } },
        { checkedOutAt: { $exists: false }, createdAt: { $gte: start, $lte: end } }
      ],
      status: { $nin: ['Voided', 'voided'] },
      paymentMethod: { $nin: ['return', 'void'] }
    });

    // Aggregation pipeline: compute totalSales, count, and profit in one query
    const getStatsAggregation = (start, end) => {
      return SalesTransaction.aggregate([
        { $match: buildMatchFilter(start, end) },
        // Compute total sales and count at transaction level
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalSales: { $sum: { $ifNull: ['$totalAmount', 0] } },
                  totalTransactions: { $sum: 1 }
                }
              }
            ],
            profit: [
              { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
              {
                $lookup: {
                  from: 'products',
                  localField: 'items.productId',
                  foreignField: '_id',
                  as: 'productInfo',
                  pipeline: [{ $project: { costPrice: 1, sizes: 1 } }]
                }
              },
              { $unwind: { path: '$productInfo', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  // Fast path: use O(1) field access instead of $objectToArray/$filter (very expensive at scale).
                  sizeData: {
                    $cond: [
                      { $and: [{ $ne: ['$items.selectedSize', null] }, { $ne: ['$items.selectedSize', ''] }] },
                      {
                        $getField: {
                          field: '$items.selectedSize',
                          input: { $ifNull: ['$productInfo.sizes', {}] },
                        },
                      },
                      null,
                    ],
                  },
                  variantData: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$items.variant', null] },
                          { $ne: ['$items.variant', ''] },
                          { $ne: ['$sizeData', null] },
                        ],
                      },
                      {
                        $getField: {
                          field: '$items.variant',
                          input: { $ifNull: ['$sizeData.variants', {}] },
                        },
                      },
                      null,
                    ],
                  },
                  itemCostPrice: {
                    $ifNull: [
                      { $ifNull: ['$variantData.costPrice', '$sizeData.costPrice'] },
                      { $ifNull: ['$productInfo.costPrice', 0] },
                    ],
                  },
                }
              },
              {
                $addFields: {
                  effectiveSoldQty: {
                    $cond: [
                      { $eq: ['$items.returnStatus', 'Returned'] },
                      0,
                      { $ifNull: ['$items.quantity', 1] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  totalProfit: {
                    $sum: {
                      $multiply: [
                        { $subtract: [{ $ifNull: ['$items.price', 0] }, '$itemCostPrice'] },
                        '$effectiveSoldQty'
                      ]
                    }
                  }
                }
              }
            ]
          }
        }
      ]);
    };

    // Run current + previous period aggregations AND low stock count in parallel
    const [currentResult, previousResult, lowStockCountResult] = await Promise.all([
      getStatsAggregation(current.start, current.end),
      getStatsAggregation(previous.start, previous.end),
      Product.aggregate([
        {
          $match: {
            isArchived: { $ne: true },
            $expr: {
              $lte: ['$currentStock', { $max: [{ $ifNull: ['$reorderNumber', 0] }, 10] }]
            }
          }
        },
        { $count: 'count' }
      ])
    ]);

    // Extract current period results
    const currentSummary = currentResult[0]?.summary[0] || {};
    const currentProfit = currentResult[0]?.profit[0] || {};
    const totalSalesToday = currentSummary.totalSales || 0;
    const totalTransactions = currentSummary.totalTransactions || 0;
    const profit = currentProfit.totalProfit || 0;

    // Extract previous period results
    const previousSummary = previousResult[0]?.summary[0] || {};
    const totalSalesPrevious = previousSummary.totalSales || 0;
    const totalTransactionsPrevious = previousSummary.totalTransactions || 0;

    // Growth rate
    let growthRate = 0;
    if (totalSalesPrevious > 0) {
      growthRate = ((totalSalesToday - totalSalesPrevious) / totalSalesPrevious) * 100;
    } else if (totalSalesToday > 0) {
      growthRate = 100;
    }

    let transactionGrowthRate = 0;
    if (totalTransactionsPrevious > 0) {
      transactionGrowthRate =
        ((totalTransactions - totalTransactionsPrevious) / totalTransactionsPrevious) * 100;
    } else if (totalTransactions > 0) {
      transactionGrowthRate = 100;
    }

    const lowStockItems = lowStockCountResult.length > 0 ? lowStockCountResult[0].count : 0;

    res.json({
      success: true,
      data: {
        totalSalesToday,
        totalTransactions,
        profit,
        lowStockItems,
        growthRate: parseFloat(growthRate.toFixed(1)),
        totalSalesPrevious,
        totalTransactionsPrevious,
        transactionGrowthRate: parseFloat(transactionGrowthRate.toFixed(1))
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Get sales by category
exports.getSalesByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query; // Optional custom range

    // Default to last 30 days if no range provided, or use logic from design if it implies all time?
    // Design says "Sales By Cactegory" without explicit timeframe selector, usually implies current dashboard timeframe or all time.
    // Let's assume it follows dashboard timeframe if simpler, but for now let's do all time or large window if not specified.
    // Actually, normally specific period. Let's look at getTopSellingProducts.
    // Let's default to 'all time' or 'this month' if not specified.

    let matchStage = {
      status: { $nin: ['Voided', 'voided'] },
      paymentMethod: { $nin: ['return', 'void'] }
    };

    if (startDate && endDate) {
      matchStage.$or = [
        { checkedOutAt: { $gte: new Date(startDate), $lt: new Date(endDate) } },
        { checkedOutAt: { $exists: false }, createdAt: { $gte: new Date(startDate), $lt: new Date(endDate) } }
      ];
    }

    const salesByCategory = await SalesTransaction.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      // Lookup product to get category
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      { $sort: { totalSales: -1 } }
    ]);

    // Format for frontend
    const result = salesByCategory.map(item => ({
      name: item._id || 'Uncategorized',
      value: item.totalSales
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching sales by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales by category',
      error: error.message
    });
  }
};


// Get top selling products based on transaction data
exports.getTopSellingProducts = async (req, res) => {
  try {
    const { sort = 'most', limit = 5, period = 'daily' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate, endDate;

    if (period.toLowerCase() === 'custom' && req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(req.query.endDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      switch (period.toLowerCase()) {
        case 'daily':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          break;
        case 'weekly':
          startDate = new Date(now);
          const dayOfWeek = startDate.getDay();
          startDate.setDate(startDate.getDate() - dayOfWeek);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear(), 0, 1); // Jan 1st of current year
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear() + 1, 0, 1); // Jan 1st of next year
          break;
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
      }
    }

    // Aggregate sales data from completed transactions
    const salesData = await SalesTransaction.aggregate([
      // Only include completed transactions (not voided or returns) within the time period
      {
        $match: {
          status: { $nin: ['Voided', 'voided'] },
          paymentMethod: { $nin: ['return', 'void'] },
          $or: [
            { checkedOutAt: { $gte: startDate, $lt: endDate } },
            { checkedOutAt: { $exists: false }, createdAt: { $gte: startDate, $lt: endDate } }
          ]
        }
      },
      // Unwind items array to get individual product sales
      { $unwind: '$items' },
      // Group by product ID and sum quantities
      {
        $group: {
          _id: '$items.productId',
          itemName: { $first: '$items.itemName' },
          sku: { $first: '$items.sku' },
          itemImage: { $first: '$items.itemImage' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $unwind: {
          path: '$product',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          itemName: { $ifNull: ['$itemName', { $ifNull: ['$product.itemName', 'Unknown Product'] }] },
          sku: { $ifNull: ['$sku', { $ifNull: ['$product.sku', '-'] }] },
          itemImage: { $ifNull: ['$itemImage', { $ifNull: ['$product.itemImage', ''] }] },
          category: { $ifNull: ['$product.category', '-'] },
          totalQuantitySold: 1,
          totalRevenue: 1,
          currentStock: { $ifNull: ['$product.currentStock', 0] }
        }
      },
      // Sort by quantity sold
      { $sort: { totalQuantitySold: sort === 'most' ? -1 : 1 } },
      // Limit results
      { $limit: parseInt(limit) }
    ]);

    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    console.error('Error fetching top selling products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top selling products',
      error: error.message
    });
  }
};


// Get sales over time data for charts
// Uses the same logic as getDashboardStats for consistency
// Get sales over time data for charts (updated for composed chart)
exports.getSalesOverTime = async (req, res) => {
  try {
    const { timeframe = 'daily', startDate: customStartDate, endDate: customEndDate } = req.query;

    let limit;
    let periodType = timeframe.toLowerCase();

    // Determine period type and limit for custom range
    if (periodType === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 31) {
        periodType = 'daily-custom';
        limit = diffDays;
      } else if (diffDays <= 180) { // Approx 6 months
        periodType = 'weekly-custom';
        limit = Math.ceil(diffDays / 7);
      } else {
        periodType = 'monthly-custom';
        limit = Math.ceil(diffDays / 30);
      }
    } else {
      switch (periodType) {
        case 'daily': limit = 7; break;
        case 'weekly': limit = 12; break; // 12 weeks
        case 'monthly': limit = 6; break; // 6 months
        case 'yearly': limit = 5; break; // 5 years
        default: limit = 7;
      }
    }

    // Generate date ranges for each period
    const periods = [];
    const now = new Date();

    if (periodType.includes('custom')) {
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);

      for (let i = limit - 1; i >= 0; i--) {
        let startDate, endDate, label;

        if (periodType === 'daily-custom') {
          startDate = new Date(end);
          startDate.setDate(startDate.getDate() - i);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          label = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (periodType === 'weekly-custom') {
          startDate = new Date(end);
          startDate.setDate(startDate.getDate() - (i * 7));
          // Adjust to start of week if needed, but for custom range just rolling back 7 days is fine for trend
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          label = `Week of ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        } else { // monthly-custom
          startDate = new Date(end);
          startDate.setMonth(startDate.getMonth() - i);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + 1);
          label = startDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
        periods.push({ startDate, endDate, label });
      }

    } else {
      // Standard logic
      for (let i = limit - 1; i >= 0; i--) {
        let startDate, endDate, label;

        if (timeframe.toLowerCase() === 'daily') {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - i);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 1);
          label = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else if (timeframe.toLowerCase() === 'weekly') {
          startDate = new Date(now);
          const dayOfWeek = startDate.getDay();
          startDate.setDate(startDate.getDate() - dayOfWeek - (i * 7));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 7);
          label = `Week ${startDate.getDate()}`; // Simplified label
        } else if (timeframe.toLowerCase() === 'monthly') {
          startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
          label = startDate.toLocaleDateString('en-US', { month: 'short' });
        } else { // yearly
          // Show last 5 rolling years matching the dashboard stats logic (kind of)
          // But for chart, we want 5 distinct points.
          // Let's do: This year, Last year, etc.
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - i);
          startDate.setMonth(0, 1); // Jan 1st of that year
          startDate.setHours(0, 0, 0, 0);

          endDate = new Date(startDate);
          endDate.setFullYear(endDate.getFullYear() + 1); // Jan 1st of next year

          label = startDate.getFullYear().toString();
        }

        periods.push({ startDate, endDate, label });
      }
    }

    // Aggregate revenue in MongoDB (fast at scale), then map into the same UI periods.
    const globalStart = periods[0].startDate;
    const globalEnd = periods[periods.length - 1].endDate;

    const unit =
      periodType.startsWith('daily') ? 'day' :
        periodType.startsWith('weekly') ? 'week' :
          periodType.startsWith('monthly') ? 'month' :
            'year';

    const agg = await SalesTransaction.aggregate([
      {
        $addFields: {
          txDate: { $ifNull: ['$checkedOutAt', '$createdAt'] },
        },
      },
      {
        $match: {
          txDate: { $gte: globalStart, $lt: globalEnd },
          status: { $nin: ['Voided', 'voided'] },
          paymentMethod: { $nin: ['return', 'void'] },
        },
      },
      {
        $group: {
          _id: { $dateTrunc: { date: '$txDate', unit } },
          revenue: { $sum: { $ifNull: ['$totalAmount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const revenueByBucketIso = new Map(
      agg.map((r) => [new Date(r._id).toISOString(), r.revenue || 0]),
    );

    const rawSalesData = periods.map(({ startDate, label }) => {
      const bucket = new Date(startDate);
      // Ensure same truncation boundary as $dateTrunc.
      if (unit === 'day') {
        bucket.setHours(0, 0, 0, 0);
      } else if (unit === 'month') {
        bucket.setDate(1);
        bucket.setHours(0, 0, 0, 0);
      } else if (unit === 'year') {
        bucket.setMonth(0, 1);
        bucket.setHours(0, 0, 0, 0);
      } else {
        // week: align to Sunday (to match earlier UI logic)
        const dow = bucket.getDay();
        bucket.setDate(bucket.getDate() - dow);
        bucket.setHours(0, 0, 0, 0);
      }
      const key = bucket.toISOString();
      return { period: label, revenue: revenueByBucketIso.get(key) || 0 };
    });

    // Post-process to calculate growth and add target
    const maxRevenue = Math.max(...rawSalesData.map(item => item.revenue || 0));
    const dynamicTarget = maxRevenue > 0 ? maxRevenue : 10000;

    const salesData = rawSalesData.map((item, index) => {
      let growth = 0;
      if (index > 0) {
        const prevRevenue = rawSalesData[index - 1].revenue;
        if (prevRevenue > 0) {
          growth = ((item.revenue - prevRevenue) / prevRevenue) * 100;
        } else if (item.revenue > 0) {
          growth = 100;
        }
      }

      return {
        ...item,
        target: Math.round(dynamicTarget),
        growth: Math.round(growth)
      };
    });

    // If we only have 1 data point or first point has no prev, growth is 0. 
    // To make chart look nice, maybe mock growth for first point or leave 0.

    res.json({
      success: true,
      data: salesData
    });
  } catch (error) {
    console.error('Error fetching sales over time:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sales over time',
      error: error.message
    });
  }
};


