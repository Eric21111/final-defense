const dbManager = require('../config/databaseManager');

// Factory function to get models for the current connection
const getModel = (modelName, schema) => {
  const connection = dbManager.getConnection();
  if (!connection) {
    throw new Error('No database connection available');
  }
  
  // Return model for current connection, or create if doesn't exist
  if (connection.models[modelName]) {
    return connection.models[modelName];
  }
  
  return connection.model(modelName, schema);
};

// Get model for specific connection (cloud or local)
const getModelForConnection = (connection, modelName, schema) => {
  if (!connection) {
    throw new Error('Connection not provided');
  }
  
  if (connection.models[modelName]) {
    return connection.models[modelName];
  }
  
  return connection.model(modelName, schema);
};

module.exports = {
  getModel,
  getModelForConnection
};

