const Archive = require('../models/Archive');

exports.createArchiveItem = async (req, res) => {
  try {
    const archiveData = { ...req.body };

    // Validate required fields based on the Archive model schema
    if (!archiveData.productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    // For return source, originalTransactionId is required
    if (archiveData.source === 'return' && !archiveData.originalTransactionId) {
      return res.status(400).json({
        success: false,
        message: 'Original transaction ID is required for returns'
      });
    }

    if (!archiveData.itemName || !archiveData.sku) {
      return res.status(400).json({
        success: false,
        message: 'Item name and SKU are required'
      });
    }

    if (!archiveData.reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required'
      });
    }

    if (!archiveData.archivedBy) {
      archiveData.archivedBy = 'System';
    }

    // Set default source if not provided
    if (!archiveData.source) {
      archiveData.source = archiveData.originalTransactionId ? 'return' : 'stock-out';
    }

    const archiveItem = await Archive.create(archiveData);

    res.status(201).json({
      success: true,
      message: 'Item archived successfully',
      data: archiveItem
    });
  } catch (error) {
    console.error('Error archiving item:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving item',
      error: error.message
    });
  }
};

exports.getAllArchiveItems = async (req, res) => {
  try {
    const {
      search = '',
      itemType,
      category,
      sortBy = 'date-desc',
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { 'itemData.itemName': { $regex: search, $options: 'i' } },
        { 'itemData.sku': { $regex: search, $options: 'i' } }
      ];
    }

    if (itemType && itemType !== 'All') {
      query.itemType = itemType;
    }

    if (category && category !== 'All') {
      query['itemData.category'] = category;
    }


    let sort = { archivedAt: -1 };
    switch (sortBy) {
      case 'date-asc':
        sort = { archivedAt: 1 };
        break;
      case 'name-asc':
        sort = { 'itemData.itemName': 1 };
        break;
      case 'name-desc':
        sort = { 'itemData.itemName': -1 };
        break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [archiveItems, total] = await Promise.all([
      Archive.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Archive.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: archiveItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching archive items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching archive items',
      error: error.message
    });
  }
};

exports.getArchiveItemById = async (req, res) => {
  try {
    const archiveItem = await Archive.findById(req.params.id).lean();

    if (!archiveItem) {
      return res.status(404).json({
        success: false,
        message: 'Archive item not found'
      });
    }

    res.json({
      success: true,
      data: archiveItem
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching archive item',
      error: error.message
    });
  }
};

exports.deleteArchiveItem = async (req, res) => {
  try {
    const archiveItem = await Archive.findByIdAndDelete(req.params.id);

    if (!archiveItem) {
      return res.status(404).json({
        success: false,
        message: 'Archive item not found'
      });
    }

    res.json({
      success: true,
      message: 'Archive item deleted permanently'
    });
  } catch (error) {
    console.error('Error deleting archive item:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting archive item',
      error: error.message
    });
  }
};

exports.deleteAllArchiveItems = async (req, res) => {
  try {
    await Archive.deleteMany({});
    res.json({
      success: true,
      message: 'All archive items deleted permanently'
    });
  } catch (error) {
    console.error('Error deleting all archive items:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting all archive items',
      error: error.message
    });
  }
};

exports.restoreArchiveItem = async (req, res) => {
  try {
    const archiveItem = await Archive.findById(req.params.id);

    if (!archiveItem) {
      return res.status(404).json({
        success: false,
        message: 'Archive item not found'
      });
    }


    res.json({
      success: true,
      message: 'Item data retrieved for restoration',
      data: archiveItem.itemData
    });
  } catch (error) {
    console.error('Error restoring archive item:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring archive item',
      error: error.message
    });
  }
};
