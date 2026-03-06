const Category = require('../models/Category');
const Product = require('../models/Product');

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ dateCreated: -1 }).lean();
    
    // Get product counts for each category
    const productCounts = {};
    
    try {
      const products = await Product.find({}).lean();
      products.forEach(product => {
        if (product.category) {
          productCounts[product.category] = (productCounts[product.category] || 0) + 1;
        }
      });
    } catch (error) {
      console.warn('Error fetching product counts:', error.message);
    }
    
    // Format categories with product counts
    const formattedCategories = categories.map(category => ({
      ...category,
      _id: category._id.toString(),
      productCount: productCounts[category.name] || 0
    }));
    
    res.json({
      success: true,
      count: formattedCategories.length,
      data: formattedCategories
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      error: error.message
    });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Get product count for this category
    const productCount = await Product.countDocuments({ category: category.name });
    category.productCount = productCount;
    
    res.json({
      success: true,
      data: category
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching category',
      error: error.message
    });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const categoryData = { ...req.body };
    
    // Validate required fields
    if (!categoryData.name) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    // Set default status if not provided
    if (!categoryData.status) {
      categoryData.status = 'active';
    }
    
    const savedCategory = await Category.create(categoryData);
    
    res.status(201).json({
      success: true,
      data: savedCategory
    });
  } catch (error) {
    // Check if it's a duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating category',
      error: error.message
    });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const updateData = { ...req.body };
    
    updateData.lastUpdated = Date.now();
    
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId, 
      updateData, 
      { new: true }
    ).lean();
    
    if (!updatedCategory) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Get product count
    const productCount = await Product.countDocuments({ category: updatedCategory.name });
    updatedCategory.productCount = productCount;
    
    res.json({
      success: true,
      data: updatedCategory
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating category',
      error: error.message
    });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    
    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    // Check if category has products
    const productCount = await Product.countDocuments({ category: category.name });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. There are ${productCount} products in this category. Please reassign or delete products first.`
      });
    }
    
    await Category.findByIdAndDelete(categoryId);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting category',
      error: error.message
    });
  }
};

// Archive/Unarchive category (toggle status)
exports.archiveCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const category = await Category.findById(categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }
    
    const newStatus = category.status === 'active' ? 'inactive' : 'active';
    
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { status: newStatus, lastUpdated: Date.now() },
      { new: true }
    ).lean();
    
    // Get product count
    const productCount = await Product.countDocuments({ category: updatedCategory.name });
    updatedCategory.productCount = productCount;
    
    res.json({
      success: true,
      data: updatedCategory
    });
  } catch (error) {
    console.error('Error archiving category:', error);
    res.status(500).json({
      success: false,
      message: 'Error archiving category',
      error: error.message
    });
  }
};
