const Discount = require('../models/Discount');

exports.getAllDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find({}).sort({ dateCreated: -1 }).lean();
    
    const formattedDiscounts = discounts.map(discount => {
      const discountValue = discount.discountType === 'percentage' 
        ? `${discount.discountValue}% OFF`
        : `₱${discount.discountValue} OFF`;

      const appliesToText = discount.appliesTo === 'all' 
        ? 'All Products'
        : discount.appliesTo === 'category'
        ? `Category: ${discount.category}`
        : 'Specific Products';

      return {
        ...discount,
        _id: discount._id.toString(),
        discountValue: discountValue,
        appliesTo: appliesToText,
        appliesToType: discount.appliesTo,
        usage: discount.usageLimit 
          ? { used: discount.usageCount || 0, total: discount.usageLimit }
          : null,
        validFrom: discount.noExpiration ? 'Permanent' : (discount.validFrom ? new Date(discount.validFrom).toISOString().split('T')[0] : null),
        validTo: discount.noExpiration ? null : (discount.validTo ? new Date(discount.validTo).toISOString().split('T')[0] : null)
      };
    });
    
    res.json({
      success: true,
      count: formattedDiscounts.length,
      data: formattedDiscounts
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching discounts',
      error: error.message
    });
  }
};

exports.getDiscountById = async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id).lean();
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    res.json({
      success: true,
      data: discount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching discount',
      error: error.message
    });
  }
};

exports.createDiscount = async (req, res) => {
  try {
    const discountData = { ...req.body };
    
    if (!discountData.title || !discountData.discountType || discountData.discountValue === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Title, discount type, and discount value are required'
      });
    }
    
    if (!discountData.status) {
      discountData.status = 'active';
    }
    
    const discount = await Discount.create(discountData);
    
    res.status(201).json({
      success: true,
      data: discount
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Discount with this name already exists'
      });
    }
    console.error('Error creating discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating discount',
      error: error.message
    });
  }
};

exports.updateDiscount = async (req, res) => {
  try {
    const updateData = { ...req.body };
    updateData.lastUpdated = Date.now();
    
    const discount = await Discount.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.json({
      success: true,
      data: discount
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Discount with this name already exists'
      });
    }
    console.error('Error updating discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating discount',
      error: error.message
    });
  }
};

exports.deleteDiscount = async (req, res) => {
  try {
    const discount = await Discount.findByIdAndDelete(req.params.id);
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting discount',
      error: error.message
    });
  }
};

exports.toggleDiscountStatus = async (req, res) => {
  try {
    const discount = await Discount.findById(req.params.id);
    
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }
    
    const newStatus = discount.status === 'active' ? 'inactive' : 'active';
    
    const updatedDiscount = await Discount.findByIdAndUpdate(
      req.params.id,
      { status: newStatus, lastUpdated: Date.now() },
      { new: true }
    );
    
    res.json({
      success: true,
      data: updatedDiscount
    });
  } catch (error) {
    console.error('Error toggling discount status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling discount status',
      error: error.message
    });
  }
};

exports.getActiveDiscounts = async (req, res) => {
  try {
    const now = new Date();
    
    const discounts = await Discount.find({
      status: 'active',
      $or: [
        { noExpiration: true },
        { validFrom: { $lte: now }, validTo: { $gte: now } }
      ]
    }).lean();
    
    res.json({
      success: true,
      count: discounts.length,
      data: discounts
    });
  } catch (error) {
    console.error('Error fetching active discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active discounts',
      error: error.message
    });
  }
};
