const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  discountCode: {
    type: String,
    default: '',
    trim: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
    default: 'percentage'
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  appliesTo: {
    type: String,
    enum: ['all', 'category', 'products'],
    required: true,
    default: 'all'
  },
  category: {
    type: String,
    default: null,
    enum: ['Tops', 'Bottoms', 'Dresses', 'Makeup', 'Accessories', 'Shoes', 'Head Wear', 'Foods', null]
  },
  productIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Product',
    default: []
  },
  validFrom: {
    type: Date,
    default: null
  },
  validTo: {
    type: Date,
    default: null
  },
  noExpiration: {
    type: Boolean,
    default: false
  },
  minPurchaseAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxPurchaseAmount: {
    type: Number,
    default: null,
    min: 0
  },
  usageLimit: {
    type: Number,
    default: null,
    min: 0
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  dateCreated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
discountSchema.index({ status: 1 });
discountSchema.index({ appliesTo: 1 });
discountSchema.index({ category: 1 });
discountSchema.index({ dateCreated: -1 });
discountSchema.index({ discountCode: 1 });

// Export schema for dynamic connection
module.exports.schema = discountSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Discount', discountSchema);

