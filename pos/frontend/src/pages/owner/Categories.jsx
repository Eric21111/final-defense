import { memo, useEffect, useMemo, useState } from 'react';
import { FaEdit, FaPlus, FaSearch, FaTimes, FaTrash, FaUndo } from 'react-icons/fa';
import ViewCategoryProductsModal from '../../components/owner/ViewCategoryProductsModal';
import Header from '../../components/shared/header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const Categories = () => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // All, Active, Archived
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewProductsModal, setShowViewProductsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [error, setError] = useState('');
  const [showArchiveCategoryModal, setShowArchiveCategoryModal] = useState(false);
  const [categoryToArchive, setCategoryToArchive] = useState(null);

  // Built-in categories that should always exist
  const builtInCategories = ['Tops', 'Bottoms', 'Dresses', 'Makeup', 'Accessories', 'Shoes', 'Head Wear', 'Foods'];

  // Fetch categories from API
  useEffect(() => {
    initializeBuiltInCategories();
  }, []);

  const initializeBuiltInCategories = async () => {
    try {
      setLoading(true);

      // First, fetch existing categories
      const response = await fetch('http://localhost:5000/api/categories');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const existingCategories = data.success && Array.isArray(data.data) ? data.data : [];
      const existingCategoryNames = existingCategories.map(cat => cat.name);

      // Archive any existing "Others" categories
      const othersCategories = existingCategories.filter(cat => cat.name === 'Others');
      if (othersCategories.length > 0) {
        const archivePromises = othersCategories.map(cat =>
          fetch(`http://localhost:5000/api/categories/${cat._id}/archive`, {
            method: 'PATCH'
          }).catch(error => {
            console.warn(`Error archiving Others category:`, error);
            return null;
          })
        );
        await Promise.all(archivePromises);
      }

      // Create missing built-in categories
      const missingCategories = builtInCategories.filter(
        categoryName => !existingCategoryNames.includes(categoryName)
      );

      // Create all missing categories
      const createPromises = missingCategories.map(categoryName =>
        fetch('http://localhost:5000/api/categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: categoryName,
            status: 'active'
          })
        }).catch(error => {
          console.warn(`Error creating category ${categoryName}:`, error);
          return null;
        })
      );

      await Promise.all(createPromises);

      // Fetch all categories again after creating missing ones
      await fetchCategories();
    } catch (error) {
      console.error('Error initializing categories:', error);
      // Still try to fetch categories even if initialization fails
      await fetchCategories();
    }
  };

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/categories');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {
        setCategories(data.data);
      } else {
        console.warn('Invalid response format:', data);
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setError('');
      const response = await fetch('http://localhost:5000/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: categoryName.trim(),
          status: 'active'
        })
      });

      const data = await response.json();

      if (data.success) {
        setCategoryName('');
        setShowAddModal(false);
        fetchCategories();
      } else {
        setError(data.message || 'Failed to create category');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      setError('Error creating category');
    }
  };

  const handleEditCategory = async () => {
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setError('');
      const response = await fetch(`http://localhost:5000/api/categories/${editingCategory._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: categoryName.trim()
        })
      });

      const data = await response.json();

      if (data.success) {
        setCategoryName('');
        setEditingCategory(null);
        setShowEditModal(false);
        fetchCategories();
      } else {
        setError(data.message || 'Failed to update category');
      }
    } catch (error) {
      console.error('Error updating category:', error);
      setError('Error updating category');
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/api/categories/${id}/archive`, {
        method: 'PATCH'
      });

      const data = await response.json();

      if (data.success) {
        fetchCategories();
      } else {
        alert('Failed to update category status');
      }
    } catch (error) {
      console.error('Error updating category status:', error);
      alert('Error updating category status');
    }
  };

  const handleDelete = (category) => {
    setCategoryToArchive(category);
    setShowArchiveCategoryModal(true);
  };

  const handleConfirmArchive = async () => {
    if (!categoryToArchive) return;

    try {
      // Archive the category (set status to inactive) instead of deleting
      const response = await fetch(`http://localhost:5000/api/categories/${categoryToArchive._id}/archive`, {
        method: 'PATCH'
      });

      const data = await response.json();

      if (data.success) {
        setShowArchiveCategoryModal(false);
        setCategoryToArchive(null);
        fetchCategories();
      } else {
        alert(data.message || 'Failed to archive category');
      }
    } catch (error) {
      console.error('Error archiving category:', error);
      alert('Error archiving category');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setError('');
    setShowEditModal(true);
  };

  const handleViewProducts = (category) => {
    setSelectedCategory(category);
    setShowViewProductsModal(true);
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(category => {
      // Exclude "Others" category from display
      if (category.name === 'Others') {
        return false;
      }
      const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'All' ||
        (filterStatus === 'Active' && category.status === 'active') ||
        (filterStatus === 'Archived' && category.status === 'inactive');
      return matchesSearch && matchesFilter;
    });
  }, [categories, searchQuery, filterStatus]);

  return (
    <div className={`p-8 min-h-screen ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-[#F5F5F5]'}`}>
      <Header
        pageName="Categories"
        profileBackground={theme === 'dark' ? 'bg-[#2A2724]' : 'bg-gray-100'}
        showBorder={false}
        userName={currentUser?.name || 'Owner'}
        userRole="Owner"
      />

      {/* Search and Filter Section */}
      <div className="flex items-center gap-4 mb-6 justify-between mt-5">
        <div className="flex items-center gap-30">
          <div className="relative" style={{ maxWidth: '400px' }}>
            <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-10 h-9 flex items-center justify-center text-white rounded-xl" style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
              <FaSearch className="text-sm" />
            </div>
            <input
              type="text"
              placeholder="Search For..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-[500px] h-11 pl-14 pr-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent transition-colors ${theme === 'dark'
                ? 'bg-[#2A2724] border-gray-600 text-white placeholder-gray-400'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterStatus('All')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'All'
                ? theme === 'dark'
                  ? 'bg-[#2A2724] text-[#AD7F65] border-[#4A4037] border-b-[4px] border-b-[#AD7F65]'
                  : 'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]'
                : theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 border-[#4A4037] border-b-[4px] border-b-[#4A4037] hover:bg-[#3A3734]'
                  : 'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('Active')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'Active'
                ? theme === 'dark'
                  ? 'bg-[#2A2724] text-[#AD7F65] border-[#4A4037] border-b-[4px] border-b-[#AD7F65]'
                  : 'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]'
                : theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 border-[#4A4037] border-b-[4px] border-b-[#4A4037] hover:bg-[#3A3734]'
                  : 'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('Archived')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'Archived'
                ? theme === 'dark'
                  ? 'bg-[#2A2724] text-[#AD7F65] border-[#4A4037] border-b-[4px] border-b-[#AD7F65]'
                  : 'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]'
                : theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 border-[#4A4037] border-b-[4px] border-b-[#4A4037] hover:bg-[#3A3734]'
                  : 'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'
                }`}
            >
              Archived
            </button>
          </div>
        </div>

        {/* Add Category Button */}
        <button
          onClick={() => {
            setCategoryName('');
            setError('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
        >
          <FaPlus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Categories Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">Loading categories...</div>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">No categories found. Create your first category!</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredCategories.map((category) => (
            <div
              key={category._id}
              className={`rounded-xl shadow-lg border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#2A2724] border-[#4A4037]' : 'bg-white border-gray-200'} ${category.status === 'inactive' ? 'grayscale opacity-70' : ''}`}
            >
              <div className="flex flex-col items-center justify-center p-4 text-center h-full">
                {/* Category Name */}
                <h3 className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {category.name}
                </h3>

                {/* Product Count */}
                <div className="mb-4">
                  <span className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                    {category.productCount || 0}
                  </span>
                  <span className={`text-xs ml-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    Products in category
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={() => handleViewProducts(category)}
                    className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${theme === 'dark'
                      ? 'bg-[#3A3734] text-gray-300 hover:bg-[#4A4440]'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    View Products
                  </button>
                  {!builtInCategories.includes(category.name) && (
                    <button
                      onClick={() => handleEdit(category)}
                      className="w-8 h-8 flex items-center justify-center bg-[#007AFF] text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                    >
                      <FaEdit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {category.status === 'active' ? (
                    <button
                      onClick={() => handleDelete(category)}
                      className="w-8 h-8 flex items-center justify-center bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-sm"
                    >
                      <FaTrash className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(category._id)}
                      className="w-8 h-8 flex items-center justify-center bg-[#10B981] text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                    >
                      <FaUndo className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-lg ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg" style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
                  <FaPlus />
                </div>
                <h2 className="text-2xl font-bold">Add New Category</h2>
              </div>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setCategoryName('');
                  setError('');
                }}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-8">
              <label className={`block text-sm font-semibold mb-2 ml-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Category Name
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setError('');
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] transition-all
                  ${theme === 'dark'
                    ? 'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-sm'
                  }`}
                placeholder="eg. Casual Wear"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1"><FaTimes className="text-xs" /> {error}</p>}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setCategoryName('');
                  setError('');
                }}
                className={`px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                className="px-8 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {showEditModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-lg ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg" style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
                  <FaEdit />
                </div>
                <h2 className="text-2xl font-bold">Edit Category</h2>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                  setCategoryName('');
                  setError('');
                }}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-8">
              <label className={`block text-sm font-semibold mb-2 ml-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Category Name
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setError('');
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] transition-all
                  ${theme === 'dark'
                    ? 'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-sm'
                  }`}
                placeholder="eg. Casual Wear"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1"><FaTimes className="text-xs" /> {error}</p>}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCategory(null);
                  setCategoryName('');
                  setError('');
                }}
                className={`px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleEditCategory}
                className="px-8 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Products Modal */}
      <ViewCategoryProductsModal
        isOpen={showViewProductsModal}
        onClose={() => {
          setShowViewProductsModal(false);
          setSelectedCategory(null);
        }}
        categoryName={selectedCategory?.name}
      />

      {/* Archive Category Modal */}
      {showArchiveCategoryModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-md ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg" style={{ background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' }}>
                  <FaTrash />
                </div>
                <h2 className="text-2xl font-bold">Archive Category</h2>
              </div>
              <button
                onClick={() => {
                  setShowArchiveCategoryModal(false);
                  setCategoryToArchive(null);
                }}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}
              >
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Content */}
            <div className="mb-8">
              <p className={`text-base leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to archive the category <span className="font-bold">"{categoryToArchive?.name}"</span>? It will be hidden from POS/Terminal and Inventory filters.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowArchiveCategoryModal(false);
                  setCategoryToArchive(null);
                }}
                className={`px-6 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmArchive}
                className="px-6 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' }}
              >
                Yes, Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(Categories);

