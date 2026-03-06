const mongoose = require('mongoose');

const voidedItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  itemName: {
    type: String,
    required: true
  },
  sku: {
    type: String,
    required: true
  },
  variant: {
    type: String,
    default: null
  },
  selectedSize: {
    type: String,
    default: null
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  itemImage: {
    type: String,
    default: ''
  },
  voidReason: {
    type: String,
    required: true
  }
}, { _id: false });

const voidLogSchema = new mongoose.Schema({
  voidId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  items: {
    type: [voidedItemSchema],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  voidReason: {
    type: String,
    required: true,
    enum: ['Customer cancellation', 'Wrong transaction', 'System error', 'Payment issue', 'Other']
  },
  voidedBy: {
    type: String,
    required: true
  },
  voidedById: {
    type: String,
    default: ''
  },
  voidedByName: {
    type: String,
    required: true
  },
  approvedBy: {
    type: String,
    default: null
  },
  approvedByRole: {
    type: String,
    enum: ['Owner', 'Manager', null],
    default: null
  },
  voidedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  originalTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalesTransaction',
    default: null
  },
  source: {
    type: String,
    enum: ['cart', 'transaction'],
    default: 'cart'
  },
  userId: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for faster queries
voidLogSchema.index({ voidedAt: -1 }); // Most common sort - newest first
voidLogSchema.index({ voidId: 1 }); // Unique index already created above
voidLogSchema.index({ voidedBy: 1 });
voidLogSchema.index({ voidedById: 1 });
voidLogSchema.index({ originalTransactionId: 1 });
voidLogSchema.index({ source: 1 });
voidLogSchema.index({ createdAt: -1 });

// Export schema for dynamic connection
module.exports.schema = voidLogSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('VoidLog', voidLogSchema);


