const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  firstName: {
    type: String,
    trim: true,
    required: true
  },
  middleInitial: {
    type: String,
    trim: true,
    default: ''
  },
  lastName: {
    type: String,
    trim: true,
    default: ''
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contactNo: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  role: {
    type: String,
    required: true,
    enum: ['Sales Clerk', 'Manager', 'Cashier', 'Supervisor', 'Owner', 'Stock Manager', 'Subcashier', 'Sub-Cashier'],
    default: 'Sales Clerk'
  },
  pin: {
    type: String,
    required: true
  },
  fastPinHash: { // O(1) instantaneous login lookup
    type: String,
    default: ''
  },
  dateJoined: {
    type: Date,
    default: Date.now
  },
  dateJoinedActual: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  profileImage: {
    type: String,
    default: ''
  },
  profileImagePublicId: {
    type: String,
    default: ''
  },
  // User Access Control Permissions
  permissions: {
    posTerminal: {
      type: Boolean,
      default: true
    },
    inventory: {
      type: Boolean,
      default: false
    },
    viewTransactions: {
      type: Boolean,
      default: true
    },
    generateReports: {
      type: Boolean,
      default: false
    }
  },
  requiresPinReset: {
    type: Boolean,
    default: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  lastActive: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Hash PIN before saving
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) {
    return next();
  }

  try {
    // Validate PIN length before hashing (must be exactly 6 digits)
    if (!/^\d{6}$/.test(this.pin)) {
      const error = new Error('PIN must be exactly 6 digits');
      return next(error);
    }

    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);

    // Also maintain a deterministic HMAC hash for fast exact-match lookup
    const crypto = require('crypto');
    const hmacSecret = process.env.PIN_SECRET || 'fallback-secret-for-pos-pin';
    this.fastPinHash = crypto.createHmac('sha256', hmacSecret).update(this.pin.toString()).digest('hex');

    next();
  } catch (error) {
    next(error);
  }
});

// Ensure name/first/middleInitial/last stay in sync
employeeSchema.pre('validate', function (next) {
  const normalizeMiddleInitial = (mi) => {
    if (mi === undefined || mi === null) return '';
    const t = String(mi).trim();
    if (!t) return '';

    // Allow `A` or `A.` (store as just `A`)
    const match = t.match(/^([A-Za-z])\.?$/);
    if (match) return match[1].toUpperCase();

    // If user typed more than 1 letter, keep only the first alphabetic char.
    const firstAlpha = t.replace(/[^A-Za-z]/g, '').slice(0, 1);
    return firstAlpha ? firstAlpha.toUpperCase() : '';
  };

  // Backward compatibility: if only `name` was modified (legacy UI),
  // parse it into { firstName, middleInitial, lastName }.
  if (this.name && (this.isModified('name') || !this.firstName || !this.lastName)) {
    const parts = this.name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || '';

    let middle = '';
    let last = '';

    if (parts.length === 2) {
      // `First Last`
      last = parts[1] || '';
    } else if (parts.length >= 3) {
      // Prefer `First M Last...` when second token looks like an initial.
      const maybeMiddleNorm = normalizeMiddleInitial(parts[1]);
      if (maybeMiddleNorm) {
        middle = maybeMiddleNorm;
        last = parts.slice(2).join(' ') || '';
      } else {
        // Fallback: treat everything after first as lastName (legacy behavior).
        last = parts.slice(1).join(' ') || '';
      }
    }

    if (!this.firstName || this.isModified('name')) this.firstName = first;
    if (!this.middleInitial || this.isModified('name')) this.middleInitial = middle;
    if (!this.lastName || this.isModified('name')) this.lastName = last;
  }

  // Keep derived `name` synced from { firstName, middleInitial, lastName }.
  if (
    this.isModified('firstName') ||
    this.isModified('middleInitial') ||
    this.isModified('lastName') ||
    !this.name
  ) {
    this.middleInitial = normalizeMiddleInitial(this.middleInitial);

    const nameParts = [this.firstName || '']
      .concat(this.middleInitial ? [this.middleInitial] : [])
      .concat(this.lastName ? [this.lastName] : [])
      .map((p) => String(p).trim())
      .filter(Boolean);

    this.name = nameParts.join(' ').trim();
  }

  next();
});

// Method to compare PIN
employeeSchema.methods.comparePin = async function (candidatePin) {
  if (!this.pin) {
    console.warn('[comparePin] Employee has no PIN field');
    return false;
  }

  // Check if PIN is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (this.pin.startsWith('$2')) {
    // PIN is hashed, use bcrypt.compare
    return await bcrypt.compare(candidatePin, this.pin);
  } else {
    // PIN is stored as plain text — this is a data integrity error.
    // Never allow plaintext comparison; always reject and log a critical warning.
    console.error('[comparePin] CRITICAL: PIN is stored as plain text for employee', this._id, '— rejecting login. Re-hash this PIN immediately.');
    return false;
  }
};

// Indexes for faster queries
employeeSchema.index({ email: 1 }); // Already unique, but explicit index helps
employeeSchema.index({ status: 1 });
employeeSchema.index({ role: 1 });
employeeSchema.index({ dateJoined: -1 });
employeeSchema.index({ firstName: 'text', middleInitial: 'text', lastName: 'text', name: 'text', email: 'text' }); // Text search index
employeeSchema.index({ fastPinHash: 1 }); // Fast login lookup
employeeSchema.index({ isOnline: 1 }); // Online employees dashboard lookup

// Export schema for dynamic connection
module.exports.schema = employeeSchema;

// Export default model for backward compatibility
module.exports = mongoose.model('Employee', employeeSchema);

