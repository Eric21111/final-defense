import { FaPrint, FaTimes } from 'react-icons/fa';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
  return `${date.toLocaleDateString('en-US', options)} at ${date.toLocaleTimeString('en-US', timeOptions)}`;
};

const formatShortDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).replace(',', '');
};

const ViewTransactionModal = ({ isOpen, onClose, transaction, onReturnItems, onPrintReceipt }) => {
  if (!isOpen || !transaction) return null;

  const transactionId = transaction.transactionNumber
    ? `TRX-${String(transaction.transactionNumber).padStart(3, '0')}`
    : transaction.referenceNo || transaction._id?.substring(0, 8);

  // Build a map of returned items from returnTransactions
  const returnedItemsMap = {};
  if (transaction.returnTransactions && transaction.returnTransactions.length > 0) {
    transaction.returnTransactions.forEach(returnTrx => {
      if (returnTrx.items) {
        returnTrx.items.forEach(item => {
          const key = `${item.productId || item._id}-${item.selectedSize || ''}`;
          if (!returnedItemsMap[key]) {
            returnedItemsMap[key] = {
              quantity: 0,
              reason: item.returnReason || item.reason || 'N/A',
              date: returnTrx.checkedOutAt || returnTrx.createdAt,
              restocked: true
            };
          }
          returnedItemsMap[key].quantity += item.quantity || 1;
        });
      }
    });
  }

  // Calculate subtotal from items
  const subtotal = transaction.items?.reduce((sum, item) => {
    return sum + ((item.price || item.itemPrice || 0) * (item.quantity || 1));
  }, 0) || transaction.totalAmount || 0;

  // Get discount amount
  const discountAmount = transaction.discountAmount || 0;

  // Calculate total returned amount
  const totalReturned = transaction.returnTransactions?.reduce((sum, returnTrx) => {
    return sum + (returnTrx.totalAmount || 0);
  }, 0) || 0;

  // Calculate adjusted total
  const originalTotal = subtotal - discountAmount;
  const adjustedTotal = originalTotal - totalReturned;

  // Get amount paid and change
  const amountPaid = transaction.amountReceived || 0;
  const change = transaction.changeGiven || 0;

  const canReturn = transaction.status === 'Completed' || transaction.status === 'Partially Returned';
  const hasReturns = totalReturned > 0;

  // Check if an item has been returned (check both item's returnStatus and returnTransactions)
  const getItemReturnInfo = (item) => {
    // First check if item has returnStatus directly set
    if (item.returnStatus === 'Returned') {
      return {
        quantity: item.quantity,
        reason: item.returnReason || 'Returned',
        date: null,
        restocked: true
      };
    }
    // Fall back to checking returnTransactions map
    const key = `${item.productId || item._id}-${item.selectedSize || ''}`;
    return returnedItemsMap[key] || null;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 overflow-y-auto flex-1">
          {/* Header with Transaction Info */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-[#5D4037] mb-1">
                Transaction Id: {transactionId}
              </h2>
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
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${transaction.status === 'Completed'
                  ? 'bg-green-100 text-green-700'
                  : transaction.status === 'Returned'
                    ? 'bg-orange-100 text-orange-700'
                    : transaction.status === 'Partially Returned'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                  ● {transaction.status || 'Completed'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>


          {/* Items Table */}
          <div className="mb-6">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 rounded-t-lg border-b border-gray-200">
              <div className="col-span-4 text-sm font-semibold text-gray-600">Item</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Quantity</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Price</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Total</div>
              <div className="col-span-2 text-sm font-semibold text-gray-600 text-center">Status</div>
            </div>

            {/* Table Rows */}
            <div className="border border-t-0 border-gray-200 rounded-b-lg">
              {transaction.items && transaction.items.length > 0 ? (
                transaction.items.map((item, idx) => {
                  const returnInfo = getItemReturnInfo(item);
                  const isFullyReturned = item.returnStatus === 'Returned';
                  const isPartiallyReturned = item.returnStatus === 'Partially Returned';
                  const hasReturnInfo = returnInfo !== null || isFullyReturned || isPartiallyReturned;

                  // Calculate display values
                  const displayQty = item.quantity;
                  const returnedQty = item.returnedQuantity || (returnInfo?.quantity || 0);

                  return (
                    <div key={idx}>
                      <div
                        className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${isFullyReturned
                          ? 'bg-orange-50 border-l-4 border-l-orange-400'
                          : isPartiallyReturned
                            ? 'bg-amber-50 border-l-4 border-l-amber-400'
                            : 'bg-white border-b border-gray-100 last:border-b-0'
                          }`}
                      >
                        {/* Item Name */}
                        <div className={`col-span-4 text-sm ${isFullyReturned ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                          {item.itemName}
                          {item.selectedSize && <span className="text-gray-500 text-xs ml-1">({item.selectedSize})</span>}
                        </div>

                        {/* Quantity */}
                        <div className="col-span-2 text-sm text-gray-600 text-center">
                          {isPartiallyReturned ? (
                            <span>
                              x{displayQty} <span className="text-orange-500 text-xs">({returnedQty} returned)</span>
                            </span>
                          ) : (
                            <span>x{displayQty}</span>
                          )}
                        </div>

                        {/* Price */}
                        <div className="col-span-2 text-sm text-gray-600 text-center">
                          ₱{(item.price || item.itemPrice || 0).toLocaleString()}
                        </div>

                        {/* Total */}
                        <div className="col-span-2 text-sm text-gray-600 text-center">
                          ₱{((item.price || item.itemPrice || 0) * displayQty).toLocaleString()}
                        </div>

                        {/* Status */}
                        <div className="col-span-2 text-center">
                          {isFullyReturned ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                              ● Returned
                            </span>
                          ) : isPartiallyReturned ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                              ● Partial
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </div>
                      </div>

                      {/* Return details row */}
                      {(isFullyReturned || isPartiallyReturned) && (
                        <div className={`px-4 py-2 border-b border-gray-100 ${isFullyReturned ? 'bg-orange-50 border-l-4 border-l-orange-400' : 'bg-amber-50 border-l-4 border-l-amber-400'}`}>
                          <p className={`text-xs italic ${isFullyReturned ? 'text-orange-600' : 'text-amber-600'}`}>
                            Reason: {item.returnReason || returnInfo?.reason || 'N/A'}
                            {returnedQty > 0 && ` • ${returnedQty} item(s) returned`}
                            {returnInfo?.date ? ` • ${formatShortDate(returnInfo.date)}` : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-4 py-4 text-center text-gray-500">No items found</div>
              )}
            </div>
          </div>

          {/* Summary Card */}
          <div className="flex justify-end mb-6">
            <div className="w-72 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal:</span>
                  <span>₱{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Discount:</span>
                  <span>₱{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {hasReturns && (
                  <div className="flex justify-between text-sm text-orange-500">
                    <span>Total Returned:</span>
                    <span>₱{totalReturned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-200">
                  <span className="text-orange-500">{hasReturns ? 'Adjusted Total:' : 'Total:'}</span>
                  <span className="text-orange-500">₱{(hasReturns ? adjustedTotal : originalTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {!hasReturns && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600 pt-2">
                      <span>Amount Paid:</span>
                      <span>₱{amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Change</span>
                      <span>₱{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="border-t border-gray-200 p-6 bg-white flex justify-center gap-3">
          {canReturn && onReturnItems && (
            <button
              onClick={() => onReturnItems(transaction)}
              className="px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all flex items-center gap-2"
            >
              Return Items
            </button>
          )}
          {onPrintReceipt && (
            <button
              onClick={() => onPrintReceipt(transaction)}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all flex items-center gap-2"
            >
              <FaPrint className="w-4 h-4" />
              Print Receipt
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewTransactionModal;
