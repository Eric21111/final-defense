import { memo, useEffect, useMemo, useState } from 'react';
import { FaEdit, FaPlus, FaSearch, FaTimes, FaTrash, FaUndo } from 'react-icons/fa';
import ViewCategoryProductsModal from '../../components/owner/ViewCategoryProductsModal';
import Header from '../../components/shared/header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const CategoryCard = memo(({ category, theme, builtInCategories, onViewProducts, onEdit, onDelete, onToggleStatus }) => (
  <div
    className={`rounded-xl shadow-lg border overflow-hidden transition-colors ${theme === 'dark' ? 'bg-[#2A2724] border-[#4A4037]' : 'bg-white border-gray-200'} ${category.status === 'inactive' ? 'grayscale opacity-70' : ''}`}>
    <div className="flex flex-col items-center justify-center p-4 text-center h-full">
      <h3 className={`text-xl font-bold mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        {category.name}
      </h3>
      <div className="mb-4">
        <span className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
          {category.productCount || 0}
        </span>
        <span className={`text-xs ml-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Products in category
        </span>
      </div>
      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={() => onViewProducts(category)}
          className={`px-3 py-1.5 rounded-lg transition-colors text-xs font-bold ${theme === 'dark' ?
          'bg-[#3A3734] text-gray-300 hover:bg-[#4A4440]' :
          'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
          }>
          View Products
        </button>
        {!builtInCategories.includes(category.name) &&
          <button
            onClick={() => onEdit(category)}
            className="w-8 h-8 flex items-center justify-center bg-[#007AFF] text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
            <FaEdit className="w-3.5 h-3.5" />
          </button>
        }
        {category.status === 'active' ?
          <button
            onClick={() => onDelete(category)}
            className="w-8 h-8 flex items-center justify-center bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors shadow-sm">
            <FaTrash className="w-3.5 h-3.5" />
          </button> :
          <button
            onClick={() => onToggleStatus(category._id)}
            className="w-8 h-8 flex items-center justify-center bg-[#10B981] text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm">
            <FaUndo className="w-3.5 h-3.5" />
          </button>
        }
      </div>
    </div>
  </div>
));

const Categories = () => {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showAddMainModal, setShowAddMainModal] = useState(false);
  const [showAddSubModal, setShowAddSubModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewProductsModal, setShowViewProductsModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showOnPos, setShowOnPos] = useState(true);
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [error, setError] = useState('');
  const [showArchiveCategoryModal, setShowArchiveCategoryModal] = useState(false);
  const [categoryToArchive, setCategoryToArchive] = useState(null);


  const builtInCategories = ['Tops', 'Bottoms', 'Dresses', 'Makeup', 'Accessories', 'Shoes', 'Head Wear', 'Foods'];


  useEffect(() => {
    initializeBuiltInCategories();
  }, []);

  const initializeBuiltInCategories = async () => {
    try {
      setLoading(true);


      const response = await fetch('http://localhost:5000/api/categories');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const existingCategories = data.success && Array.isArray(data.data) ? data.data : [];
      const existingCategoryNames = existingCategories.map((cat) => cat.name);


      const othersCategories = existingCategories.filter((cat) => cat.name === 'Others');
      if (othersCategories.length > 0) {
        const archivePromises = othersCategories.map((cat) =>
        fetch(`http://localhost:5000/api/categories/${cat._id}/archive`, {
          method: 'PATCH'
        }).catch((error) => {
          console.warn(`Error archiving Others category:`, error);
          return null;
        })
        );
        await Promise.all(archivePromises);
      }


      const missingCategories = builtInCategories.filter(
        (categoryName) => !existingCategoryNames.includes(categoryName)
      );


      const createPromises = missingCategories.map((categoryName) =>
      fetch('http://localhost:5000/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: categoryName,
          status: 'active'
        })
      }).catch((error) => {
        console.warn(`Error creating category ${categoryName}:`, error);
        return null;
      })
      );

      await Promise.all(createPromises);


      await fetchCategories();
    } catch (error) {
      console.error('Error initializing categories:', error);

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

  const handleAddCategory = async (type) => {
    if (!categoryName.trim()) {
      setError('Category name is required');
      return;
    }

    if (type === 'subcategory' && !selectedParentCategory) {
      setError('Parent category is required');
      return;
    }

    try {
      setError('');
      const payload = {
        name: categoryName.trim(),
        status: isActive ? 'active' : 'inactive',
        showOnPos,
        type
      };

      if (type === 'subcategory') {
        payload.parentCategory = selectedParentCategory;
      }

      const response = await fetch('http://localhost:5000/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        setCategoryName('');
        setShowAddMainModal(false);
        setShowAddSubModal(false);
        setIsActive(true);
        setShowOnPos(true);
        setSelectedParentCategory('');
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

  const groupedCategories = useMemo(() => {
    const mainCats = categories.filter(cat => cat.type !== 'subcategory' && cat.name !== 'Others');
    const subCats = categories.filter(cat => cat.type === 'subcategory');
    
    const results = [];
    
    mainCats.forEach(main => {
      const matchMainSearch = main.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMainFilter = filterStatus === 'All' ||
        (filterStatus === 'Active' && main.status === 'active') ||
        (filterStatus === 'Archived' && main.status === 'inactive');
      
      const relatedSubs = subCats.filter(sub => sub.parentCategory === main.name);
      const filteredSubs = relatedSubs.filter(sub => {
        const matchSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchFilter = filterStatus === 'All' ||
          (filterStatus === 'Active' && sub.status === 'active') ||
          (filterStatus === 'Archived' && sub.status === 'inactive');
        return matchSearch && matchFilter;
      });
      
      if ((matchMainSearch && matchMainFilter) || filteredSubs.length > 0) {
        results.push({
          ...main,
          subcategories: filteredSubs
        });
      }
    });

    return results;
  }, [categories, searchQuery, filterStatus]);

  return (
    <div className={`p-8 min-h-screen ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-[#F5F5F5]'}`}>
      <Header
        pageName="Categories"
        profileBackground={theme === 'dark' ? 'bg-[#2A2724]' : 'bg-gray-100'}
        showBorder={false}
        userName={currentUser?.name || 'Owner'}
        userRole="Owner" />
      

      {}
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
              className={`w-[500px] h-11 pl-14 pr-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent transition-colors ${theme === 'dark' ?
              'bg-[#2A2724] border-gray-600 text-white placeholder-gray-400' :
              'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`
              } />
            
          </div>

          {}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilterStatus('All')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'All' ?
              theme === 'dark' ?
              'bg-[#2A2724] text-[#AD7F65] border-[#4A4037] border-b-[4px] border-b-[#AD7F65]' :
              'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]' :
              theme === 'dark' ?
              'bg-[#2A2724] text-gray-300 border-[#4A4037] border-b-[4px] border-b-[#4A4037] hover:bg-[#3A3734]' :
              'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'}`
              }>
              
              All
            </button>
            <button
              onClick={() => setFilterStatus('Active')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'Active' ?
              theme === 'dark' ?
              'bg-[#2A2724] text-[#AD7F65] border-[#4A4037] border-b-[4px] border-b-[#AD7F65]' :
              'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]' :
              theme === 'dark' ?
              'bg-[#2A2724] text-gray-300 border-[#4A4037] border-b-[4px] border-b-[#4A4037] hover:bg-[#3A3734]' :
              'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'}`
              }>
              
              Active
            </button>
            <button
              onClick={() => setFilterStatus('Archived')}
              className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm border ${filterStatus === 'Archived' ?
              theme === 'dark' ?
              'bg-[#2A2724] text-[#AD7F65] border-[#4A4037] border-b-[4px] border-b-[#AD7F65]' :
              'bg-white text-[#AD7F65] border-gray-100 border-b-[4px] border-b-[#AD7F65]' :
              theme === 'dark' ?
              'bg-[#2A2724] text-gray-300 border-[#4A4037] border-b-[4px] border-b-[#4A4037] hover:bg-[#3A3734]' :
              'bg-white text-gray-800 border-gray-200 border-b-[4px] border-b-gray-200 hover:bg-gray-50'}`
              }>
              
              Archived
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setCategoryName('');
              setError('');
              setSelectedParentCategory('');
              setIsActive(true);
              setShowOnPos(true);
              setShowAddSubModal(true);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all border ${theme === 'dark' ? 'bg-[#2A2724] text-white border-gray-600 hover:bg-[#3A3734]' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}>
            
            <FaPlus className="w-3.5 h-3.5" />
            Add subcategory
          </button>
          
          <button
            onClick={() => {
              setCategoryName('');
              setError('');
              setIsActive(true);
              setShowOnPos(true);
              setShowAddMainModal(true);
            }}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all bg-[#007AFF] hover:bg-blue-600">
            
            <FaPlus className="w-4 h-4" />
            Add main category
          </button>
        </div>
      </div>

      {}      {/* Categories Grid */}
      {loading ?
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">Loading categories...</div>
        </div> :
        groupedCategories.length === 0 ?
          <div className="flex justify-center items-center py-12">
            <div className="text-gray-500">No categories found. Create your first category!</div>
          </div> :

          <div className="flex flex-col gap-6 w-full">
            {groupedCategories.map((mainGroup) => (
              <div key={mainGroup._id} className="flex flex-col gap-3">
                
                {/* Main Category row */}
                <div className="w-full max-w-sm">
                  <CategoryCard 
                    category={mainGroup} 
                    theme={theme} 
                    builtInCategories={builtInCategories}
                    onViewProducts={handleViewProducts}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleStatus={handleToggleStatus}
                  />
                </div>
                
                {/* Subcategories */}
                {mainGroup.subcategories && mainGroup.subcategories.length > 0 && (
                  <div className={`ml-8 pl-6 border-l-2 ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-300'} grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`}>
                    {mainGroup.subcategories.map((subCat) => (
                      <CategoryCard 
                        key={subCat._id}
                        category={subCat} 
                        theme={theme} 
                        builtInCategories={builtInCategories}
                        onViewProducts={handleViewProducts}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onToggleStatus={handleToggleStatus}
                      />
                    ))}
                  </div>
                )}
                
              </div>
            ))}
          </div>
      }

      {/* Add Main Category Modal */}
      {showAddMainModal &&
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-lg ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-lg bg-[#007AFF]">
                  <FaPlus />
                </div>
                <h2 className="text-2xl font-bold">Add Main Category</h2>
              </div>
              <button
                onClick={() => {
                  setShowAddMainModal(false);
                  setCategoryName('');
                  setError('');
                }}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}>
                
                <FaTimes className="text-xl" />
              </button>
            </div>

            {}            {/* Modal Form */}
            <div className="mb-6">
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
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all
                    ${theme === 'dark' ?
                    'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500' :
                    'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-sm'}`
                }
                placeholder="eg. Casual Wear"
                autoFocus />
              
              {error && <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1"><FaTimes className="text-xs" /> {error}</p>}
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-4 mb-8">
              <div className={`flex items-center justify-between py-3 border-b ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-100'}`}>
                <div>
                  <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Active</h4>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Inactive categories are hidden from POS and reports.</p>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 ${isActive ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className={`flex items-center justify-between py-3 border-b ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-100'}`}>
                <div>
                  <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Show on POS screen</h4>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Display as a quick-filter button on the cashier screen.</p>
                </div>
                <button
                  onClick={() => setShowOnPos(!showOnPos)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 ${showOnPos ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showOnPos ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowAddMainModal(false);
                  setCategoryName('');
                  setError('');
                }}
                className={`px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark' ?
                'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]' :
                'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
                }>
                Cancel
              </button>
              <button
                onClick={() => handleAddCategory('category')}
                className="px-8 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 bg-[#007AFF] hover:bg-blue-600">
                Add main category
              </button>
            </div>
          </div>
        </div>
      }

      {/* Add Subcategory Modal */}
      {showAddSubModal &&
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-lg ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {/* Modal Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-700 text-xl shadow-md border bg-white">
                  <FaPlus />
                </div>
                <h2 className="text-2xl font-bold">Add Subcategory</h2>
              </div>
              <button
                onClick={() => {
                  setShowAddSubModal(false);
                  setCategoryName('');
                  setSelectedParentCategory('');
                  setError('');
                }}
                className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}>
                <FaTimes className="text-xl" />
              </button>
            </div>

            {/* Parent Category Select */}
            <div className="mb-4">
              <label className={`block text-sm font-semibold mb-2 ml-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Parent category
              </label>
              <select
                value={selectedParentCategory}
                onChange={(e) => {
                  setSelectedParentCategory(e.target.value);
                  setError('');
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all
                    ${theme === 'dark' ?
                    'bg-[#2A2724] border-gray-600 text-white' :
                    'bg-white border-gray-200 text-gray-900 shadow-sm'}`
                }
              >
                <option value="" disabled>Select parent category...</option>
                {categories.filter(c => c.type !== 'subcategory').map(c => (
                  <option key={c._id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <p className={`text-xs mt-2 ml-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>This will be a subcategory.</p>
            </div>

            {/* Modal Form */}
            <div className="mb-6">
              <label className={`block text-sm font-semibold mb-2 ml-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                Subcategory Name
              </label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setError('');
                }}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007AFF] transition-all
                    ${theme === 'dark' ?
                    'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500' :
                    'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-sm'}`
                }
                placeholder="eg. Casual Wear"
              />
              
              {error && <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1"><FaTimes className="text-xs" /> {error}</p>}
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-4 mb-8">
              <div className={`flex items-center justify-between py-3 border-b ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-100'}`}>
                <div>
                  <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Active</h4>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Inactive categories are hidden from POS and reports.</p>
                </div>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 ${isActive ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className={`flex items-center justify-between py-3 border-b ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-100'}`}>
                <div>
                  <h4 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Show on POS screen</h4>
                  <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Display as a quick-filter button on the cashier screen.</p>
                </div>
                <button
                  onClick={() => setShowOnPos(!showOnPos)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:ring-offset-2 ${showOnPos ? 'bg-[#007AFF]' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showOnPos ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setShowAddSubModal(false);
                  setCategoryName('');
                  setSelectedParentCategory('');
                  setError('');
                }}
                className={`px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark' ?
                'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]' :
                'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
                }>
                Cancel
              </button>
              <button
                onClick={() => handleAddCategory('subcategory')}
                className="px-8 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 bg-[#007AFF] hover:bg-blue-600">
                Add subcategory
              </button>
            </div>
          </div>
        </div>
      }

      {}
      {showEditModal &&
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-lg ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {}
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
              className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}>
              
                <FaTimes className="text-xl" />
              </button>
            </div>

            {}
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
                  ${theme === 'dark' ?
              'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500' :
              'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-sm'}`
              }
              placeholder="eg. Casual Wear"
              autoFocus />
            
              {error && <p className="text-red-500 text-sm mt-2 ml-1 flex items-center gap-1"><FaTimes className="text-xs" /> {error}</p>}
            </div>

            {}
            <div className="flex gap-4 justify-center">
              <button
              onClick={() => {
                setShowEditModal(false);
                setEditingCategory(null);
                setCategoryName('');
                setError('');
              }}
              className={`px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark' ?
              'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]' :
              'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
              }>
              
                Cancel
              </button>
              <button
              onClick={handleEditCategory}
              className="px-8 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
              
                Save Changes
              </button>
            </div>
          </div>
        </div>
      }

      {}
      <ViewCategoryProductsModal
        isOpen={showViewProductsModal}
        onClose={() => {
          setShowViewProductsModal(false);
          setSelectedCategory(null);
        }}
        categoryName={selectedCategory?.name} />
      

      {}
      {showArchiveCategoryModal &&
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl p-8 w-full max-w-md ${theme === 'dark' ? 'bg-[#1E1B18] text-white' : 'bg-white text-gray-900'} relative shadow-2xl transition-all transform scale-100`}>

            {}
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
              className={`p-2 rounded-full hover:bg-opacity-10 transition-colors ${theme === 'dark' ? 'hover:bg-white text-gray-400' : 'hover:bg-black text-gray-400'}`}>
              
                <FaTimes className="text-xl" />
              </button>
            </div>

            {}
            <div className="mb-8">
              <p className={`text-base leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to archive the category <span className="font-bold">"{categoryToArchive?.name}"</span>? It will be hidden from POS/Terminal and Inventory filters.
              </p>
            </div>

            {}
            <div className="flex gap-4 justify-center">
              <button
              onClick={() => {
                setShowArchiveCategoryModal(false);
                setCategoryToArchive(null);
              }}
              className={`px-6 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${theme === 'dark' ?
              'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]' :
              'bg-gray-200 text-gray-700 hover:bg-gray-300'}`
              }>
              
                Cancel
              </button>
              <button
              onClick={handleConfirmArchive}
              className="px-6 py-3 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' }}>
              
                Yes, Archive
              </button>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default memo(Categories);