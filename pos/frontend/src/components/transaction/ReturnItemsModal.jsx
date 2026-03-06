import React, { useState, useEffect, useRef } from 'react';
import { FaTimes, FaExclamationTriangle, FaMinus, FaPlus, FaLock } from 'react-icons/fa';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  return `${date.toLocaleDateString('en-US', options)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
};

const returnReasons = [
  { value: '', label: 'e.g Damaged, Expired, Sold, etc' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Defective', label: 'Defective' },
  { value: 'Wrong Item', label: 'Wrong Item' },
  { value: 'Size Issue', label: 'Size Issue' },
  { value: 'Customer Changed Mind', label: 'Customer Changed Mind' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Other', label: 'Other' }
];

const ReturnItemsModal = ({ isOpen, onClose, transaction, onConfirm }) => {
  const [selectedItems, setSelectedItems] = useState({});
  const [returnQuantities, setReturnQuantities] = useState({});
  const [globalReason, setGlobalReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [approverName, setApproverName] = useState('');
  const pinInputRefs = useRef([]);

  useEffect(() => {
    if (isOpen && transaction) {
      const initialSelected = {};
      const initialQuantities = {};
      if (transaction.items) {
        transaction.items.forEach((item, idx) => {
          initialSelected[idx] = false;
          initialQuantities[idx] = 1;
        });
      }
      setSelectedItems(initialSelected);
      setReturnQuantities(initialQuantities);
      setGlobalReason('');
      setOtherReason('');
      setError('');
      setShowPinModal(false);
      setPin(['', '', '', '', '', '']);
      setPinError('');
      setApproverName('');
    }
  }, [isOpen, transaction]);

  const handlePinChange = (index, value) => {
    if (value.length > 1) return;
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setPinError('');

    if (value && index < 5) {
      pinInputRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyPin = async () => {
    const enteredPin = pin.join('');
    if (enteredPin.length !== 6) {
      setPinError('Please enter a 6-digit PIN');
      return;
    }

    setVerifyingPin(true);
    setPinError('');

    try {
      const response = await fetch('http://localhost:5000/api/employees/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin })
      });

      const result = await response.json();

      if (result.success && result.data) {
        const employee = result.data;
        const role = employee.role?.toLowerCase();
        if (role === 'owner' || role === 'manager') {
          setApproverName(`${employee.firstName} ${employee.lastName}`);
          setShowPinModal(false);
          await processReturn();
        } else {
          setPinError('Only Owner or Manager can approve returns');
          setPin(['', '', '', '', '', '']);
          pinInputRefs.current[0]?.focus();
        }
      } else {
        setPinError(result.message || 'Invalid PIN. Please try again.');
        setPin(['', '', '', '', '', '']);
        pinInputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.error('Error verifying PIN:', err);
      setPinError('Error verifying PIN. Please try again.');
    } finally {
      setVerifyingPin(false);
    }
  };

  const processReturn = async () => {
    setLoading(true);
    try {
      const finalReason = globalReason === 'Other' ? `Other: ${otherReason}` : globalReason;
      const itemsToReturn = transaction.items
        .map((item, idx) => {
          if (selectedItems[idx]) {
            return {
              productId: item.productId || item._id,
              itemName: item.itemName,
              sku: item.sku,
              variant: item.variant,
              selectedSize: item.selectedSize,
              quantity: returnQuantities[idx] || 1,
              price: item.price || item.itemPrice,
              reason: finalReason,
              originalIndex: idx
            };
          }
          return null;
        })
        .filter(Boolean);

      await onConfirm(itemsToReturn, transaction);
      onClose();
    } catch (err) {
      console.error('Error processing return:', err);
      setError('Failed to process return. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleItemToggle = (index) => {
    setSelectedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };


  const handleQuantityChange = (index, delta) => {
    const item = transaction.items[index];
    const maxQty = item.quantity || 1;
    setReturnQuantities(prev => {
      const current = prev[index] || 1;
      const newQty = Math.max(1, Math.min(current + delta, maxQty));
      return { ...prev, [index]: newQty };
    });
  };

  const handleSubmit = async () => {
    const selectedCount = Object.values(selectedItems).filter(Boolean).length;
    if (selectedCount === 0) {
      setError('Please select at least one item to return');
      return;
    }

    if (!globalReason) {
      setError('Please select a reason for return');
      return;
    }

    if (globalReason === 'Other' && !otherReason.trim()) {
      setError('Please specify the reason for return');
      return;
    }

    setError('');
    // Show PIN verification modal
    setShowPinModal(true);
    setPin(['', '', '', '', '', '']);
    setPinError('');
    setTimeout(() => {
      pinInputRefs.current[0]?.focus();
    }, 100);
  };

  if (!isOpen || !transaction) return null;

  const transactionId = transaction.transactionNumber 
    ? `TRX-${String(transaction.transactionNumber).padStart(3, '0')}`
    : transaction.referenceNo || transaction._id?.substring(0, 8);

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Orange gradient header */}
        <div 
          className="px-6 py-5 flex justify-between items-center"
          style={{
            background: 'linear-gradient(135deg, #FB923C 0%, #F97316 50%, #EA580C 100%)'
          }}
        >
          <h2 className="text-2xl font-bold text-white">Process Return Request</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Transaction Info */}
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-1">
              Transaction Id: {transactionId}
            </h3>
            <p className="text-sm text-gray-500">
              Date {formatDate(transaction.checkedOutAt || transaction.createdAt)}
            </p>
            <p className="text-sm text-gray-500">
              Performed By: {transaction.performedByName || 'N/A'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500">
                Payment: {transaction.paymentMethod?.charAt(0).toUpperCase() + transaction.paymentMethod?.slice(1) || 'N/A'}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                ● {transaction.status || 'Completed'}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <FaExclamationTriangle />
              {error}
            </div>
          )}

          {/* Items Table */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Select items to return:</p>
            
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200">
              <div className="col-span-4 text-sm font-semibold text-gray-600">Item</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Quantity</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Price</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Total</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Return Qty</div>
            </div>


            {/* Table Rows */}
            <div className="border border-t-0 border-gray-200 rounded-b-lg divide-y divide-gray-100">
              {transaction.items && transaction.items.length > 0 ? (
                transaction.items.map((item, idx) => {
                  const isFullyReturned = item.returnStatus === 'Returned';
                  const isPartiallyReturned = item.returnStatus === 'Partially Returned';
                  const canReturn = !isFullyReturned && item.quantity > 0;
                  const availableQty = item.quantity; // This is the remaining quantity after any previous returns
                  
                  return (
                    <div
                      key={idx}
                      className={`grid grid-cols-12 gap-2 px-3 py-3 items-center transition-all ${
                        isFullyReturned 
                          ? 'bg-gray-100 opacity-60' 
                          : isPartiallyReturned && !selectedItems[idx]
                            ? 'bg-amber-50'
                            : selectedItems[idx] 
                              ? 'bg-orange-50' 
                              : 'bg-white'
                      }`}
                    >
                      {/* Item with checkbox */}
                      <div className="col-span-4 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedItems[idx] || false}
                          onChange={() => handleItemToggle(idx)}
                          disabled={!canReturn}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <span className={`text-sm truncate ${isFullyReturned ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {item.itemName}
                          {item.selectedSize && <span className="text-gray-500 text-xs ml-1">({item.selectedSize})</span>}
                          {isPartiallyReturned && <span className="text-amber-500 text-xs ml-1">({item.returnedQuantity} already returned)</span>}
                        </span>
                      </div>
                      
                      {/* Quantity */}
                      <div className={`col-span-2 text-sm text-center ${isFullyReturned ? 'text-gray-400' : 'text-gray-600'}`}>
                        x{availableQty}
                      </div>
                      
                      {/* Price */}
                      <div className={`col-span-2 text-sm text-center ${isFullyReturned ? 'text-gray-400' : 'text-gray-600'}`}>
                        ₱{(item.price || item.itemPrice || 0).toLocaleString()}
                      </div>
                      
                      {/* Total */}
                      <div className={`col-span-2 text-sm text-center ${isFullyReturned ? 'text-gray-400' : 'text-gray-600'}`}>
                        ₱{((item.price || item.itemPrice || 0) * item.quantity).toLocaleString()}
                      </div>
                      
                      {/* Return Qty with +/- buttons or Already Returned status */}
                      <div className="col-span-2 flex items-center justify-center gap-1">
                        {isFullyReturned ? (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                            Returned
                          </span>
                        ) : selectedItems[idx] ? (
                          <>
                            <button
                              onClick={() => handleQuantityChange(idx, -1)}
                              disabled={returnQuantities[idx] <= 1}
                              className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                                returnQuantities[idx] <= 1
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-[#AD7F65] text-white hover:bg-[#8B5F45]'
                              }`}
                            >
                              <FaMinus className="text-[8px]" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">
                              {returnQuantities[idx] || 1}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(idx, 1)}
                              disabled={returnQuantities[idx] >= availableQty}
                              className={`w-6 h-6 flex items-center justify-center rounded-full transition-all ${
                                returnQuantities[idx] >= availableQty
                                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-[#AD7F65] text-white hover:bg-[#8B5F45]'
                              }`}
                            >
                              <FaPlus className="text-[8px]" />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-4 text-center text-gray-500">No items found</div>
              )}
            </div>
          </div>

          {/* Reason for Return */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Return:
            </label>
            <div className="relative">
              <select
                value={globalReason}
                onChange={(e) => {
                  setGlobalReason(e.target.value);
                  if (e.target.value !== 'Other') {
                    setOtherReason('');
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent appearance-none bg-white text-gray-600"
              >
                {returnReasons.map((reason) => (
                  <option key={reason.value} value={reason.value} disabled={reason.value === ''}>
                    {reason.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {/* Other reason input */}
            {globalReason === 'Other' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify:
                </label>
                <input
                  type="text"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Enter the reason for return..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white text-gray-600"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="border-t border-gray-200 p-6 bg-white flex justify-end gap-3">
          <button
            onClick={handleSubmit}
            className="px-8 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Confirm Return'}
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-all"
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[10001] bg-black/60"
          onClick={() => setShowPinModal(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <FaLock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">Authorization Required</h3>
                  <p className="text-sm text-gray-500">Enter Owner/Manager PIN to approve return</p>
                </div>
              </div>
              <button
                onClick={() => setShowPinModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center gap-2 mb-6">
              {pin.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (pinInputRefs.current[index] = el)}
                  type="password"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              ))}
            </div>

            {pinError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
                {pinError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 px-4 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={verifyPin}
                disabled={verifyingPin || pin.some(d => !d)}
                className="flex-1 px-4 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyingPin ? 'Verifying...' : 'Verify & Process'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnItemsModal;
