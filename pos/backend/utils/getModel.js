const mongoose = require('mongoose');

// Helper to get models using the mongoose connection
const getProductModel = () => {
  const ProductModule = require('../models/Product');
  if (mongoose.models.Product) {
    return mongoose.models.Product;
  }
  return mongoose.model('Product', ProductModule.schema);
};

const getStockMovementModel = () => {
  const StockMovementModule = require('../models/StockMovement');
  if (mongoose.models.StockMovement) {
    return mongoose.models.StockMovement;
  }
  return mongoose.model('StockMovement', StockMovementModule.schema);
};

const getEmployeeModel = () => {
  const EmployeeModule = require('../models/Employee');
  if (mongoose.models.Employee) {
    return mongoose.models.Employee;
  }
  return mongoose.model('Employee', EmployeeModule.schema);
};

const getTransactionModel = () => {
  const SalesTransactionModule = require('../models/SalesTransaction');
  if (mongoose.models.SalesTransaction) {
    return mongoose.models.SalesTransaction;
  }
  return mongoose.model('SalesTransaction', SalesTransactionModule.schema);
};

const getCartModel = () => {
  const CartModule = require('../models/Cart');
  if (mongoose.models.Cart) {
    return mongoose.models.Cart;
  }
  return mongoose.model('Cart', CartModule.schema);
};

const getArchiveModel = () => {
  const ArchiveModule = require('../models/Archive');
  if (mongoose.models.Archive) {
    return mongoose.models.Archive;
  }
  return mongoose.model('Archive', ArchiveModule.schema);
};

const getDiscountModel = () => {
  const DiscountModule = require('../models/Discount');
  if (mongoose.models.Discount) {
    return mongoose.models.Discount;
  }
  return mongoose.model('Discount', DiscountModule.schema);
};

const getCategoryModel = () => {
  const CategoryModule = require('../models/Category');
  if (mongoose.models.Category) {
    return mongoose.models.Category;
  }
  return mongoose.model('Category', CategoryModule.schema);
};

// Generic getModel function for any model
const getModel = (modelName) => {
  const modelMap = {
    'Product': getProductModel,
    'StockMovement': getStockMovementModel,
    'Employee': getEmployeeModel,
    'SalesTransaction': getTransactionModel,
    'Cart': getCartModel,
    'Archive': getArchiveModel,
    'Discount': getDiscountModel,
    'Category': getCategoryModel
  };
  
  const getter = modelMap[modelName];
  if (!getter) {
    throw new Error(`Unknown model: ${modelName}`);
  }
  return getter();
};

module.exports = {
  getProductModel,
  getStockMovementModel,
  getEmployeeModel,
  getTransactionModel,
  getCartModel,
  getArchiveModel,
  getDiscountModel,
  getCategoryModel,
  getModel
};
