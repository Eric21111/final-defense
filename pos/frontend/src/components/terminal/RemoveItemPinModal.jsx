import { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const voidReasons = [
  'Customer cancellation',
  'Wrong transaction',
  'System error',
  'Payment issue',
  'Other'
];

const RemoveItemPinModal = ({ isOpen, onClose, onConfirm, item }) => {
  const { theme } = useTheme();
  const [pin, setPin] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReasonDropdownOpen, setIsReasonDropdownOpen] = useState(false);
  const reasonDropdownRef = useRef(null);
  const isConfirmingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setReason('');
      setError('');
      setIsReasonDropdownOpen(false);
      isConfirmingRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (reasonDropdownRef.current && !reasonDropdownRef.current.contains(event.target)) {
        setIsReasonDropdownOpen(false);
      }
    };

    if (isReasonDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isReasonDropdownOpen]);

  const handlePinChange = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleReasonSelect = (selectedReason) => {
    setReason(selectedReason);
    setIsReasonDropdownOpen(false);
    setError('');
  };

  const handleConfirm = async (e) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log('[RemoveItemPinModal] handleConfirm called, reason:', reason, 'pin length:', pin.length);

    if (!reason) {
      setError('Please select a reason for void');
      return;
    }

    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Get current user email from localStorage
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      if (!currentUser.email) {
        setError('User information not found. Please log in again.');
        setLoading(false);
        return;
      }

      // Trim and ensure PIN is exactly 6 digits
      const trimmedPin = pin.trim();
      if (trimmedPin.length !== 6 || !/^\d{6}$/.test(trimmedPin)) {
        setError('PIN must be exactly 6 digits');
        setLoading(false);
        return;
      }

      // Store reason in a variable to ensure it's preserved
      const voidReason = reason;

      // Verify PIN with backend
      const response = await fetch('http://localhost:5000/api/employees/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email,
          pin: trimmedPin
        })
      });

      const data = await response.json();

      if (data.success) {
        // PIN verified successfully - proceed with void transaction
        console.log('[RemoveItemPinModal] PIN verified successfully, calling onConfirm with reason:', voidReason);

        // Mark that we're in a successful confirmation flow - prevent double calls
        if (isConfirmingRef.current) {
          console.log('[RemoveItemPinModal] Already confirming, skipping duplicate call');
          return;
        }
        isConfirmingRef.current = true;

        // Extract approver info from the verified employee
        const approverInfo = {
          approvedBy: data.data?.name || data.data?.firstName || 'Unknown',
          approvedById: data.data?._id || data.data?.id || '',
          approvedByRole: data.data?.role || null
        };

        // Store reason in variable to ensure it's passed correctly
        // Call onConfirm with the reason and approver info - it will handle the void transaction and close the modal
        if (voidReason && onConfirm) {
          try {
            // Set loading to false before calling onConfirm
            setLoading(false);
            // Call onConfirm - parent will handle closing the modal
            await onConfirm(voidReason, approverInfo);
            console.log('[RemoveItemPinModal] onConfirm called successfully with approver:', approverInfo);
          } catch (error) {
            console.error('[RemoveItemPinModal] Error calling onConfirm:', error);
            setError('Failed to void item. Please try again.');
            setLoading(false);
            isConfirmingRef.current = false;
            return;
          }
        } else {
          console.error('[RemoveItemPinModal] Missing voidReason or onConfirm:', { voidReason, onConfirm: !!onConfirm });
          setError('Failed to void item. Missing reason or callback.');
          setLoading(false);
          isConfirmingRef.current = false;
          return;
        }
      } else {
        // PIN verification failed
        setError(data.message || 'Invalid PIN. Please try again.');
        // Don't clear PIN on first failure - allow user to retry
        setLoading(false);
      }
    } catch (error) {
      console.error('Error verifying PIN:', error);
      setError('Failed to connect to server. Please try again.');
      // Don't clear PIN on network error - allow user to retry
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // For single item void (minus button), show price for 1 quantity only
  // For bulk void, the item is already set with quantity=1 and itemPrice=totalAmount
  const itemTotal = item ? item.itemPrice.toFixed(2) : '0.00';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[10000] backdrop-blur-sm bg-opacity-50"
      onClick={onClose}
    >
      <div
        className={`rounded-2xl w-full max-w-md shadow-2xl overflow-hidden ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                <span className="text-white text-xl font-bold">!</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-600">
                  Void Transaction
                </h2>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                  This action requires manager authorization.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`transition ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <label className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Amount to Void:
            </label>
            <div className={`rounded-lg p-4 ${theme === 'dark' ? 'bg-red-900/30' : 'bg-red-50'}`}>
              <span className="text-2xl font-bold text-red-600">
                PHP {itemTotal}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <label className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Reason for Void <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={reasonDropdownRef}>
              <button
                type="button"
                onClick={() => setIsReasonDropdownOpen(!isReasonDropdownOpen)}
                className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all ${theme === 'dark' ? 'bg-[#2A2724] border-gray-600' : 'bg-white border-gray-300'}`}
              >
                <span className={reason ? (theme === 'dark' ? 'text-gray-200' : 'text-gray-700') : 'text-gray-400'}>
                  {reason || 'Select a reason...'}
                </span>
                <FaChevronDown
                  className={`text-gray-500 transition-transform ${isReasonDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {isReasonDropdownOpen && (
                <div className={`absolute z-10 w-full mt-2 border rounded-lg shadow-lg overflow-hidden ${theme === 'dark' ? 'bg-[#2A2724] border-gray-600' : 'bg-white border-gray-200'}`}>
                  {voidReasons.map((voidReason) => (
                    <button
                      key={voidReason}
                      type="button"
                      onClick={() => handleReasonSelect(voidReason)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors ${reason === voidReason
                        ? (theme === 'dark' ? 'bg-red-900/30 text-red-400 font-semibold' : 'bg-red-50 text-red-600 font-semibold')
                        : (theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')
                        }`}
                    >
                      {voidReason}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-6">
            <label className={`block text-sm font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
              Manager PIN <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              id="void-transaction-pin"
              name="void-transaction-pin"
              value={pin}
              onChange={handlePinChange}
              onBlur={(e) => {
                // Ensure PIN is properly formatted on blur
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
                if (digitsOnly !== pin) {
                  setPin(digitsOnly);
                }
              }}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 transition-all ${theme === 'dark' ? 'bg-[#2A2724] border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
              placeholder="Enter 6-digit PIN"
              maxLength={6}
              autoFocus
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div className={`mb-4 p-3 border rounded-lg text-sm text-center ${theme === 'dark' ? 'bg-red-900/30 border-red-800 text-red-400' : 'bg-red-100 border-red-300 text-red-700'}`}>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${theme === 'dark' ? 'bg-[#2A2724] text-gray-300 hover:bg-[#322f2c]' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfirm();
              }}
              disabled={loading || pin.length !== 6 || !reason}
              className="flex-1 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Confirm Void'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoveItemPinModal;

