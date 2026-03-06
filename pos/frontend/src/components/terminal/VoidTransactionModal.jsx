import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';
import { MdCategory } from 'react-icons/md';
import { HiDocumentRemove } from 'react-icons/hi';
import { useTheme } from '../../context/ThemeContext';

const VoidTransactionModal = ({ isOpen, onClose, onConfirm, cartItems }) => {
  const { theme } = useTheme();
  const [selectedItems, setSelectedItems] = useState([]);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
    }
  }, [isOpen]);

  const handleItemToggle = (item) => {
    setSelectedItems(prev => {
      const isSelected = prev.some(i => i._id === item._id);
      if (isSelected) {
        return prev.filter(i => i._id !== item._id);
      } else {
        return [...prev, item];
      }
    });
  };

  const isItemSelected = (item) => {
    return selectedItems.some(i => i._id === item._id);
  };

  const calculateSelectedTotal = () => {
    return selectedItems.reduce((total, item) => total + (item.itemPrice * item.quantity), 0);
  };

  const handleVoidItems = () => {
    if (selectedItems.length > 0) {
      onConfirm(selectedItems);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10001] backdrop-blur-sm bg-black/30"
      onClick={onClose}
    >
      <div
        className={`rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Void Transaction</h2>
            </div>
            <button
              onClick={onClose}
              className={`transition ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <HiDocumentRemove className="w-6 h-6 text-red-500" />
            </button>
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-auto px-6 pb-4">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <p>No items in cart</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item._id}
                  onClick={() => handleItemToggle(item)}
                  className={`relative rounded-xl border p-4 cursor-pointer transition-all ${isItemSelected(item)
                      ? theme === 'dark'
                        ? 'border-red-500 bg-red-900/20'
                        : 'border-red-400 bg-red-50/30'
                      : theme === 'dark'
                        ? 'border-gray-700 bg-[#2A2724] hover:border-gray-600'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Item Image */}
                    <div className={`w-16 h-16 rounded-lg shrink-0 overflow-hidden ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
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

                    {/* Item Details */}
                    <div className="flex-1">
                      <h3 className={`font-semibold text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {item.itemName}{item.variant ? `, ${item.variant}` : ''}
                      </h3>
                      <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        SKU: {item.sku}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Size: {item.selectedSize || item.size || 'N/A'}
                      </p>
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        Color: {item.selectedVariation || item.variant || 'N/A'}
                      </p>
                      <p className="text-sm font-bold text-red-500 mt-1">
                        PHP {(item.itemPrice * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                      <div
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${isItemSelected(item)
                            ? 'bg-red-500 border-red-500'
                            : theme === 'dark' ? 'border-gray-500 bg-[#2A2724]' : 'border-gray-300 bg-white'
                          }`}
                      >
                        {isItemSelected(item) && (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with buttons */}
        <div className={`p-6 pt-4 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${theme === 'dark'
                  ? 'bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              Cancel
            </button>
            <button
              onClick={handleVoidItems}
              disabled={selectedItems.length === 0}
              className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Void Items
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoidTransactionModal;
