const mongoose = require('mongoose');

const archiveItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    trim: true
  },
  variant: {
    type: String,
    default: '',
    trim: true
  },
  selectedSize: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Tops', 'Bottoms', 'Dresses', 'Makeup', 'Accessories', 'Shoes', 'Head Wear', 'Foods', 'Others']
  },
  brandName: {
    type: String,
    default: '',
    trim: true
  },
  itemPrice: {
    type: Number,
    required: true,
    min: 0
  },
  costPrice: {
    type: Number,
    default: 0,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  itemImage: {
    type: String,
    default: ''
  },
  reason: {
    type: String,
    required: true,
    enum: ['Damaged', 'Defective', 'Expired', 'Other']
  },
  returnReason: {
    type: String,
    default: ''
  },
  originalTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesTransaction',
    default: null
  },
  source: {
    type: String,
    enum: ['return', 'stock-out'],
    default: 'return'
  },
  returnTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesTransaction',
    default: null
  },
  archivedBy: {
    type: String,
    required: true
  },
  archivedById: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  archivedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
archiveItemSchema.index({ archivedAt: -1 });
archiveItemSchema.index({ productId: 1 });
archiveItemSchema.index({ originalTransactionId: 1 });
archiveItemSchema.index({ sku: 1 });

// Export schema for dynamic connection
module.exports.schema = archiveItemSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Archive', archiveItemSchema);



