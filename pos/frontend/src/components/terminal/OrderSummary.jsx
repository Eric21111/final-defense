import { useEffect, useRef, useState } from 'react';
import { FaMinus, FaPlus, FaTag, FaTimes } from 'react-icons/fa';
import { HiDocumentRemove } from 'react-icons/hi';
import { MdCategory } from 'react-icons/md';
import cashIcon from '../../assets/cash.svg';
import qrIcon from '../../assets/qr.png';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import RemoveItemPinModal from './RemoveItemPinModal';
import VoidTransactionModal from './VoidTransactionModal';

const OrderSummary = ({
  cart,
  removeFromCart,
  removeFromCartDirect,
  updateQuantity,
  discountAmount,
  setDiscountAmount,
  selectedDiscounts = [],
  onRemoveDiscount,
  calculateSubtotal,
  calculateDiscount,
  calculateTotal,
  handleCheckout,
  onCashPayment,
  onQRPayment,
  onOpenDiscountModal,
  onSelectDiscount,
  products = []
}) => {
  const { theme } = useTheme();
  const { currentUser } = useAuth();
  const userId = currentUser?._id || currentUser?.id || currentUser?.email || 'guest';
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [itemsToVoid, setItemsToVoid] = useState([]);
  const [isBulkVoid, setIsBulkVoid] = useState(false);
  const isProcessingVoidRef = useRef(false);
  // Track pending quantity changes per item (key: item._id + selectedSize)
  const [pendingQuantities, setPendingQuantities] = useState({});
  const [availableDiscounts, setAvailableDiscounts] = useState([]);

  // Fetch discounts on mount for auto-apply functionality
  useEffect(() => {
    const fetchDiscounts = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/discounts');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setAvailableDiscounts(data.data.filter(d => d.status === 'active'));
        }
      } catch (error) {
        console.error('Error fetching discounts for auto-apply:', error);
      }
    };
    fetchDiscounts();
  }, []);

  // Auto-apply discount when code matches
  useEffect(() => {
    if (!discountCode || !discountCode.trim() || applyingDiscount) return;

    const codeToFind = discountCode.trim().toLowerCase();
    const matchingDiscount = availableDiscounts.find(discount =>
      (discount.discountCode || '').trim().toLowerCase() === codeToFind
    );

    if (matchingDiscount) {
      // Check if already applied to avoid loops
      const isAlreadyApplied = selectedDiscounts.some(d => d._id === matchingDiscount._id);

      if (!isAlreadyApplied) {
        if (onSelectDiscount) {
          onSelectDiscount(matchingDiscount);
          setDiscountCode('');
        }
      }
    }
  }, [discountCode, availableDiscounts, selectedDiscounts, applyingDiscount, onSelectDiscount]);

  const handleProceed = () => {
    if (selectedPaymentMethod === 'cash' && onCashPayment) {
      onCashPayment();
    } else if (selectedPaymentMethod === 'qr' && onQRPayment) {
      onQRPayment();
    } else {
      handleCheckout();
    }
  };

  // Get unique key for an item
  const getItemKey = (item) => {
    return `${item._id || item.productId}-${item.selectedSize || item.size || ''}`;
  };

  // Get the displayed quantity (pending or actual)
  const getDisplayQuantity = (item) => {
    const key = getItemKey(item);
    return pendingQuantities[key] !== undefined ? pendingQuantities[key] : item.quantity;
  };

  // Check if item has pending changes
  const hasPendingChange = (item) => {
    const key = getItemKey(item);
    return pendingQuantities[key] !== undefined && pendingQuantities[key] !== item.quantity;
  };

  // Handle minus click - decrease pending quantity
  const handleMinusClick = (item) => {
    const key = getItemKey(item);
    const currentPending = pendingQuantities[key] !== undefined ? pendingQuantities[key] : item.quantity;

    if (currentPending > 1) {
      setPendingQuantities(prev => ({
        ...prev,
        [key]: currentPending - 1
      }));
    }
  };

  // Handle plus click for pending quantity
  const handlePlusClickPending = (item) => {
    const key = getItemKey(item);
    const currentPending = pendingQuantities[key] !== undefined ? pendingQuantities[key] : item.quantity;

    // Check max stock
    let maxQty = item.currentStock;
    if (item.selectedSize && item.sizes && item.sizes[item.selectedSize] !== undefined) {
      const sizeData = item.sizes[item.selectedSize];
      maxQty = typeof sizeData === 'object' && sizeData !== null && sizeData.quantity !== undefined
        ? sizeData.quantity
        : (typeof sizeData === 'number' ? sizeData : 0);
    }

    if (!maxQty || currentPending < maxQty) {
      setPendingQuantities(prev => ({
        ...prev,
        [key]: currentPending + 1
      }));
    }
  };

  // Cancel pending change
  const handleCancelPending = (item) => {
    const key = getItemKey(item);
    setPendingQuantities(prev => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const handleConfirmPending = (item) => {
    const key = getItemKey(item);
    const pendingQty = pendingQuantities[key];

    if (pendingQty < item.quantity) {
      // Reducing quantity - need PIN verification for void
      const voidQuantity = item.quantity - pendingQty;
      const voidTotalAmount = item.itemPrice * voidQuantity;
      setItemToRemove({
        ...item,
        voidQuantity: voidQuantity,
        newQuantity: pendingQty,
        // Set itemPrice to total void amount for display in modal
        itemPrice: voidTotalAmount,
        // Keep original unit price for void log
        originalUnitPrice: item.itemPrice
      });
      setIsRemoveModalOpen(true);
    } else if (pendingQty > item.quantity) {
      // Increasing quantity - no PIN needed
      updateQuantity(item, pendingQty);
      handleCancelPending(item);
    }
  };

  // Helper to calculate total discount percentage for an item
  const getItemTotalDiscountPercent = (item) => {
    if (!selectedDiscounts || selectedDiscounts.length === 0) return 0;

    let totalPercent = 0;

    // Resolve item category (same logic as Terminal.jsx)
    let itemCategory = item.category;
    if (!itemCategory && products.length > 0) {
      const productId = item._id || item.productId || item.id;
      const product = products.find(p => {
        const pId = p._id || p.id;
        return (pId && productId && (pId.toString() === productId.toString()));
      });
      itemCategory = product?.category;
    }

    selectedDiscounts.forEach(discount => {
      // Check if discount applies
      const appliesToType = discount.appliesToType || discount.appliesTo;
      let applies = false;

      if (appliesToType === 'all') {
        applies = true;
      } else if (appliesToType === 'category' && discount.category) {
        if (itemCategory === discount.category) {
          applies = true;
        }
      } else if (appliesToType === 'products' && discount.productIds && discount.productIds.length > 0) {
        const itemId = item._id || item.productId || item.id;
        const isMatch = discount.productIds.some(pid => {
          const pidStr = pid.toString ? pid.toString() : pid;
          const itemIdStr = itemId.toString ? itemId.toString() : itemId;
          return pidStr === itemIdStr;
        });
        if (isMatch) applies = true;
      }

      if (applies) {
        // Extract percentage
        const discountValueStr = discount.discountValue || '';
        if (typeof discountValueStr === 'string' && discountValueStr.includes('%')) {
          const percentage = parseFloat(discountValueStr.replace('% OFF', '').replace(/\s/g, ''));
          if (!isNaN(percentage)) {
            totalPercent += percentage;
          }
        }
      }
    });

    return totalPercent;
  };

  const handleRemoveConfirm = async (reason, approverInfo = {}) => {
    if (!itemToRemove) {
      setIsRemoveModalOpen(false);
      setItemToRemove(null);
      return;
    }

    try {
      // Calculate the quantity to void (use voidQuantity if set, otherwise 1)
      const voidQuantity = itemToRemove.voidQuantity || 1;
      const newQuantity = itemToRemove.newQuantity !== undefined ? itemToRemove.newQuantity : (itemToRemove.quantity - 1);
      const voidAmount = itemToRemove.itemPrice * voidQuantity;

      // Prepare the voided item with voidReason
      const voidedItem = {
        productId: itemToRemove.productId || itemToRemove._id || itemToRemove.id,
        itemName: itemToRemove.itemName,
        sku: itemToRemove.sku,
        variant: itemToRemove.variant || itemToRemove.selectedVariation,
        selectedSize: itemToRemove.selectedSize || itemToRemove.size,
        quantity: voidQuantity,
        price: itemToRemove.itemPrice,
        itemImage: itemToRemove.itemImage || '',
        voidReason: reason
      };

      // Record void transaction
      const response = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          items: [voidedItem],
          paymentMethod: 'void',
          totalAmount: voidAmount,
          performedById: currentUser?._id || currentUser?.id || '',
          performedByName: currentUser?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'System',
          status: 'Voided',
          voidReason: reason
        })
      });

      const data = await response.json();

      if (!data.success) {
        console.error('Failed to record void transaction:', data.message);
        // Still proceed with removing the item even if logging fails
      }

      // Also create a void log entry for the void logs page
      try {
        const voidLogResponse = await fetch('http://localhost:5000/api/void-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: [voidedItem],
            totalAmount: voidAmount,
            voidReason: reason,
            voidedById: currentUser?._id || currentUser?.id || '',
            voidedByName: currentUser?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'System',
            approvedBy: approverInfo.approvedBy || null,
            approvedByRole: approverInfo.approvedByRole || null,
            source: 'cart',
            userId: userId
          })
        });

        const voidLogData = await voidLogResponse.json();

        if (!voidLogData.success) {
          console.error('Failed to create void log:', voidLogData.message);
        }
      } catch (voidLogError) {
        console.error('Error creating void log:', voidLogError);
      }

      // Remove or decrease quantity after successful void logging
      if (newQuantity <= 0) {
        // If new quantity is 0 or less, remove the item completely
        removeFromCart(itemToRemove);
      } else {
        // Update to the new quantity
        updateQuantity(itemToRemove, newQuantity);
      }

      // Clear pending quantity for this item
      const key = getItemKey(itemToRemove);
      setPendingQuantities(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    } catch (error) {
      console.error('Error recording void transaction:', error);
      // Still proceed with removing the item even if logging fails
      const newQuantity = itemToRemove.newQuantity !== undefined ? itemToRemove.newQuantity : (itemToRemove.quantity - 1);
      if (newQuantity <= 0) {
        removeFromCart(itemToRemove);
      } else {
        updateQuantity(itemToRemove, newQuantity);
      }
      // Clear pending quantity
      const key = getItemKey(itemToRemove);
      setPendingQuantities(prev => {
        const newState = { ...prev };
        delete newState[key];
        return newState;
      });
    } finally {
      setIsRemoveModalOpen(false);
      setItemToRemove(null);
    }
  };

  const handleRemoveModalClose = () => {
    setIsRemoveModalOpen(false);
    setItemToRemove(null);
    setItemsToVoid([]);
    setIsBulkVoid(false);
  };

  // Void Transaction Modal handlers
  const handleVoidButtonClick = () => {
    if (cart.length > 0) {
      setIsVoidModalOpen(true);
    }
  };

  const handleVoidModalClose = () => {
    setIsVoidModalOpen(false);
  };

  const handleVoidItemsConfirm = (selectedItems) => {
    if (selectedItems.length > 0) {
      setItemsToVoid(selectedItems);
      setIsBulkVoid(true);
      setIsVoidModalOpen(false);
      // Create a synthetic item for the PIN modal to show total
      const totalAmount = selectedItems.reduce((sum, item) => sum + (item.itemPrice * item.quantity), 0);
      setItemToRemove({
        itemPrice: totalAmount,
        quantity: 1,
        itemName: `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`
      });
      setIsRemoveModalOpen(true);
    }
  };

  const handleBulkVoidConfirm = async (reason, approverInfo = {}) => {
    // Prevent duplicate calls
    if (isProcessingVoidRef.current) {
      console.log('[OrderSummary] Already processing void, skipping');
      return;
    }

    if (!itemsToVoid || itemsToVoid.length === 0) {
      setIsRemoveModalOpen(false);
      setItemsToVoid([]);
      setIsBulkVoid(false);
      return;
    }

    // Mark as processing
    isProcessingVoidRef.current = true;

    // Store items to remove before clearing state
    const itemsToRemove = [...itemsToVoid];

    // Clear all modal state FIRST to prevent reopening
    setIsRemoveModalOpen(false);
    setItemToRemove(null);
    setItemsToVoid([]);
    setIsBulkVoid(false);

    // Small delay to ensure modal state is fully cleared before cart operations
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Prepare all voided items for a single transaction
      const voidedItems = itemsToRemove.map(item => ({
        productId: item.productId || item._id || item.id,
        itemName: item.itemName,
        sku: item.sku,
        variant: item.variant || item.selectedVariation,
        selectedSize: item.selectedSize || item.size,
        quantity: item.quantity,
        price: item.itemPrice,
        itemImage: item.itemImage || '',
        voidReason: reason
      }));

      // Calculate total amount for all items
      const totalAmount = itemsToRemove.reduce((sum, item) => sum + (item.itemPrice * item.quantity), 0);

      // Record single void transaction for all items
      const response = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          items: voidedItems,
          paymentMethod: 'void',
          totalAmount: totalAmount,
          performedById: currentUser?._id || currentUser?.id || '',
          performedByName: currentUser?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'System',
          status: 'Voided',
          voidReason: reason
        })
      });

      const data = await response.json();

      if (!data.success) {
        console.error('Failed to record void transaction:', data.message);
      }

      // Also create a void log entry for the void logs page
      try {
        const voidLogResponse = await fetch('http://localhost:5000/api/void-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: voidedItems,
            totalAmount: totalAmount,
            voidReason: reason,
            voidedById: currentUser?._id || currentUser?.id || '',
            voidedByName: currentUser?.name || `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim() || 'System',
            approvedBy: approverInfo.approvedBy || null,
            approvedByRole: approverInfo.approvedByRole || null,
            source: 'cart',
            userId: userId
          })
        });

        const voidLogData = await voidLogResponse.json();

        if (!voidLogData.success) {
          console.error('Failed to create void log:', voidLogData.message);
        }
      } catch (voidLogError) {
        console.error('Error creating void log:', voidLogError);
      }

      // Remove all items from cart using direct remove (no PIN modal)
      for (const item of itemsToRemove) {
        if (removeFromCartDirect) {
          removeFromCartDirect(item);
        } else {
          removeFromCart(item);
        }
      }
    } catch (error) {
      console.error('Error recording bulk void transaction:', error);
      // Still remove items from cart even if logging fails
      for (const item of itemsToRemove) {
        if (removeFromCartDirect) {
          removeFromCartDirect(item);
        } else {
          removeFromCart(item);
        }
      }
    } finally {
      // Reset processing flag
      isProcessingVoidRef.current = false;
    }
  };

  const applyDiscountCode = async () => {
    if (!discountCode || !discountCode.trim()) {
      alert('Please enter a discount code');
      return;
    }

    try {
      setApplyingDiscount(true);

      // Fetch all discounts
      const response = await fetch('http://localhost:5000/api/discounts');
      const data = await response.json();

      if (!data.success || !Array.isArray(data.data)) {
        alert('Failed to fetch discounts. Please try again.');
        return;
      }

      // Find discount by code (case-insensitive)
      const codeToFind = discountCode.trim().toLowerCase();
      const matchingDiscount = data.data.find(discount => {
        const discountCodeStr = (discount.discountCode || '').trim().toLowerCase();
        return discountCodeStr === codeToFind && discount.status === 'active';
      });

      if (!matchingDiscount) {
        alert('Discount code not found or inactive. Please check the code and try again.');
        setDiscountCode('');
        return;
      }

      // Apply the discount using the onSelectDiscount function
      if (onSelectDiscount) {
        onSelectDiscount(matchingDiscount);
        setDiscountCode('');
      } else {
        alert('Unable to apply discount. Please try selecting from the discount list.');
      }
    } catch (error) {
      console.error('Error applying discount code:', error);
      alert('An error occurred while applying the discount code. Please try again.');
    } finally {
      setApplyingDiscount(false);
    }
  };
  return (
    <div className={`h-full rounded-[22px] border flex flex-col ${theme === 'dark' ? 'bg-[#1E1B18] border-gray-700' : 'bg-white border-gray-200'}`} style={{ boxShadow: '5px 0 15px rgba(0,0,0,0.08), 0 7px 17px rgba(0,0,0,0.05)' }}>
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="w-8"></div> {/* Spacer for centering */}
        <h2 className={`text-xl font-bold text-center ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Order Summary</h2>
        <button
          onClick={handleVoidButtonClick}
          disabled={cart.length === 0}
          className={`w-8 h-8 flex items-center justify-center transition-all ${cart.length === 0
            ? 'text-gray-300 cursor-not-allowed'
            : 'text-red-500 hover:text-red-700'
            }`}
          title="Void Transaction"
        >
          <HiDocumentRemove className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        {cart.length === 0 ? (
          <div className="text-center text-gray-400 py-10">
            <p>No items in cart</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((item, index) => {
              const displayQty = getDisplayQuantity(item);
              const hasPending = hasPendingChange(item);
              const isReducing = hasPending && displayQty < item.quantity;

              return (
                <div key={item._id || item.productId || `cart-item-${index}`} className={`relative rounded-xl border shadow-[0_3px_8px_rgba(0,0,0,0.04)] p-3 ${hasPending
                  ? (theme === 'dark' ? 'border-orange-700 bg-orange-900/20' : 'border-orange-300 bg-orange-50')
                  : (theme === 'dark' ? 'bg-[#2A2724] border-gray-700' : 'bg-white border-gray-200')
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-16 h-16 rounded-lg shrink-0 overflow-hidden relative ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-100'}`}>
                      {(() => {
                        const discountPercent = getItemTotalDiscountPercent(item);
                        if (discountPercent > 0) {
                          return (
                            <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-br-lg z-10">
                              -{discountPercent}%
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {item.itemImage && item.itemImage.trim() !== '' ? (
                        <img
                          src={item.itemImage}
                          alt={item.itemName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <MdCategory className="text-2xl text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`font-medium text-sm mb-1 pr-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {item.itemName}{item.variant ? ` (${item.variant})` : ''}
                      </h3>
                      <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        SKU: {item.sku}<br />
                        Size: {item.selectedSize || item.size || 'N/A'}<br />
                        Color: {item.selectedVariation || item.variant || 'N/A'}
                      </p>
                      <p className="text-sm font-bold text-[#AD7F65]">
                        PHP {((item.itemPrice || 0) * displayQty).toFixed(2)}
                      </p>
                      {displayQty > 1 && (
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                          ₱{(item.itemPrice || 0).toFixed(2)} × {displayQty}
                        </p>
                      )}
                      {hasPending && isReducing && (
                        <p className="text-xs text-orange-600 mt-1">
                          Voiding {item.quantity - displayQty} item(s)
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end justify-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleMinusClick(item)}
                          disabled={displayQty <= 1}
                          className={`w-6 h-6 flex items-center justify-center rounded-full shadow-sm transition-all ${displayQty <= 1
                            ? 'bg-gray-300 text-white cursor-not-allowed'
                            : 'bg-[#AD7F65] text-white hover:bg-[#8B5F45]'
                            }`}
                        >
                          <FaMinus className="text-[10px]" />
                        </button>
                        <span className={`font-semibold min-w-[18px] text-center text-sm ${hasPending ? 'text-orange-600' : (theme === 'dark' ? 'text-white' : 'text-gray-800')}`}>
                          {displayQty}
                        </span>
                        <button
                          onClick={() => handlePlusClickPending(item)}
                          className={`w-6 h-6 flex items-center justify-center rounded-full shadow-sm transition-all ${(() => {
                            if (item.selectedSize && item.sizes && item.sizes[item.selectedSize] !== undefined) {
                              const sizeData = item.sizes[item.selectedSize];
                              const maxQty = typeof sizeData === 'object' && sizeData !== null && sizeData.quantity !== undefined
                                ? sizeData.quantity
                                : (typeof sizeData === 'number' ? sizeData : 0);
                              return displayQty >= maxQty;
                            }
                            return false;
                          })()
                            ? 'bg-gray-300 text-white cursor-not-allowed'
                            : 'bg-[#AD7F65] text-white hover:bg-[#8B5F45]'
                            }`}
                          disabled={
                            (() => {
                              if (item.selectedSize && item.sizes && item.sizes[item.selectedSize] !== undefined) {
                                const sizeData = item.sizes[item.selectedSize];
                                const maxQty = typeof sizeData === 'object' && sizeData !== null && sizeData.quantity !== undefined
                                  ? sizeData.quantity
                                  : (typeof sizeData === 'number' ? sizeData : 0);
                                return displayQty >= maxQty;
                              }
                              return false;
                            })()
                          }
                        >
                          <FaPlus className="text-[10px]" />
                        </button>
                      </div>
                      {/* Confirm/Cancel buttons when there's a pending change */}
                      {hasPending && (
                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={() => handleCancelPending(item)}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleConfirmPending(item)}
                            className="px-2 py-1 text-xs bg-[#AD7F65] text-white rounded hover:bg-[#8B5F45] transition-all"
                          >
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`px-6 py-6 ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[#8B7355] mb-2">Discount</label>

          {/* Display applied discounts */}
          {selectedDiscounts.length > 0 && (
            <div className="space-y-2 mb-3">
              {selectedDiscounts.map((discount) => (
                <div key={discount._id} className={`flex items-center gap-2 p-2 rounded-lg border ${theme === 'dark' ? 'bg-[#2A2724] border-gray-600' : 'bg-gray-50 border-[#d6c1b5]'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FaTag className="text-[#AD7F65] text-sm" />
                      <span className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{discount.title}</span>
                    </div>
                    <div className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {discount.discountValue}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveDiscount(discount._id)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all"
                    title="Remove discount"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Always show discount input to add more discounts */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter discount code"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !applyingDiscount) {
                  applyDiscountCode();
                }
              }}
              className={`flex-1 px-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#AD7F65] focus:border-transparent ${theme === 'dark'
                ? 'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500'
                : 'bg-white border-[#d6c1b5] text-gray-900'
                }`}
            />
            <button
              onClick={onOpenDiscountModal}
              className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title="Browse discounts"
            >
              <FaTag className="w-4 h-4" />
            </button>
            <button
              onClick={applyDiscountCode}
              disabled={applyingDiscount || !discountCode || !discountCode.trim()}
              className="px-4 py-2 text-white rounded-lg font-medium hover:opacity-90 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}
            >
              {applyingDiscount ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </div>

        <div className="space-y-2 mb-6 text-xs">
          <div className="flex justify-between">
            <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Subtotal</span>
            <span className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>PHP {calculateSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Discount</span>
            <span className={`font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>PHP {calculateDiscount().toFixed(2)}</span>
          </div>
          <div className={`border-t my-3 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}></div>
          <div className="flex justify-between">
            <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-black'}`}>Total</span>
            <span className="text-sm font-bold" style={{ color: 'rgba(255, 133, 88, 1)' }}>PHP {calculateTotal().toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setSelectedPaymentMethod('cash')}
              className={`w-24 flex flex-col items-center justify-center py-2 rounded-lg border-2 transition-all ${selectedPaymentMethod === 'cash'
                ? 'border-[#AD7F65] bg-[#f5f0ed]'
                : (theme === 'dark' ? 'border-gray-600 bg-[#2A2724] hover:border-gray-500' : 'border-gray-300 bg-white hover:border-gray-400')
                }`}
            >
              <img src={cashIcon} alt="Cash" className="w-7 h-7 mb-1" />
              <span className={`text-xs font-medium ${selectedPaymentMethod === 'cash' ? 'text-gray-900' : (theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}`}>Cash</span>
            </button>
            <button
              onClick={() => setSelectedPaymentMethod('qr')}
              className={`w-24 flex flex-col items-center justify-center py-0 rounded-lg border-2 transition-all ${selectedPaymentMethod === 'qr'
                ? 'border-[#AD7F65] bg-[#f5f0ed]'
                : (theme === 'dark' ? 'border-gray-600 bg-[#2A2724] hover:border-gray-500' : 'border-gray-300 bg-white hover:border-gray-400')
                }`}
            >
              <img src={qrIcon} alt="QR Code" className="w-12 h-12 mb-4 " />
              <span className={`absolute text-xs font-medium translate-y-4 ${selectedPaymentMethod === 'qr' ? 'text-gray-900' : (theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}`}>Gcash</span>
            </button>
          </div>
        </div>

        <button
          onClick={handleProceed}
          disabled={cart.length === 0 || !selectedPaymentMethod}
          className="w-full py-3 text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          style={{ background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)' }}
        >
          Proceed
        </button>
      </div>

      <VoidTransactionModal
        isOpen={isVoidModalOpen}
        onClose={handleVoidModalClose}
        onConfirm={handleVoidItemsConfirm}
        cartItems={cart}
      />

      <RemoveItemPinModal
        isOpen={isRemoveModalOpen}
        onClose={handleRemoveModalClose}
        onConfirm={isBulkVoid ? handleBulkVoidConfirm : handleRemoveConfirm}
        item={itemToRemove}
      />
    </div>
  );
};

export default OrderSummary;


