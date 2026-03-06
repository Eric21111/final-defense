# Controllers Directory

This directory contains controller functions that handle business logic for the POS system.

## Example Controller Structure

```javascript
const Model = require('../models/ModelName');

// @desc    Get all items
// @route   GET /api/items
// @access  Public
exports.getItems = async (req, res) => {
  try {
    const items = await Model.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

