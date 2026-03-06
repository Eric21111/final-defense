const mongoose = require('mongoose');

const brandPartnerSchema = new mongoose.Schema(
  {
    brandName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    contactNumber: {
      type: String,
      trim: true,
      default: '',
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

brandPartnerSchema.index({ brandName: 1 }, { unique: true });

// Export schema for dynamic connection
module.exports.schema = brandPartnerSchema;

module.exports = mongoose.model('BrandPartner', brandPartnerSchema);






