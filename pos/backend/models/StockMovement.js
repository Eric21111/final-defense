const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  sku: {
    type: String,
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  itemImage: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true
  },
  brandName: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['Stock-In', 'Stock-Out', 'Pull-Out'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  stockBefore: {
    type: Number,
    required: true
  },
  stockAfter: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['Restock', 'Sold', 'Returned Item', 'Return', 'Exchange', 'Damaged', 'Lost', 'Expired', 'Adjustment', 'Initial Stock', 'Other']
  },
  handledBy: {
    type: String,
    required: true
  },
  handledById: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  sizeQuantities: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for faster queries
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ productId: 1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ category: 1 });
stockMovementSchema.index({ sku: 1 });
stockMovementSchema.index({ handledById: 1 });
stockMovementSchema.index({ reason: 1 });

// Export schema for dynamic connection
module.exports.schema = stockMovementSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('StockMovement', stockMovementSchema);

