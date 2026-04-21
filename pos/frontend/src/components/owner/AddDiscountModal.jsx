import { useCallback, useEffect, useMemo, useState } from 'react';
import { FaBox, FaCheck, FaSearch, FaTag, FaTimes } from 'react-icons/fa';
import { API_ENDPOINTS } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';

const AddDiscountModal = ({ isOpen, onClose, onAdd, onEdit, discountToEdit }) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    discountName: '',
    discountCode: '',
    discountCategory: 'promo_voucher',
    scope: 'entire_order',
    discountType: 'percentage',
    discountValue: '',
    appliesTo: 'all',
    category: '',
    subCategory: '',
    selectedProducts: [],
    validFrom: '',
    validUntil: '',
    noExpiration: false,
    minPurchaseAmount: '',
    maxPurchaseAmount: '',
    usageLimit: ''
  });

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState({});
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');
  const [tempSelectedProducts, setTempSelectedProducts] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.products);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setAllProducts(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.categories);
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        // Keep full category objects so we can map subcategories by `parentCategory`.
        setCategoryOptions(
          data.data.filter(
            (c) =>
              c &&
              typeof c?.name === 'string' &&
              c.name.trim() &&
              c.name !== 'All'
          )
        );
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

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
    "Others": ["Others"]
  };

  const defaultParentCategories = Object.keys(categoryStructure);
  const allKnownDefaultSubs = new Set(Object.values(categoryStructure).flat());
  const legacyParentCategories = ["Apparel", "Shoes", "Foods", "Accessories", "Makeup", "Head Wear", "Essentials"];

  const categories = useMemo(() => {
    const set = new Set();
    // Always include the full fixed parent list (so `Essentials` doesn't disappear when no product exists yet).
    defaultParentCategories.forEach((cat) => set.add(cat));

    // Add custom parent categories from the DB categories collection.
    // Mirror Add Product modal logic: filter by name sets (not by `type`) so dropdown options stay consistent.
    categoryOptions.forEach((c) => {
      const name = String(c?.name || '').trim();
      if (!name || name === 'All' || name === 'Others') return;
      if (defaultParentCategories.includes(name)) return;
      if (allKnownDefaultSubs.has(name)) return;
      if (legacyParentCategories.includes(name)) return;
      set.add(name);
    });

    // Include product categories as fallbacks, but exclude anything that is a known default subcategory.
    allProducts.forEach((p) => {
      const cat = String(p?.category || '').trim();
      if (!cat) return;
      if (allKnownDefaultSubs.has(cat)) return;
      set.add(cat);
    });

    if (discountToEdit?.category) set.add(String(discountToEdit.category).trim());
    if (formData.category) set.add(String(formData.category).trim());

    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [allProducts, categoryOptions, discountToEdit, formData.category]);

  const subCategoryOptions = useMemo(() => {
    const parentCat = String(formData.category || '').trim();
    if (!parentCat) return [];

    const defaultSubs = categoryStructure[parentCat] || [];

    // Custom subcategories tied to the selected parent category in the DB.
    const mappedCustomSubCategories = categoryOptions
      .filter((c) => c?.parentCategory === parentCat)
      .map((c) => c?.name)
      .filter((name) => typeof name === 'string' && name.trim() && name !== 'All');

    // Orphan/custom subcategories (not part of the fixed structure).
    const orphanCustomSubCategories = categoryOptions
      .map((c) => c?.name)
      .filter((name) => {
        if (typeof name !== 'string') return false;
        const trimmed = name.trim();
        if (!trimmed || trimmed === 'All' || trimmed === 'Others') return false;
        if (defaultParentCategories.includes(trimmed)) return false;
        if (allKnownDefaultSubs.has(trimmed)) return false;
        if (legacyParentCategories.includes(trimmed)) return false;
        return true;
      });

    const subs = [...defaultSubs, ...mappedCustomSubCategories, ...orphanCustomSubCategories];

    const selectedSub = String(formData.subCategory || '').trim();
    if (selectedSub && selectedSub !== '__add_new__' && !subs.includes(selectedSub)) {
      subs.push(selectedSub);
    }

    const editSub = String(discountToEdit?.subCategory || '').trim();
    const editCat = String(discountToEdit?.category || '').trim();
    if (editSub && editCat === parentCat && !subs.includes(editSub)) {
      subs.push(editSub);
    }

    return [...new Set(subs)].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [categoryOptions, defaultParentCategories, formData.category, formData.subCategory, discountToEdit, allKnownDefaultSubs, legacyParentCategories]);

  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setCurrentStep(1);
      setIsActive(discountToEdit?.status !== 'inactive');
      fetchProducts();
      fetchCategories();
      if (discountToEdit) {
        const parsedDiscountValue = (() => {
          const rawValue = discountToEdit.discountValue;
          if (rawValue === undefined || rawValue === null) return '';
          if (typeof rawValue === 'number') return String(rawValue);
          const matched = String(rawValue).match(/-?\d+(\.\d+)?/);
          return matched ? matched[0] : '';
        })();
        const appliesToValue = (() => {
          const rawAppliesTo = discountToEdit.appliesToType || discountToEdit.appliesTo || 'all';
          if (rawAppliesTo === 'all' || rawAppliesTo === 'category' || rawAppliesTo === 'products') return rawAppliesTo;
          const lower = String(rawAppliesTo).toLowerCase();
          if (lower.includes('category')) return 'category';
          if (lower.includes('specific products') || lower.includes('products')) return 'products';
          return 'all';
        })();
        setFormData({
          discountName: discountToEdit.discountName || discountToEdit.title || '',
          discountCode: discountToEdit.discountCode || '',
          discountCategory: discountToEdit.discountCategory || 'promo_voucher',
          scope: discountToEdit.scope || 'entire_order',
          discountType: discountToEdit.discountType || 'percentage',
          discountValue: parsedDiscountValue,
          appliesTo: appliesToValue,
          category: discountToEdit.category || '',
          subCategory: discountToEdit.subCategory || '',
          selectedProducts: discountToEdit.selectedProducts || [],
          validFrom: discountToEdit.validFrom && discountToEdit.validFrom !== 'Permanent' ? new Date(discountToEdit.validFrom).toISOString().split('T')[0] : '',
          validUntil: discountToEdit.validTo && discountToEdit.validTo !== 'Permanent' ? new Date(discountToEdit.validTo).toISOString().split('T')[0] : '',
          noExpiration: discountToEdit.noExpiration || false,
          minPurchaseAmount:
            discountToEdit.minPurchaseAmount !== undefined &&
            discountToEdit.minPurchaseAmount !== null
              ? String(discountToEdit.minPurchaseAmount)
              : '',
          maxPurchaseAmount:
            discountToEdit.maxPurchaseAmount !== undefined &&
            discountToEdit.maxPurchaseAmount !== null
              ? String(discountToEdit.maxPurchaseAmount)
              : '',
          usageLimit: discountToEdit.usageLimit || ''
        });
      } else {
        setFormData({
          discountName: '',
          discountCode: '',
          discountCategory: 'promo_voucher',
          scope: 'entire_order',
          discountType: 'percentage',
          discountValue: '',
          appliesTo: 'all',
          category: '',
          subCategory: '',
          selectedProducts: [],
          validFrom: '',
          validUntil: '',
          noExpiration: false,
          minPurchaseAmount: '',
          maxPurchaseAmount: '',
          usageLimit: ''
        });
      }
    }
  }, [isOpen, discountToEdit, fetchProducts, fetchCategories]);

  const isSeniorOrPwd =
    formData.discountCategory === 'senior_citizen' ||
    formData.discountCategory === 'pwd';

  const ensureCategoryRules = (data) => {
    if (!data) return data;
    if (
      data.discountCategory === 'senior_citizen' ||
      data.discountCategory === 'pwd'
    ) {
      return {
        ...data,
        scope: 'per_item',
        discountType: 'percentage',
        discountValue: '20'
      };
    }
    return data;
  };

  const getStepErrors = (step, rawData) => {
    const data = ensureCategoryRules(rawData);
    const nextErrors = {};

    if (step === 1) {
      if (!String(data.discountName || '').trim()) nextErrors.discountName = 'Discount name is required.';
      if (!String(data.discountCategory || '').trim()) nextErrors.discountCategory = 'Discount category is required.';
      if (!String(data.discountType || '').trim()) nextErrors.discountType = 'Discount type is required.';
      const numVal = parseFloat(String(data.discountValue).replace(/,/g, ''));
      if (String(data.discountValue || '').trim() === '' || Number.isNaN(numVal) || numVal < 0) {
        nextErrors.discountValue = 'Discount value is required.';
      } else if (data.discountType === 'percentage' && numVal > 100) {
        nextErrors.discountValue = 'Percentage discount cannot exceed 100%.';
      }
    }

    if (step === 2) {
      if (!String(data.scope || '').trim()) nextErrors.scope = 'Apply Discount to is required.';
      if (!String(data.appliesTo || '').trim()) nextErrors.appliesTo = 'Applies to is required.';
      if (data.appliesTo === 'category' && !String(data.category || '').trim()) nextErrors.category = 'Please select a category.';
      if (data.appliesTo === 'products' && (!Array.isArray(data.selectedProducts) || data.selectedProducts.length === 0)) {
        nextErrors.selectedProducts = 'Please select at least one product.';
      }
    }

    return nextErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const preparedForm = {
      ...ensureCategoryRules(formData),
      status: isActive ? 'active' : 'inactive'
    };
    if (preparedForm.appliesTo === 'category' && !preparedForm.category) {
      alert('Please select a category');
      return;
    }
    if (preparedForm.appliesTo === 'products' && preparedForm.selectedProducts.length === 0) {
      alert('Please select at least one product');
      return;
    }
    const numVal = parseFloat(String(preparedForm.discountValue).replace(/,/g, ''));
    if (Number.isNaN(numVal) || numVal < 0) {
      alert('Please enter a valid discount value');
      return;
    }
    if (preparedForm.discountType === 'percentage' && numVal > 100) {
      alert('Percentage discount cannot exceed 100%.');
      return;
    }
    const minPurchase = preparedForm.minPurchaseAmount
      ? parseFloat(String(preparedForm.minPurchaseAmount).replace(/,/g, ''))
      : NaN;
    const maxPurchase =
      preparedForm.maxPurchaseAmount === '' ||
      preparedForm.maxPurchaseAmount === null ||
      preparedForm.maxPurchaseAmount === undefined
        ? null
        : parseFloat(String(preparedForm.maxPurchaseAmount).replace(/,/g, ''));
    if (maxPurchase != null && !Number.isNaN(maxPurchase) && maxPurchase < 0) {
      alert('Maximum purchase amount cannot be negative.');
      return;
    }
    if (
      maxPurchase != null &&
      !Number.isNaN(maxPurchase) &&
      !Number.isNaN(minPurchase) &&
      minPurchase > 0 &&
      maxPurchase < minPurchase
    ) {
      alert(
        'Maximum purchase amount must be greater than or equal to minimum purchase amount.'
      );
      return;
    }
    if (discountToEdit) {
      onEdit(discountToEdit._id, preparedForm);
    } else {
      onAdd(preparedForm);
    }
    onClose();
  };

  const handleNextFromStep1 = () => {
    const stepErrors = getStepErrors(1, formData);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setErrors({});
    setCurrentStep(2);
  };

  const handleNextFromStep2 = () => {
    const stepErrors = getStepErrors(2, formData);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setErrors({});
    setCurrentStep(3);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
      return;
    }
    if (name === 'discountType') {
      if (isSeniorOrPwd && value !== 'percentage') return;
      setFormData((prev) => {
        const next = { ...prev, discountType: value };
        if (value === 'percentage' && prev.discountValue !== '') {
          const n = parseFloat(String(prev.discountValue).replace(/,/g, ''));
          if (!Number.isNaN(n) && n > 100) {
            next.discountValue = '100';
          }
        }
        return next;
      });
      return;
    }
    if (name === 'discountCategory') {
      setFormData((prev) => ensureCategoryRules({ ...prev, discountCategory: value }));
      return;
    }
    if (name === 'scope') {
      if (isSeniorOrPwd && value !== 'per_item') return;
      setFormData((prev) => ({ ...prev, scope: value }));
      return;
    }
    if (name === 'discountValue') {
      if (isSeniorOrPwd) {
        setFormData((prev) => ({ ...prev, discountValue: '20' }));
        return;
      }
      setFormData((prev) => {
        if (prev.discountType !== 'percentage') {
          return { ...prev, discountValue: value };
        }
        if (value === '') {
          return { ...prev, discountValue: '' };
        }
        const n = parseFloat(String(value).replace(/,/g, ''));
        if (Number.isNaN(n)) {
          return { ...prev, discountValue: value };
        }
        const clamped = Math.min(100, Math.max(0, n));
        return { ...prev, discountValue: String(clamped) };
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      ...(name === 'category' ? { subCategory: '' } : {}),
      [name]: value
    }));
  };

  const openProductPicker = () => {
    setTempSelectedProducts([...formData.selectedProducts]);
    setProductSearch('');
    setProductCategoryFilter('All');
    setShowProductPicker(true);
  };

  const toggleProductSelection = (product) => {
    setTempSelectedProducts((prev) => {
      const exists = prev.find((p) => p._id === product._id);
      if (exists) {
        return prev.filter((p) => p._id !== product._id);
      }
      return [...prev, {
        _id: product._id,
        itemName: product.itemName,
        sku: product.sku,
        itemImage: product.itemImage,
        category: product.category,
        brandName: product.brandName
      }];
    });
  };

  const confirmProductSelection = () => {
    setFormData((prev) => ({
      ...prev,
      selectedProducts: tempSelectedProducts
    }));
    setShowProductPicker(false);
  };

  const removeSelectedProduct = (productId) => {
    setFormData((prev) => ({
      ...prev,
      selectedProducts: prev.selectedProducts.filter((p) => p._id !== productId)
    }));
  };

  const isDark = theme === 'dark';
  const stepTitleClass = (step) =>
    `w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
      currentStep >= step
        ? 'bg-[#16A34A] border-[#16A34A] text-white'
        : isDark
          ? 'border-gray-600 text-gray-400'
          : 'border-gray-400 text-gray-500'
    }`;
  const inputClass = `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${isDark ?
  'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500' :
  'bg-white border-gray-300 text-gray-900'}`;
  const labelClass = `text-xs font-bold uppercase tracking-wide mb-1 block ${isDark ? 'text-gray-400' : 'text-gray-500'}`;

  if (!isOpen) return null;


  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center z-[10002] p-4 backdrop-blur-sm">
        <div className={`rounded-2xl w-full max-w-[760px] max-h-[92vh] overflow-hidden shadow-2xl flex flex-col ${isDark ? 'bg-[#2A2724]' : 'bg-white'}`}>
          <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
                <FaTag className="text-white w-3.5 h-3.5" />
              </div>
              <h2 className={`text-[24px] leading-none font-bold ${isDark ? 'text-white' : 'text-black'}`}>
                {discountToEdit ? 'Edit Discount' : 'Create New Discount'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="px-6 pt-5 pb-3">
              <div className="mb-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={stepTitleClass(1)}>1</div>
                    <span className={`text-xs ${currentStep >= 1 ? 'text-[#16A34A] font-semibold' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>Discount Info</span>
                  </div>
                  <div className={`w-12 h-[2px] border-t border-dashed ${currentStep >= 2 ? 'border-[#16A34A]' : isDark ? 'border-gray-600' : 'border-gray-300'}`} />
                  <div className="flex items-center gap-2">
                    <div className={stepTitleClass(2)}>2</div>
                    <span className={`text-xs ${currentStep >= 2 ? 'text-[#16A34A] font-semibold' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>Rules & Limits</span>
                  </div>
                  <div className={`w-12 h-[2px] border-t border-dashed ${currentStep >= 3 ? 'border-[#16A34A]' : isDark ? 'border-gray-600' : 'border-gray-300'}`} />
                  <div className="flex items-center gap-2">
                    <div className={stepTitleClass(3)}>3</div>
                    <span className={`text-xs ${currentStep >= 3 ? 'text-[#16A34A] font-semibold' : isDark ? 'text-gray-400' : 'text-gray-500'}`}>Review & Save</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 pb-4 flex-1 overflow-y-auto">

              {currentStep === 1 && (
                <div>
                  <h3 className={`text-[16px] font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-700'}`}>Basic Info</h3>

                  <div className="space-y-4 max-w-[860px]">
                    <div>
                      <label className={labelClass}>
                        Discount Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="discountName"
                        value={formData.discountName}
                        onChange={handleChange}
                        placeholder="e.g ANNIVERSARY SALE"
                        className={inputClass}
                        required />
                      {errors.discountName && <p className="text-[11px] text-red-500 mt-1">{errors.discountName}</p>}
                      
                    </div>

                    <div>
                      <label className={labelClass}>
                        <span>Discount Code</span>
                      </label>
                      <input
                        type="text"
                        name="discountCode"
                        value={formData.discountCode}
                        onChange={handleChange}
                        placeholder="e.g DRESS10"
                        className={inputClass} />
                      
                    </div>

                    <div>
                      <label className={labelClass}>
                        Discount Category <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="discountCategory" value="promo_voucher" checked={formData.discountCategory === 'promo_voucher'} onChange={handleChange} className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Promo / Voucher</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="discountCategory" value="senior_citizen" checked={formData.discountCategory === 'senior_citizen'} onChange={handleChange} className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Senior Citizen Discount</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="discountCategory" value="pwd" checked={formData.discountCategory === 'pwd'} onChange={handleChange} className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>PWD Discount</span>
                        </label>
                      </div>
                      {errors.discountCategory && <p className="text-[11px] text-red-500 mt-1">{errors.discountCategory}</p>}
                      {isSeniorOrPwd && (
                        <div className={`mt-3 rounded-lg border p-3 text-sm ${isDark ? 'bg-blue-900/20 border-blue-700 text-blue-200' : 'bg-blue-100 border-blue-400 text-[#0F3E68]'}`}>
                          <p className="font-semibold mb-1">
                            {formData.discountCategory === 'senior_citizen' ? 'Senior' : 'PWD'} rules (auto-applied):
                          </p>
                          <p>&#10003; VAT Exempt</p>
                          <p>&#10003; 20% Discount</p>
                          <p>&#10003; Applies per item only</p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className={`text-[16px] font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-700'}`}>Discount Value</p>
                      <label className={labelClass}>
                        Discount Type <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="discountType"
                            value="percentage"
                            checked={formData.discountType === 'percentage'}
                            onChange={handleChange}
                            disabled={isSeniorOrPwd}
                            className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Percentage</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="discountType"
                            value="fixed"
                            checked={formData.discountType === 'fixed'}
                            onChange={handleChange}
                            disabled={isSeniorOrPwd}
                            className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Fixed Amount</span>
                        </label>
                      </div>
                      {errors.discountType && <p className="text-[11px] text-red-500 mt-1">{errors.discountType}</p>}
                    </div>

                    <div>
                      <label className={labelClass}>
                        Discount Value <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          name="discountValue"
                          value={formData.discountValue}
                          onChange={handleChange}
                          disabled={isSeniorOrPwd}
                          min={0}
                          max={formData.discountType === 'percentage' ? 100 : undefined}
                          step="any"
                          placeholder="e.g 15"
                          className={`flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${isDark ?
                          'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500' :
                          'bg-white border-gray-300 text-gray-900'}`
                          }
                          required />
                        
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-black'}`}>
                          {formData.discountType === 'percentage' ? '% OFF' : '₱ OFF'}
                        </span>
                      </div>
                      {formData.discountType === 'percentage' &&
                        <p className={`text-[11px] mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          Maximum 100%.
                        </p>
                      }
                      {errors.discountValue && <p className="text-[11px] text-red-500 mt-1">{errors.discountValue}</p>}
                    </div>

                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className={`text-[16px] font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-700'}`}>Scope</h3>
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>
                          Applies Discount to <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="scope" value="entire_order" checked={formData.scope === 'entire_order'} onChange={handleChange} disabled={isSeniorOrPwd} className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Entire Order/Cart</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="scope" value="per_item" checked={formData.scope === 'per_item'} onChange={handleChange} className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Per Item</span>
                          </label>
                        </div>
                        {errors.scope && <p className="text-[11px] text-red-500 mt-1">{errors.scope}</p>}
                        {isSeniorOrPwd && (
                          <div className={`mt-2 rounded-md border px-3 py-2 text-sm ${isDark ? 'bg-blue-900/20 border-blue-700 text-blue-200' : 'bg-blue-100 border-blue-400 text-[#0F3E68]'}`}>
                            Senior/PWD is automatically set to Per Item.
                          </div>
                        )}
                      </div>

                      <div>
                      <label className={labelClass}>
                        Applies to <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="appliesTo"
                            value="all"
                            checked={formData.appliesTo === 'all'}
                            onChange={handleChange}
                            className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>All Products</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="appliesTo"
                            value="category"
                            checked={formData.appliesTo === 'category'}
                            onChange={handleChange}
                            className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Specific Category</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="appliesTo"
                            value="products"
                            checked={formData.appliesTo === 'products'}
                            onChange={handleChange}
                            className="w-4 h-4 text-[#AD7F65] focus:ring-[#AD7F65]" />
                          
                          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Specific Products</span>
                        </label>
                      </div>
                      {errors.appliesTo && <p className="text-[11px] text-red-500 mt-1">{errors.appliesTo}</p>}
                      {formData.appliesTo === 'category' &&
                      <div className="mt-3">
                          <label className={labelClass}>
                            Select Category <span className="text-red-500">*</span>
                          </label>
                          <select
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          className={inputClass}
                          required={formData.appliesTo === 'category'}>
                          
                            <option value="">Select a category</option>
                            {categories.map((cat) =>
                          <option key={cat} value={cat}>{cat}</option>
                          )}
                          </select>
                          {subCategoryOptions.length > 0 && (
                            <div className="mt-3">
                              <label className={labelClass}>
                                Select Subcategory
                              </label>
                              <select
                                name="subCategory"
                                value={formData.subCategory || ''}
                                onChange={handleChange}
                                className={inputClass}>
                                <option value="">All in selected category</option>
                                {subCategoryOptions.map((sub) => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          {errors.category && <p className="text-[11px] text-red-500 mt-1">{errors.category}</p>}
                        </div>
                      }
                      {formData.appliesTo === 'products' &&
                      <div className="mt-3">
                          <label className={labelClass}>
                            Products <span className="text-red-500">*</span>
                          </label>
                          <button
                          type="button"
                          onClick={openProductPicker}
                          className={`w-full px-4 py-3 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 transition-all hover:border-[#AD7F65] ${isDark ?
                          'border-gray-600 text-gray-300 hover:bg-[#352F2A]' :
                          'border-gray-300 text-gray-600 hover:bg-[#FDF7F1]'}`
                          }>
                          
                            <FaBox className="text-[#AD7F65]" />
                            <span className="font-medium">
                              Select Products
                              {formData.selectedProducts.length > 0 &&
                            <span className="ml-2 px-2 py-0.5 text-xs font-bold text-white bg-[#AD7F65] rounded-full">
                                  {formData.selectedProducts.length}
                                </span>
                            }
                            </span>
                          </button>

                          {formData.selectedProducts.length > 0 &&
                        <div className="mt-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                              {formData.selectedProducts.map((product) =>
                          <span
                            key={product._id}
                            className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-medium ${isDark ?
                            'bg-[#352F2A] text-gray-200 border border-gray-600' :
                            'bg-[#FDF7F1] text-[#76462B] border border-[#E8D5C8]'}`
                            }>
                            
                                  {product.itemImage &&
                            <img
                              src={product.itemImage}
                              alt=""
                              className="w-4 h-4 rounded-full object-cover" />

                            }
                                  <span className="max-w-[120px] truncate">{product.itemName}</span>
                                  <button
                              type="button"
                              onClick={() => removeSelectedProduct(product._id)}
                              className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors">
                              
                                    <FaTimes className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                          )}
                            </div>
                        }
                        {errors.selectedProducts && <p className="text-[11px] text-red-500 mt-1">{errors.selectedProducts}</p>}
                        </div>
                      }
                    </div>

                    <div>
                      <label className={labelClass}>Validity Period</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Valid from
                          </label>
                          <input
                            type="date"
                            name="validFrom"
                            value={formData.validFrom}
                            onChange={handleChange}
                            disabled={formData.noExpiration}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${isDark ?
                            'bg-[#1E1B18] border-gray-600 text-white' :
                            'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100'}`
                            } />
                          
                        </div>
                        <div>
                          <label className={`text-xs font-medium block mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Valid until
                          </label>
                          <input
                            type="date"
                            name="validUntil"
                            value={formData.validUntil}
                            onChange={handleChange}
                            disabled={formData.noExpiration}
                            className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${isDark ?
                            'bg-[#1E1B18] border-gray-600 text-white' :
                            'bg-white border-gray-300 text-gray-900 disabled:bg-gray-100'}`
                            } />
                          
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="noExpiration"
                          checked={formData.noExpiration}
                          onChange={handleChange}
                          className="w-4 h-4 text-[#AD7F65] rounded focus:ring-[#AD7F65]" />
                        
                        <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>No expiration date</span>
                      </label>
                    </div>
                  </div>
                </div>

                  <div>
                  <h3 className={`text-[16px] font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-700'}`}>Purchase Conditions</h3>

                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>
                        <span>Minimum Purchase Amount</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600">₱</span>
                        <input
                          type="number"
                          name="minPurchaseAmount"
                          value={formData.minPurchaseAmount}
                          onChange={handleChange}
                          step="0.01"
                          className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${isDark ? 'bg-[#1E1B18] border-gray-600 text-white' : 'border-gray-300 bg-white'}`} />
                        
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Customer must spend at least this amount</p>
                    </div>

                    <div>
                      <label className={labelClass}>
                        <span>Maximum Purchase Amount</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600">₱</span>
                        <input
                          type="number"
                          name="maxPurchaseAmount"
                          value={formData.maxPurchaseAmount}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${isDark ? 'bg-[#1E1B18] border-gray-600 text-white placeholder-gray-500' : 'border-gray-300 bg-white placeholder-gray-400'}`} />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Discount applies only when eligible cart total is at or below this amount (leave empty for no limit)
                      </p>
                    </div>

                    <div>
                      <label className={labelClass}>
                        <span>Usage Limit</span>
                      </label>
                      <input
                        type="number"
                        name="usageLimit"
                        value={formData.usageLimit}
                        onChange={handleChange}
                        min="0"
                        className={inputClass} />
                      
                      <p className="text-[11px] text-gray-400 mt-1">Total number of times this discount can be used</p>
                    </div>

                    <div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>Make this discount active?</span>
                        <span className="relative inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                            className="sr-only peer"
                          />
                          <span className={`w-11 h-6 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${
                            isActive ? 'bg-[#AD7F65] after:border-[#AD7F65]' : 'bg-gray-200 after:border-gray-300'
                          }`} />
                        </span>
                      </label>
                    </div>

                  </div>
                </div>
              </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className={`text-[16px] font-semibold ${isDark ? 'text-white' : 'text-gray-700'}`}>Review & Save</h3>
                  <div className={`rounded-xl border p-5 ${isDark ? 'bg-[#1E1B18] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-[32px] font-extrabold leading-none">
                          {formData.discountName || '-'}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-4 py-1 rounded-full text-sm font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <p><span className="text-gray-500">Discount Value:</span> <span className="font-semibold">{formData.discountValue || '-'}{formData.discountValue !== '' ? (formData.discountType === 'percentage' ? '% Off' : ' PHP Off') : ''}</span></p>
                      <p><span className="text-gray-500">Valid only from:</span> <span className="font-semibold">{formData.validFrom || '-'}</span></p>
                      <p><span className="text-gray-500">Applies to:</span> <span className="font-semibold">{formData.appliesTo === 'all' ? 'All Products' : formData.appliesTo === 'category' ? 'Specific Category' : 'Specific Products'}</span></p>
                      <p><span className="text-gray-500">Used:</span> <span className="font-semibold">{formData.usageLimit ? `0 / ${formData.usageLimit}` : '0 / Unlimited'}</span></p>
                    </div>
                  </div>

                  <div className={`rounded-xl border p-5 ${isDark ? 'bg-[#1E1B18] border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Discount Name:</span> <span className="font-semibold">{formData.discountName || '-'}</span></p>
                        <p><span className="text-gray-500">Discount Code:</span> <span className="font-semibold">{formData.discountCode || '-'}</span></p>
                        <p><span className="text-gray-500">Discount Category:</span> <span className="font-semibold">{formData.discountCategory === 'promo_voucher' ? 'Promo / Voucher' : formData.discountCategory === 'senior_citizen' ? 'Senior Citizen' : 'PWD'}</span></p>
                        <p><span className="text-gray-500">Value:</span> <span className="font-semibold">{formData.discountValue || '-'}{formData.discountValue !== '' ? (formData.discountType === 'percentage' ? '% Off' : ' PHP Off') : ''}</span></p>
                        <p><span className="text-gray-500">Scope:</span> <span className="font-semibold">{formData.scope === 'per_item' ? 'Per item' : 'Entire Order'}</span></p>
                        <p><span className="text-gray-500">Applies to:</span> <span className="font-semibold">{formData.appliesTo === 'all' ? 'All Products' : formData.appliesTo === 'category' ? 'Specific Category' : 'Specific Products'}</span></p>
                        {formData.appliesTo === 'category' && (
                          <p><span className="text-gray-500">Category:</span> <span className="font-semibold">{formData.category || '-'}</span></p>
                        )}
                        {formData.appliesTo === 'category' && (
                          <p><span className="text-gray-500">Subcategory:</span> <span className="font-semibold">{formData.subCategory || '-'}</span></p>
                        )}
                        {formData.appliesTo === 'products' && (
                          <div>
                            <p><span className="text-gray-500">Selected Products:</span></p>
                            <p className="font-semibold">
                              {formData.selectedProducts.length > 0
                                ? formData.selectedProducts.map((product) => product.itemName).join(', ')
                                : '-'}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p><span className="text-gray-500">Minimum:</span> <span className="font-semibold">{formData.minPurchaseAmount || '-'}</span></p>
                        <p><span className="text-gray-500">Maximum:</span> <span className="font-semibold">{formData.maxPurchaseAmount || '-'}</span></p>
                        <p><span className="text-gray-500">Usage Limit:</span> <span className="font-semibold">{formData.usageLimit || '-'}</span></p>
                        <p><span className="text-gray-500">Validity:</span> <span className="font-semibold">{formData.noExpiration ? 'Permanent' : (formData.validFrom && formData.validUntil ? `${formData.validFrom} - ${formData.validUntil}` : '-')}</span></p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
              {currentStep === 1 && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`px-10 py-2.5 rounded-xl font-bold border transition-all ${isDark ? 'border-gray-600 text-gray-300 hover:bg-[#352F2A]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromStep1}
                    className="px-10 py-2.5 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                    style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
                    Continue
                  </button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setCurrentStep(1);
                    }}
                    className={`px-10 py-2.5 rounded-xl font-bold border transition-all ${isDark ? 'border-gray-600 text-gray-300 hover:bg-[#352F2A]' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromStep2}
                    className="px-10 py-2.5 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                    style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}>
                    Continue
                  </button>
                </div>
              )}

              {currentStep === 3 && (
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setCurrentStep(2);
                    }}
                    className={`px-10 py-2.5 rounded-xl font-bold border transition-all ${isDark ? 'border-gray-600 text-gray-300 hover:bg-[#352F2A]' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-10 py-2.5 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                    }}>
                    {discountToEdit ? 'Update Discount' : 'Add New Discount'}
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {}
      {showProductPicker &&
      <ProductPickerModal
        isDark={isDark}
        allProducts={allProducts}
        productsLoading={productsLoading}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        productCategoryFilter={productCategoryFilter}
        setProductCategoryFilter={setProductCategoryFilter}
        categories={categories}
        tempSelectedProducts={tempSelectedProducts}
        toggleProductSelection={toggleProductSelection}
        confirmProductSelection={confirmProductSelection}
        onClose={() => setShowProductPicker(false)} />

      }
    </>);

};


const ProductPickerModal = ({
  isDark,
  allProducts,
  productsLoading,
  productSearch,
  setProductSearch,
  productCategoryFilter,
  setProductCategoryFilter,
  categories,
  tempSelectedProducts,
  toggleProductSelection,
  confirmProductSelection,
  onClose
}) => {
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const matchesSearch = !productSearch ||
      product.itemName?.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.sku?.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.brandName?.toLowerCase().includes(productSearch.toLowerCase());

      const matchesCategory = productCategoryFilter === 'All' ||
      product.category === productCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [allProducts, productSearch, productCategoryFilter]);

  const isSelected = useCallback((productId) => {
    return tempSelectedProducts.some((p) => p._id === productId);
  }, [tempSelectedProducts]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[10003] p-4 backdrop-blur-sm bg-black/30">
      <div className={`rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col ${isDark ? 'bg-[#2A2724]' : 'bg-white'}`}>
        {}
        <div
          className="h-2"
          style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }} />
        
        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>
              Select Products
            </h3>
            <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {tempSelectedProducts.length} product{tempSelectedProducts.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {}
        <div className={`px-6 py-3 flex gap-3 border-b ${isDark ? 'border-gray-700 bg-[#1E1B18]' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex-1 relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search by name, SKU, or brand..."
              className={`w-full pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent text-sm ${isDark ?
              'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500' :
              'bg-white border-gray-300 text-gray-900'}`
              }
              autoFocus />
            
          </div>
          <select
            value={productCategoryFilter}
            onChange={(e) => setProductCategoryFilter(e.target.value)}
            className={`px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent text-sm min-w-[150px] ${isDark ?
            'bg-[#2A2724] border-gray-600 text-white' :
            'bg-white border-gray-300 text-gray-900'}`
            }>
            
            <option value="All">All Categories</option>
            {categories.map((cat) =>
            <option key={cat} value={cat}>{cat}</option>
            )}
          </select>
        </div>

        {}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {productsLoading ?
          <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#AD7F65] border-t-transparent" />
              <span className={`ml-3 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading products...</span>
            </div> :
          filteredProducts.length === 0 ?
          <div className="flex flex-col items-center justify-center py-16">
              <FaBox className={`w-12 h-12 mb-3 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No products found</p>
            </div> :

          <div className="grid grid-cols-1 gap-2">
              {filteredProducts.map((product) => {
              const selected = isSelected(product._id);
              return (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => toggleProductSelection(product)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border transition-all text-left ${selected ?
                  isDark ?
                  'border-[#AD7F65] bg-[#352F2A] shadow-sm' :
                  'border-[#AD7F65] bg-[#FDF7F1] shadow-sm' :
                  isDark ?
                  'border-gray-700 hover:border-gray-500 hover:bg-[#352F2A]' :
                  'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`
                  }>
                  
                    {}
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${selected ?
                  'bg-[#AD7F65] border-[#AD7F65]' :
                  isDark ? 'border-gray-500' : 'border-gray-300'}`
                  }>
                      {selected && <FaCheck className="w-3 h-3 text-white" />}
                    </div>

                    {}
                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden ${isDark ? 'bg-[#1E1B18]' : 'bg-gray-100'}`}>
                      {product.itemImage ?
                    <img src={product.itemImage} alt="" className="w-full h-full object-cover" /> :

                    <div className="w-full h-full flex items-center justify-center">
                          <FaBox className={`w-4 h-4 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                        </div>
                    }
                    </div>

                    {}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {product.itemName}
                      </p>
                      <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {product.sku || 'No SKU'}
                        {product.brandName ? ` · ${product.brandName}` : ''}
                      </p>
                    </div>

                    {}
                    <span className={`text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${isDark ?
                  'bg-[#1E1B18] text-gray-400' :
                  'bg-gray-100 text-gray-500'}`
                  }>
                      {product.category || 'Uncategorized'}
                    </span>
                  </button>);

            })}
            </div>
          }
        </div>

        {}
        <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''} shown
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${isDark ?
              'border-gray-600 text-gray-300 hover:bg-[#352F2A]' :
              'border-gray-300 text-gray-600 hover:bg-gray-50'}`
              }>
              
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmProductSelection}
              className="px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-all hover:shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)'
              }}>
              
              Confirm Selection ({tempSelectedProducts.length})
            </button>
          </div>
        </div>
      </div>
    </div>);

};

export default AddDiscountModal;