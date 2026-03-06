import { FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const ViewVoidLogModal = ({ isOpen, onClose, voidLog }) => {
  const { theme } = useTheme();
  if (!isOpen || !voidLog) return null;

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatCurrency = (amount) => {
    return `₱${(amount || 0).toFixed(2)}`;
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] backdrop-blur-sm bg-black/30"
      onClick={onClose}
    >
      <div
        className={`rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724]' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Red Header */}
        <div
          className="px-6 py-5 relative"
          style={{ background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)' }}
        >
          <h2 className="text-xl font-bold text-white">This Transaction is Voided</h2>
          <p className="text-red-200 text-sm mt-1">This entire transaction has been cancelled</p>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition"
          >
            <FaTimes className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Transaction ID and Date */}
          <div className="mb-4">
            <h3 className="text-2xl font-bold text-[#8B4513]">
              Transaction Id: {voidLog.voidId || 'N/A'}
            </h3>
            <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Date: {formatDateTime(voidLog.voidedAt)}
            </p>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
              Handled By: {voidLog.voidedByName || 'Unknown'}
            </p>
          </div>

          {/* Items Table */}
          <div className={`rounded-lg overflow-hidden mb-4 ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-50'}`}>
            <table className="w-full">
              <thead>
                <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                  <th className={`px-4 py-3 text-left text-sm font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Item</th>
                  <th className={`px-4 py-3 text-center text-sm font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Quantity</th>
                  <th className={`px-4 py-3 text-right text-sm font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Price</th>
                  <th className={`px-4 py-3 text-right text-sm font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {voidLog.items && voidLog.items.length > 0 ? (
                  voidLog.items.map((item, index) => (
                    <tr key={index} className={`border-b last:border-0 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                      <td className={`px-4 py-3 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {item.itemName || 'Unknown Item'}
                        {item.selectedSize && <span className={`ml-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>({item.selectedSize})</span>}
                      </td>
                      <td className={`px-4 py-3 text-sm text-center ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>x{item.quantity || 1}</td>
                      <td className={`px-4 py-3 text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{formatCurrency(item.price)}</td>
                      <td className={`px-4 py-3 text-sm text-right ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                        {formatCurrency((item.price || 0) * (item.quantity || 1))}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-sm text-gray-500 text-center">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Subtotal:</span>
              <span className={`${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{formatCurrency(voidLog.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Discount:</span>
              <span className={`${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>{formatCurrency(0)}</span>
            </div>
            <div className={`flex justify-between pt-2 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <span className={`font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>Total:</span>
              <span className="font-bold text-red-600">
                {formatCurrency(voidLog.totalAmount)} <span className="text-red-500">(Voided)</span>
              </span>
            </div>
          </div>

          {/* Reason for Void */}
          <div className="mb-4">
            <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Reason for Void:</p>
            <div className={`rounded-lg px-4 py-3 ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-gray-100'}`}>
              <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{voidLog.voidReason || 'No reason provided'}</p>
            </div>
          </div>

          {/* Approved By and Status */}
          <div className="space-y-2 mb-6">
            <p className="text-sm text-gray-600">
              Approved By: <span className={`font-medium ${voidLog.approvedByRole === 'Owner'
                ? 'text-purple-700'
                : voidLog.approvedByRole === 'Manager'
                  ? 'text-blue-700'
                  : `${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`
                }`}>
                {voidLog.approvedBy
                  ? `${voidLog.approvedBy}${voidLog.approvedByRole ? ` (${voidLog.approvedByRole})` : ''}`
                  : 'N/A'}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Status:</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Voided
              </span>
            </div>
          </div>

          {/* Cancel Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${theme === 'dark' ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewVoidLogModal;
