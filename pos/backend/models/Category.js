const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
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
categorySchema.index({ dateCreated: -1 });

// Export schema for dynamic connection
module.exports.schema = categorySchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Category', categorySchema);

