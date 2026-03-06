# Routes Directory

This directory contains Express route definitions for the POS system API.

## Example Route Structure

```javascript
const express = require('express');
const router = express.Router();

// GET all items
router.get('/', async (req, res) => {
  // Controller logic here
});

// POST create item
router.post('/', async (req, res) => {
  // Controller logic here
});

module.exports = router;
```

