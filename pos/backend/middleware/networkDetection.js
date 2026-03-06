const dbManager = require('../config/databaseManager');
const mongoose = require('mongoose');

// Middleware to check database connection status
const networkDetection = async (req, res, next) => {
  try {
    // Check if mongoose connection is available
    if (mongoose.connection.readyState !== 1) {
      try {
        await dbManager.connect();
      } catch (error) {
        return res.status(503).json({
          success: false,
          message: 'Database connection unavailable',
          error: error.message
        });
      }
    }
    
    // Attach status to request
    req.dbManager = dbManager;
    
    next();
  } catch (error) {
    console.error('Database check error:', error);
    next();
  }
};

module.exports = networkDetection;
