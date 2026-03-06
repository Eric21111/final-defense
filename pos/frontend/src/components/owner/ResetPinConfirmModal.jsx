import React, { useState } from 'react';

const ResetPinConfirmModal = ({ isOpen, onClose, onConfirm, employeeName }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePinChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    if (error) setError('');
  };

  const handleReset = async () => {
    const trimmedPin = pin.trim();

    if (trimmedPin.length !== 6) {
      setError('Please enter your 6-digit PIN');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

      if (!currentUser.email) {
        setError('Current user information not found. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:5000/api/employees/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email,
          pin: trimmedPin,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'PIN verification failed');
        setLoading(false);
        return;
      }

      await onConfirm();
      setPin('');
      setLoading(false);
    } catch (err) {
      console.error('Error verifying PIN for reset:', err);
      setError('Failed to verify PIN. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 flex items-center backdrop-blur-sm  justify-center z-[10000]  bg-opacity-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="h-2"
          style={{
            background: 'linear-gradient(to right, #3B82F6, #2563EB)'
          }}
        />
        
        <div className="p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
            Reset PIN for {employeeName}?
          </h2>
          
          <p className="text-center text-gray-600 mb-4">
            This will generate a new temporary PIN that will be emailed to the employee and required on their next login.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>A new 6-digit temporary PIN will be generated</li>
                  <li>The employee's current PIN will be replaced</li>
                  <li>The temporary PIN will be emailed to the employee</li>
                  <li>They must change it on their next login</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Enter your 6-digit PIN to confirm
            </label>
            <input
              type="password"
              value={pin}
              onChange={handlePinChange}
              maxLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent tracking-[0.5em] text-center text-lg"
              placeholder="••••••"
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Reset PIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPinConfirmModal;
