import React, { memo, useEffect, useMemo, useState } from 'react';
import { FaChevronDown, FaChevronRight, FaEdit, FaPlus, FaSearch, FaTimes, FaTrash, FaUndo } from 'react-icons/fa';
import ViewCategoryProductsModal from '../../components/owner/ViewCategoryProductsModal';
import Header from '../../components/shared/header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

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
  const [collapsedCategories, setCollapsedCategories] = useState({});


  const categoryStructure = {
    "Apparel - Men": ["Tops", "Bottoms", "Outerwear"],
    "Apparel - Women": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Apparel - Kids": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Apparel - Unisex": ["Tops", "Bottoms", "Dresses", "Outerwear"],
    "Foods": ["Beverages", "Snacks", "Meals", "Desserts", "Ingredients", "Other"],
    "Makeup": ["Face", "Eyes", "Lips", "Nails", "SkinCare", "Others"],
    "Accessories": ["Jewelry", "Bags", "Head Wear", "Glasses/Sunglasses", "Others"],
    "Shoes": ["Sneakers", "Boots", "Sandals", "Others"],
    "Essentials": ["Daily Essentials", "Personal Care", "Home Essentials", "Others"],
  };

  const builtInCategories = [
    ...Object.keys(categoryStructure),
    ...new Set(Object.values(categoryStructure).flat())
  ];


  useEffect(() => {
    fetchCategories().then(cats => {
      if (cats && cats.length > 0) {
        initializeBuiltInCategories(cats);
      }
    });
  }, []);

  const initializeBuiltInCategories = async (existingData) => {
    try {
      const existingCats = existingData.filter(c => c.type !== 'subcategory').map(c => c.name);
      const existingSubs = existingData.filter(c => c.type === 'subcategory');
      
      const othersCategories = existingData.filter((cat) => cat.name === 'Others');
      let needsRefresh = false;

      if (othersCategories.length > 0) {
        const archivePromises = othersCategories.map((cat) =>
        fetch(`http://localhost:5000/api/categories/${cat._id}/archive`, {
          method: 'PATCH'
        }).catch((error) => null)
        );
        await Promise.all(archivePromises);
        needsRefresh = true;
      }

      // Fix legacy entries: patch any known subcategory that's incorrectly typed as 'category'
      const knownSubNames = new Set(Object.values(categoryStructure).flat());
      const mistyped = existingData.filter(c => 
        c.type !== 'subcategory' && knownSubNames.has(c.name)
      );
      if (mistyped.length > 0) {
        const fixPromises = mistyped.map(cat => {
          const parentName = Object.entries(categoryStructure).find(
            ([, subs]) => subs.includes(cat.name)
          )?.[0] || null;
          if (!parentName) return null;
          return fetch(`http://localhost:5000/api/categories/${cat._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'subcategory', parentCategory: parentName })
          }).catch(() => null);
        }).filter(Boolean);
        await Promise.all(fixPromises);
        needsRefresh = true;
      }

      const createPromises = [];

      Object.keys(categoryStructure).forEach(parentName => {
        if (!existingCats.includes(parentName)) {
            createPromises.push(
              fetch('http://localhost:5000/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: parentName, type: 'category', status: 'active' })
              }).catch(() => null)
            );
        }
      });

      Object.entries(categoryStructure).forEach(([parentName, subList]) => {
          subList.forEach(subName => {
              const subExists = existingSubs.some(s => s.name === subName && s.parentCategory === parentName);
              if (!subExists) {
                  createPromises.push(
                      fetch('http://localhost:5000/api/categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: subName, type: 'subcategory', parentCategory: parentName, status: 'active' })
                      }).catch(() => null)
                  );
              }
          });
      });

      if (createPromises.length > 0) {
        await Promise.all(createPromises);
        needsRefresh = true;
      }

      if (needsRefresh) {
        const response = await fetch('http://localhost:5000/api/categories');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setCategories(data.data);
        }
      }
    } catch (error) {
      console.error('Error initializing categories background sync:', error);
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
        return data.data;
      } else {
        console.warn('Invalid response format:', data);
        setCategories([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
      return [];
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

  const knownSubcategoryNames = useMemo(() => {
    const names = new Set();
    Object.values(categoryStructure).forEach(subs => subs.forEach(s => names.add(s)));
    return names;
  }, []);

  const groupedCategories = useMemo(() => {
    const mainCats = categories.filter(cat => 
      cat.type !== 'subcategory' && 
      cat.name !== 'Others' && 
      !knownSubcategoryNames.has(cat.name)
    );
    const subCats = categories.filter(cat => 
      cat.type === 'subcategory' || knownSubcategoryNames.has(cat.name)
    );
    
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

          <div className={`overflow-x-auto rounded-xl border ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-200'} bg-white dark:bg-[#1E1B18]`}>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'bg-[#2A2724] text-gray-400' : 'bg-gray-50 text-gray-500'} border-b ${theme === 'dark' ? 'border-[#4A4037]' : 'border-gray-200'}`}>
                  <th className="px-6 py-4 font-semibold">Name</th>
                  <th className="px-6 py-4 font-semibold">Type</th>
                  <th className="px-6 py-4 font-semibold">Products</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">POS</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'dark' ? 'divide-[#4A4037]' : 'divide-gray-100'}`}>
                {groupedCategories.map((mainGroup) => (
                  <React.Fragment key={mainGroup._id}>
                    {/* Main Category row */}
                    <tr className={`hover:bg-opacity-50 transition-colors ${theme === 'dark' ? 'hover:bg-[#3A3734] bg-[#2A2724]/30' : 'hover:bg-gray-50 bg-white'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {mainGroup.subcategories && mainGroup.subcategories.length > 0 && (
                            <button
                              onClick={() => setCollapsedCategories(prev => ({ ...prev, [mainGroup._id]: !prev[mainGroup._id] }))}
                              className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-[#3A3734] text-gray-400' : 'hover:bg-gray-200 text-gray-500'}`}
                            >
                              {collapsedCategories[mainGroup._id] ? <FaChevronRight className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                          <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'} text-base`}>
                            {mainGroup.name}
                          </span>
                          {mainGroup.subcategories && mainGroup.subcategories.length > 0 && (
                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>({mainGroup.subcategories.length})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                          Main category
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                          {mainGroup.productCount || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${mainGroup.status === 'active' ? 'bg-[#10B981]' : 'bg-gray-400'}`}></div>
                          <span className={`text-sm ${mainGroup.status === 'active' ? 'text-[#10B981]' : 'text-gray-500'}`}>
                            {mainGroup.status === 'active' ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${mainGroup.showOnPos !== false ? 'text-[#10B981]' : 'text-gray-400'}`}>
                          {mainGroup.showOnPos !== false ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!builtInCategories.includes(mainGroup.name) &&
                            <button
                              onClick={() => handleEdit(mainGroup)}
                              className={`p-2 rounded-lg transition-colors group ${theme === 'dark' ? 'hover:bg-[#352F2A]' : 'hover:bg-blue-50'}`}
                              title="Edit">
                              <svg className="w-5 h-5 text-blue-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          }
                          <button
                            onClick={() => {
                              setCategoryName('');
                              setError('');
                              setSelectedParentCategory(mainGroup.name);
                              setIsActive(true);
                              setShowOnPos(true);
                              setShowAddSubModal(true);
                            }}
                            className={`px-4 py-1.5 text-xs font-medium border rounded-md transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                            + Sub
                          </button>
                          {mainGroup.status === 'active' ? (
                            <button
                              onClick={() => handleDelete(mainGroup)}
                              className={`p-2 rounded-lg transition-colors group ${theme === 'dark' ? 'hover:bg-[#352F2A]' : 'hover:bg-orange-50'}`}
                              title="Archive">
                              <svg className="w-5 h-5 text-orange-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(mainGroup._id)}
                              className={`p-2 rounded-lg transition-colors group ${theme === 'dark' ? 'hover:bg-[#352F2A]' : 'hover:bg-green-50'}`}
                              title="Activate">
                              <svg className="w-5 h-5 text-green-500 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {/* Subcategories rows - collapsible */}
                    {!collapsedCategories[mainGroup._id] && mainGroup.subcategories && mainGroup.subcategories.map((subCat) => (
                      <tr key={subCat._id} className={`hover:bg-opacity-50 transition-colors ${theme === 'dark' ? 'hover:bg-[#3A3734] bg-[#1E1B18]' : 'hover:bg-gray-50 bg-white'}`}>
                        <td className="px-6 py-4 pl-12">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-300 dark:text-[#4A4037] text-lg leading-none transform -translate-y-[2px]">└</span>
                            <span className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                              {subCat.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-100">
                            Subcategory
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            {subCat.productCount || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${subCat.status === 'active' ? 'bg-[#10B981]' : 'bg-gray-400'}`}></div>
                            <span className={`text-sm ${subCat.status === 'active' ? 'text-[#10B981]' : 'text-gray-500'}`}>
                              {subCat.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${subCat.showOnPos !== false ? 'text-[#10B981]' : 'text-gray-400'}`}>
                            {subCat.showOnPos !== false ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                            {!builtInCategories.includes(subCat.name) &&
                              <button
                                onClick={() => handleEdit(subCat)}
                                className={`p-2 rounded-lg transition-colors group ${theme === 'dark' ? 'hover:bg-[#352F2A]' : 'hover:bg-blue-50'}`}
                                title="Edit">
                                <svg className="w-5 h-5 text-blue-500 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            }
                            {subCat.status === 'active' ? (
                              <button
                                onClick={() => handleDelete(subCat)}
                                className={`p-2 rounded-lg transition-colors group ${theme === 'dark' ? 'hover:bg-[#352F2A]' : 'hover:bg-orange-50'}`}
                                title="Archive">
                                <svg className="w-5 h-5 text-orange-400 group-hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleStatus(subCat._id)}
                                className={`p-2 rounded-lg transition-colors group ${theme === 'dark' ? 'hover:bg-[#352F2A]' : 'hover:bg-green-50'}`}
                                title="Activate">
                                <svg className="w-5 h-5 text-green-500 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
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