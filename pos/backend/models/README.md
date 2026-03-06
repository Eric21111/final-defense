# Models Directory

This directory contains Mongoose schemas and models for the POS system.

## Example Model Structure

```javascript
const mongoose = require('mongoose');

const exampleSchema = new mongoose.Schema({
  field1: {
    type: String,
    required: true
  },
  field2: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Example', exampleSchema);
```

