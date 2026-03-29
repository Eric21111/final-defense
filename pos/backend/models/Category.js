const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['category', 'subcategory'],
    default: 'category',
    index: true
  },
  parentCategory: {
    type: String,
    default: null,
    trim: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  showOnPos: {
    type: Boolean,
    default: true
  },
  dateCreated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for faster queries
categorySchema.index({ status: 1 });
categorySchema.index({ name: 1 });
categorySchema.index({ type: 1, parentCategory: 1, status: 1 });
categorySchema.index({ dateCreated: -1 });
categorySchema.index({ name: 1, type: 1, parentCategory: 1 }, { unique: true });

// Export schema for dynamic connection
module.exports.schema = categorySchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Category', categorySchema);

