const VoidLog = require('../models/VoidLog');

// Generate a unique void ID
const generateVoidId = async () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let voidId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    voidId = 'VOID-';
    for (let i = 0; i < 6; i++) {
      voidId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Check if voidId already exists
    const existing = await VoidLog.findOne({ voidId });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }
  
  // If still not unique after max attempts, append timestamp
  if (!isUnique) {
    const timestamp = Date.now().toString().slice(-4);
    voidId = `VOID-${timestamp}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
  }
  
  return voidId;
};

// Create a new void log entry
exports.createVoidLog = async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      voidReason,
      voidedBy,
      voidedById,
      voidedByName,
      approvedBy,
      approvedByRole,
      originalTransactionId,
      source,
      userId,
      notes
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    if (!totalAmount || !voidReason || !voidedByName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: totalAmount, voidReason, voidedByName'
      });
    }

    // Generate unique void ID
    const voidId = await generateVoidId();

    const voidLogData = {
      voidId,
      items: items.map(item => ({
        productId: item.productId || item._id,
        itemName: item.itemName,
        sku: item.sku,
        variant: item.variant || item.selectedVariation || null,
        selectedSize: item.selectedSize || item.size || null,
        quantity: item.quantity,
        price: item.itemPrice || item.price || 0,
        itemImage: item.itemImage || '',
        voidReason: item.voidReason || voidReason
      })),
      totalAmount,
      voidReason,
      voidedBy: voidedBy || voidedById || '',
      voidedById: voidedById || voidedBy || '',
      voidedByName,
      approvedBy: approvedBy || null,
      approvedByRole: approvedByRole || null,
      voidedAt: new Date(),
      originalTransactionId: originalTransactionId || null,
      source: source || 'cart',
      userId: userId || null,
      notes: notes || ''
    };

    const voidLog = await VoidLog.create(voidLogData);

    res.json({
      success: true,
      message: 'Void log created successfully',
      data: voidLog
    });
  } catch (error) {
    console.error('Error creating void log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create void log',
      error: error.message
    });
  }
};

// Get all void logs with optional filters
exports.getVoidLogs = async (req, res) => {
  try {
    const {
      search,
      voidedBy,
      source,
      startDate,
      endDate,
      limit = 1000,
      page = 1,
      sortBy = 'voidedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { voidId: { $regex: search, $options: 'i' } },
        { 'items.itemName': { $regex: search, $options: 'i' } },
        { 'items.sku': { $regex: search, $options: 'i' } },
        { voidedByName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (voidedBy) {
      query.voidedById = voidedBy;
    }
    
    if (source) {
      query.source = source;
    }
    
    if (startDate || endDate) {
      query.voidedAt = {};
      if (startDate) {
        query.voidedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.voidedAt.$lte = new Date(endDate);
      }
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    
    // Execute query
    const [voidLogs, total] = await Promise.all([
      VoidLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      VoidLog.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: voidLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching void logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch void logs',
      error: error.message
    });
  }
};

// Get a single void log by ID
exports.getVoidLogById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const voidLog = await VoidLog.findOne({ 
      $or: [
        { _id: id },
        { voidId: id }
      ]
    }).lean();
    
    if (!voidLog) {
      return res.status(404).json({
        success: false,
        message: 'Void log not found'
      });
    }
    
    res.json({
      success: true,
      data: voidLog
    });
  } catch (error) {
    console.error('Error fetching void log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch void log',
      error: error.message
    });
  }
};

// Get void log statistics
exports.getVoidLogStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate || endDate) {
      query.voidedAt = {};
      if (startDate) {
        query.voidedAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.voidedAt.$lte = new Date(endDate);
      }
    }
    
    const [totalVoids, totalAmount, byReason, bySource] = await Promise.all([
      VoidLog.countDocuments(query),
      VoidLog.aggregate([
        { $match: query },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      VoidLog.aggregate([
        { $match: query },
        { $group: { _id: '$voidReason', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      VoidLog.aggregate([
        { $match: query },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ])
    ]);
    
    res.json({
      success: true,
      data: {
        totalVoids,
        totalAmount: totalAmount[0]?.total || 0,
        byReason: byReason.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bySource: bySource.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching void log stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch void log statistics',
      error: error.message
    });
  }
};
