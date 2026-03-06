const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true
  },
  itemName: String,
  sku: String,
  itemPrice: Number,
  quantity: {
    type: Number,
    default: 1
  },
  selectedSize: String,
  variant: String,
  itemImage: String
}, { _id: false });

const cartSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  items: {
    type: [cartItemSchema],
    default: []
  }
}, {
  timestamps: true
});

// Indexes for faster queries
// Note: userId index is automatically created by unique: true, no need to duplicate
cartSchema.index({ updatedAt: -1 });

// Export schema for dynamic connection
module.exports.schema = cartSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Cart', cartSchema);

