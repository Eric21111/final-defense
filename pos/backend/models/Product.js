const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Tops', 'Bottoms', 'Dresses', 'Makeup', 'Accessories', 'Shoes', 'Head Wear', 'Foods']
  },
  brandName: {
    type: String,
    default: '',
    trim: true
  },
  variant: {
    type: String,
    default: '',
    trim: true
  },
  foodSubtype: {
    type: String,
    default: '',
    trim: true
  },
  size: {
    type: String,
    default: '',
    trim: true
  },
  sizes: {
    type: mongoose.Schema.Types.Mixed,
    default: null
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
  currentStock: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  reorderNumber: {
    type: Number,
    default: 0,
    min: 0
  },
  expirationDate: {
    type: Date,
    default: null
  },
  supplierName: {
    type: String,
    default: '',
    trim: true
  },
  supplierContact: {
    type: String,
    default: '',
    trim: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  itemImage: {
    type: String,
    default: ''
  },
  displayInTerminal: {
    type: Boolean,
    default: true
  },
  discountIds: {
    type: [mongoose.Schema.Types.ObjectId],
    default: [],
    ref: 'Discount'
  }
}, {
  timestamps: true
});


productSchema.pre('save', function (next) {
  this.lastUpdated = Date.now();
  next();
});

// Virtual for terminal status (shown/not shown)
productSchema.virtual('terminalStatus').get(function () {
  return this.displayInTerminal !== false ? 'shown' : 'not shown';
});

// Ensure virtuals are included in JSON output
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Indexes for faster queries
productSchema.index({ category: 1 });
productSchema.index({ itemName: 'text', sku: 'text', brandName: 'text' }); // Text search index
productSchema.index({ dateAdded: -1 });
productSchema.index({ currentStock: 1 });
productSchema.index({ lastUpdated: -1 });
productSchema.index({ sku: 1 }); // Already unique, but explicit index helps

// Export schema for dynamic connection
module.exports.schema = productSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Product', productSchema);

