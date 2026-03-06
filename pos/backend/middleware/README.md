# Middleware Directory

This directory contains custom middleware functions for the POS system.

## Example Middleware

```javascript
const authMiddleware = (req, res, next) => {
 
  next();
};

module.exports = authMiddleware;
```

