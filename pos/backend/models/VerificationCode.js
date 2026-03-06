const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  code: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiration
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // TTL index: document automatically deleted after 600 seconds (10 mins)
  }
});

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
