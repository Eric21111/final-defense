import { useState, useRef } from 'react';
import { FaTimes, FaPrint } from 'react-icons/fa';
import { sendReceiptToPrinter } from '../../utils/printBridge';

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(value);

const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

const formatTime = (dateString) => {
  if (!dateString) return '12:00PM';
  return new Date(dateString).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).replace(' ', '');
};

const PrintReceiptModal = ({ isOpen, onClose, transaction }) => {
  const printRef = useRef(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printError, setPrintError] = useState(null);

  if (!isOpen || !transaction) return null;

  // Calculate subtotal from items
  const subtotal = transaction.items?.reduce((sum, item) => {
    return sum + ((item.price || item.itemPrice || 0) * (item.quantity || 1));
  }, 0) || transaction.totalAmount || 0;

  // Get discount amount
  const discountAmount = transaction.discountAmount || 0;

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintError(null);

    try {
      // Build receipt data in the same format as terminal
      const receipt = {
        receiptNo: transaction.receiptNo || '000000',
        storeName: 'Create Your Style',
        location: 'Pasonanca, Zamboanga City',
        contactNumber: '+631112224444',
        time: formatTime(transaction.checkedOutAt || transaction.createdAt),
        referenceNo: transaction.referenceNo || transaction._id?.substring(0, 12) || '-',
        items: transaction.items?.map(item => ({
          name: item.itemName || item.name || 'Item',
          itemName: item.itemName || item.name || 'Item',
          qty: item.quantity || 1,
          quantity: item.quantity || 1,
          price: item.price || item.itemPrice || 0,
          itemPrice: item.price || item.itemPrice || 0,
          size: item.selectedSize || item.size || ''
        })) || [],
        subtotal: subtotal,
        discount: discountAmount,
        total: transaction.totalAmount || 0,
        cash: transaction.amountReceived || 0,
        change: transaction.changeGiven || 0,
        paymentMethod: (transaction.paymentMethod || 'cash').toUpperCase(),
        cashier: transaction.performedByName || 'N/A'
      };

      await sendReceiptToPrinter(receipt);
      setIsPrinting(false);
      onClose();
    } catch (error) {
      console.error('Print error:', error);
      setIsPrinting(false);
      setPrintError(error.message || 'Failed to print receipt. Please allow pop-ups for this site.');
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[10000] backdrop-blur-sm bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="h-2"
          style={{
            background: 'linear-gradient(135deg, #AD7F65 0%, #76462B 100%)'
          }}
        />
        
        <div className="p-8 overflow-y-auto flex-1">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Print Receipt
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>

          {printError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              {printError}
              <p className="text-xs mt-1">Please allow pop-ups and try again.</p>
            </div>
          )}


          {/* Receipt Preview */}
          <div ref={printRef} className="bg-white p-6 border-2 border-dashed border-gray-300 rounded-lg font-mono text-sm">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Create Your Style</h3>
              <p className="text-xs text-gray-600">Pasonanca, Zamboanga City</p>
            </div>

            <div className="border-t border-b border-gray-300 py-3 my-3">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Receipt</p>
                <p className="text-base font-bold text-gray-800 mt-1">
                  #{transaction.receiptNo || '000000'}
                </p>
              </div>
            </div>

            <div className="space-y-1 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Date:</span>
                <span className="text-gray-800">{formatDateTime(transaction.checkedOutAt || transaction.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cashier:</span>
                <span className="text-gray-800">{transaction.performedByName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment:</span>
                <span className="text-gray-800 capitalize">{transaction.paymentMethod || 'N/A'}</span>
              </div>
            </div>

            <div className="border-t border-gray-300 py-3 my-3">
              <div className="space-y-2">
                {transaction.items && transaction.items.length > 0 ? (
                  transaction.items.map((item, idx) => (
                    <div key={idx} className="text-xs">
                      <p className="font-medium text-gray-800">{item.itemName}</p>
                      {item.selectedSize && (
                        <p className="text-gray-500">Size: {item.selectedSize}</p>
                      )}
                      <p className="text-gray-500">
                        {item.quantity} x {formatCurrency(item.price || item.itemPrice)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500">No items</p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-300 pt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-800">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="text-gray-800">{formatCurrency(discountAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-200">
                <span>Total:</span>
                <span>{formatCurrency(transaction.totalAmount)}</span>
              </div>
              {transaction.amountReceived > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount Received:</span>
                    <span className="text-gray-800">{formatCurrency(transaction.amountReceived)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Change:</span>
                    <span className="text-gray-800">{formatCurrency(transaction.changeGiven)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-gray-300 mt-4 pt-4 text-center">
              <p className="text-xs text-gray-500">Thank you for your purchase!</p>
              <p className="text-xs text-gray-400 mt-1">This is not an official receipt</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 p-6 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={isPrinting}
            className="flex-1 px-6 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 px-6 py-3 rounded-xl bg-[#AD7F65] hover:bg-[#76462B] text-white font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPrinting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Printing...
              </>
            ) : (
              <>
                <FaPrint className="w-4 h-4" />
                Print
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintReceiptModal;
