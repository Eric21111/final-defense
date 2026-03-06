const mongoose = require('mongoose');
const Cart = require('../models/Cart');

exports.getCartByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const cart = await Cart.findOne({ userId }).lean();

    res.json({
      success: true,
      data: cart || { userId, items: [] }
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart',
      error: error.message
    });
  }
};

exports.saveCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { items } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array'
      });
    }

    const sanitizedItems = items.map((item) => ({
      productId: item._id || item.productId,
      itemName: item.itemName || '',
      sku: item.sku || '',
      itemPrice: item.itemPrice || 0,
      quantity: item.quantity || 1,
      selectedSize: item.selectedSize || '',
      variant: item.variant || '',
      itemImage: item.itemImage || ''
    }));

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { items: sanitizedItems },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      success: true,
      message: 'Cart saved successfully',
      data: cart
    });
  } catch (error) {
    console.error('Error saving cart:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save cart',
      error: error.message
    });
  }
};
