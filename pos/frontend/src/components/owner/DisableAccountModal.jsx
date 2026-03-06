import React from 'react';

const DisableAccountModal = ({ isOpen, onClose, onConfirm, employee, action }) => {
  if (!isOpen || !employee) return null;

  const isDisabling = action === 'disable';

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-[10000]  bg-opacity-50"
      
    >
      <div 
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="h-2"
          style={{
            background: isDisabling 
              ? 'linear-gradient(to right, #F59E0B, #EF4444)'
              : 'linear-gradient(to right, #10B981, #059669)'
          }}
        />
        
        <div className="p-6">
          <div className="flex items-center justify-center mb-4">
            {isDisabling ? (
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-center text-gray-800 mb-2">
            {isDisabling ? 'Disable Account' : 'Enable Account'}
          </h2>
          
          <p className="text-center text-gray-600 mb-6">
            Are you sure you want to {action} <span className="font-semibold">{employee.name}</span>'s account?
          </p>

          {isDisabling && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-orange-800">
                <strong>Note:</strong> This employee will not be able to log in until the account is enabled again.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 rounded-lg text-white font-medium transition-all ${
                isDisabling 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isDisabling ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisableAccountModal;
