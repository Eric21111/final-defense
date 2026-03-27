import { useEffect, useMemo, useState } from 'react';
import { FaBox, FaCalendar, FaEdit, FaPlus, FaSearch, FaTag, FaTrash, FaUsers } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import AddDiscountModal from '../../components/owner/AddDiscountModal';
import Header from '../../components/shared/header';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { API_ENDPOINTS } from '../../config/api';

const icon20Percent = new URL('../../assets/owner/20.png', import.meta.url).href;
const icon50Percent = new URL('../../assets/owner/50.png', import.meta.url).href;
const iconSenior = new URL('../../assets/owner/Senior&ani.png', import.meta.url).href;

const DiscountManagement = () => {
  const { currentUser, isOwner } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState(null);


  const getDiscountIcon = (discount) => {
    const title = discount.title?.toLowerCase() || '';
    const discountValue = discount.discountValue || '';

    if (title.includes('senior')) {
      return {
        icon: iconSenior,
        iconColor: 'linear-gradient(135deg, #9B59B6 0%, #E91E63 100%)',
        titleColor: '#AD7F65'
      };
    }


    const match = discountValue.match(/(\d+)/);
    if (match) {
      const value = parseInt(match[1]);
      if (value >= 50) {
        return {
          icon: icon50Percent,
          iconColor: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)',
          titleColor: '#6B7280'
        };
      }
    }

    return {
      icon: icon20Percent,
      iconColor: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
      titleColor: '#FF8E53'
    };
  };


  useEffect(() => {
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.discounts);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.data)) {

        const formattedDiscounts = data.data.map((discount) => {
          const iconData = getDiscountIcon(discount);
          return {
            ...discount,
            ...iconData
          };
        });
        setDiscounts(formattedDiscounts);
      } else {
        console.warn('Invalid response format:', data);
        setDiscounts([]);
      }
    } catch (error) {
      console.error('Error fetching discounts:', error);
      setDiscounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      const discount = discounts.find((d) => d._id === id);
      if (!discount) return;

      const newStatus = discount.status === 'active' ? 'inactive' : 'active';

      const response = await fetch(API_ENDPOINTS.discountById(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();

      if (data.success) {

        fetchDiscounts();
      } else {
        alert('Failed to update discount status');
      }
    } catch (error) {
      console.error('Error updating discount status:', error);
      alert('Error updating discount status');
    }
  };

  const handleDeleteClick = (discount) => {
    setDiscountToDelete(discount);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!discountToDelete) return;

    try {
      const response = await fetch(API_ENDPOINTS.discountById(discountToDelete._id), {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setShowDeleteModal(false);
        setDiscountToDelete(null);

        fetchDiscounts();
      } else {
        alert('Failed to delete discount');
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      alert('Error deleting discount');
    }
  };


  const handleEditClick = async (discount) => {

    if (discount.appliesTo === 'products' && discount.productIds && discount.productIds.length > 0) {
      try {
        const response = await fetch(API_ENDPOINTS.products);
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const selectedProducts = data.data.filter((p) =>
          discount.productIds.includes(p._id)
          ).map((p) => ({
            _id: p._id,
            itemName: p.itemName,
            sku: p.sku,
            itemImage: p.itemImage,
            category: p.category,
            brandName: p.brandName
          }));
          setEditingDiscount({ ...discount, selectedProducts });
        } else {
          setEditingDiscount(discount);
        }
      } catch (error) {
        console.error('Error fetching products for edit:', error);
        setEditingDiscount(discount);
      }
    } else {
      setEditingDiscount(discount);
    }
    setShowAddModal(true);
  };

  const handleUpdateDiscount = async (id, formData) => {
    try {
      const discountData = {
        title: formData.discountName.toUpperCase(),
        discountCode: formData.discountCode || '',
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        appliesTo: formData.appliesTo,
        category: formData.appliesTo === 'category' ? formData.category : null,
        subCategory: formData.appliesTo === 'category' && formData.subCategory ? formData.subCategory : null,
        productIds: formData.appliesTo === 'products' ? formData.selectedProducts.map((p) => p._id) : [],
        validFrom: formData.noExpiration ? null : formData.validFrom,
        validTo: formData.noExpiration ? null : formData.validUntil,
        noExpiration: formData.noExpiration,
        minPurchaseAmount: formData.minPurchaseAmount ? parseFloat(formData.minPurchaseAmount) : 0,
        maxPurchaseAmount: formData.maxPurchaseAmount ? parseFloat(formData.maxPurchaseAmount) : null,
        usageLimit: formData.usageLimit && formData.usageLimit !== '0' ? parseInt(formData.usageLimit) : null,
        description: formData.description || ''
      };

      const response = await fetch(API_ENDPOINTS.discountById(id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(discountData)
      });

      const data = await response.json();

      if (data.success) {

        fetchDiscounts();
      } else {
        alert('Failed to update discount: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating discount:', error);
      alert('Error updating discount');
    }
  };
  const handleAddDiscount = async (formData) => {
    try {
      const discountData = {
        title: formData.discountName.toUpperCase(),
        discountCode: formData.discountCode || '',
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        appliesTo: formData.appliesTo,
        category: formData.appliesTo === 'category' ? formData.category : null,
        subCategory: formData.appliesTo === 'category' && formData.subCategory ? formData.subCategory : null,
        productIds: formData.appliesTo === 'products' ? formData.selectedProducts.map((p) => p._id) : [],
        validFrom: formData.noExpiration ? null : formData.validFrom,
        validTo: formData.noExpiration ? null : formData.validUntil,
        noExpiration: formData.noExpiration,
        minPurchaseAmount: formData.minPurchaseAmount ? parseFloat(formData.minPurchaseAmount) : 0,
        maxPurchaseAmount: formData.maxPurchaseAmount ? parseFloat(formData.maxPurchaseAmount) : null,
        usageLimit: formData.usageLimit && formData.usageLimit !== '0' ? parseInt(formData.usageLimit) : null,
        description: formData.description || '',
        status: 'active'
      };

      const response = await fetch(API_ENDPOINTS.discounts, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(discountData)
      });

      const data = await response.json();

      if (data.success) {

        fetchDiscounts();
      } else {
        alert('Failed to create discount: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating discount:', error);
      alert('Error creating discount');
    }
  };

  const filteredDiscounts = discounts.filter((discount) => {

    const matchesSearch = discount.title.toLowerCase().includes(searchQuery.toLowerCase());


    const matchesType = filterType === 'all' || discount.discountType === filterType;


    let matchesCategory = true;
    if (filterCategory !== 'all') {
      if (filterCategory === 'no-category') {
        matchesCategory = !discount.category || discount.category === null;
      } else {
        matchesCategory = String(discount.category || '').trim().toLowerCase() === String(filterCategory).trim().toLowerCase();
      }
    }

    return matchesSearch && matchesType && matchesCategory;
  });

  const categoryFilterOptions = useMemo(() => {
    const set = new Set();
    discounts.forEach((d) => {
      if (d?.category) set.add(String(d.category).trim());
    });
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [discounts]);

  return (
    <div className={`p-8 min-h-screen ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-50'}`}>
      <Header
        pageName="Discount Management"
        profileBackground={theme === 'dark' ? 'bg-[#2A2724]' : 'bg-gray-100'}
        showBorder={false}
        userName={currentUser?.name || 'Owner'}
        userRole="Owner" />
      


      <div className="flex items-center gap-4 mb-6 justify-between mt-8">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-shrink-0" style={{ width: '400px' }}>
            <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-10 h-9 flex items-center justify-center text-white rounded-xl" style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
              <FaSearch className="text-sm" />
            </div>
            <input
              type="text"
              placeholder="Search For..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-11 pl-14 pr-4 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === 'dark' ?
              'bg-[#2A2724] border-gray-600 text-white placeholder-gray-400' :
              'bg-white border-gray-300 text-gray-900'}`
              } />
            
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className={`px-4 py-2.5 rounded-lg border font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent flex-shrink-0 ${theme === 'dark' ?
            'bg-[#2A2724] border-gray-600 text-white' :
            'bg-white border-gray-300 text-gray-700'}`
            }>
            
            <option value="all">All Types</option>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={`px-4 py-2.5 rounded-lg border font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent flex-shrink-0 ${theme === 'dark' ?
            'bg-[#2A2724] border-gray-600 text-white' :
            'bg-white border-gray-300 text-gray-700'}`
            }>
            
            <option value="all">All Categories</option>
            <option value="no-category">All Products</option>
            {categoryFilterOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => {
            setEditingDiscount(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
          style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
          
          <FaPlus className="w-4 h-4" />
          Add New Discount
        </button>
      </div>



      {loading ?
      <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">Loading discounts...</div>
        </div> :
      filteredDiscounts.length === 0 ?
      <div className="flex justify-center items-center py-12">
          <div className="text-gray-500">No discounts found. Create your first discount!</div>
        </div> :

      <div className="grid grid-cols-2 gap-6">
          {filteredDiscounts.map((discount) =>
        <div
          key={discount._id}
          className={`rounded-xl overflow-hidden border shadow-lg flex ${theme === 'dark' ?
          'bg-[#2A2724] border-[#4A4037]' :
          'bg-white border-blue-200'}`
          }>
          
              <div
            className="w-15 flex items-center justify-center shrink-0"
            style={{ background: discount.iconColor }}>
            
                <img
              src={discount.icon}
              alt={discount.title}
              className="w-full h-full object-contain p-2" />
            
              </div>

              <div className={`flex-1 p-4 relative ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`}>
                <div className="absolute top-3 right-3 flex items-center gap-2">
                  <button
                className="w-7 h-7 flex items-center justify-center bg-amber-100 hover:bg-amber-200 text-amber-700 rounded transition-colors"
                onClick={() => handleEditClick(discount)}>
                
                    <FaEdit className="w-3 h-3" />
                  </button>
                  <button
                className="w-7 h-7 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                onClick={() => handleDeleteClick(discount)}>
                
                    <FaTrash className="w-3 h-3" />
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer ml-1">
                    <input
                  type="checkbox"
                  checked={discount.status === 'active'}
                  onChange={() => handleToggleStatus(discount._id)}
                  className="sr-only peer" />
                
                    <div className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${discount.status === 'active' ?
                'bg-[#AD7F65] after:border-[#AD7F65]' :
                'bg-gray-200 after:border-gray-300'}`
                }></div>
                  </label>
                </div>

                <div className="flex items-center gap-2 mb-2 pr-32">
                  <h3
                className="text-xl font-bold"
                style={{ color: discount.status === 'inactive' ? '#6B7280' : theme === 'dark' ? '#C2A68C' : '#AD7F65' }}>
                
                    {discount.title}
                  </h3>
                  <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${discount.status === 'active' ?
                'bg-green-500 text-white' :
                'bg-gray-300 text-gray-600'}`
                }>
                
                    {discount.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <div className={`flex items-center gap-1.5 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      <FaTag className="text-yellow-500 text-sm" />
                      <span>
                        Discount Value: <span className="font-bold">{discount.discountValue}</span>
                      </span>
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      <FaCalendar className="text-purple-500 text-sm" />
                      <span>
                        Valid only from: {discount.validFrom === 'Permanent' ?
                    'Permanent' :
                    `${discount.validFrom} to ${discount.validTo}`}
                      </span>
                    </div>

                    {discount.description &&
                <div className={`text-xs italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>
                        {discount.description}
                      </div>
                }
                  </div>

                  <div className="flex-1 space-y-1 text-right">
                    <div className={`flex items-center justify-end gap-1.5 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      <span>
                        Applies to: <span className="font-bold">{discount.appliesTo}</span>
                      </span>
                      <FaBox className="text-blue-400 text-sm" />
                    </div>

                    {discount.usage &&
                <div className={`flex items-center justify-end gap-1.5 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        <span>
                          Used: <span className="font-bold">{discount.usage.used}/{discount.usage.total}</span> times
                        </span>
                        <FaUsers className="text-green-500 text-sm" />
                      </div>
                }
                  </div>
                </div>
              </div>
            </div>
        )}
        </div>
      }

      <AddDiscountModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingDiscount(null);
        }}
        onAdd={handleAddDiscount}
        onEdit={handleUpdateDiscount}
        discountToEdit={editingDiscount} />
      

      {}
      {showDeleteModal && discountToDelete &&
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`rounded-2xl w-full max-w-md relative shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <FaTrash className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Delete Discount</h2>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>This action cannot be undone</p>
                </div>
              </div>

              <div className={`p-4 rounded-lg mb-6 ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-gray-50'}`}>
                <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                  Are you sure you want to delete this discount?
                </p>
                <div className={`mt-3 p-3 rounded-lg border ${theme === 'dark' ? 'bg-[#1E1B18] border-gray-700' : 'bg-white border-gray-200'}`}>
                  <p className="font-semibold text-[#AD7F65]">{discountToDelete.title}</p>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    {discountToDelete.discountType === 'percentage' ?
                  `${discountToDelete.discountValue}% off` :
                  `₱${discountToDelete.discountValue} off`}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDiscountToDelete(null);
                }}
                className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${theme === 'dark' ?
                'bg-[#2A2724] text-gray-300 hover:bg-[#3A3734]' :
                'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
                }>
                
                  Cancel
                </button>
                <button
                onClick={confirmDelete}
                className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors shadow-lg">
                
                  Delete Discount
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

};

export default DiscountManagement;