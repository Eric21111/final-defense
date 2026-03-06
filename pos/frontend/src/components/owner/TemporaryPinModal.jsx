import React from 'react';
import { FaTimes, FaCopy } from 'react-icons/fa';

const TemporaryPinModal = ({ isOpen, onClose, employeeName, temporaryPin }) => {
  if (!isOpen) return null;

  const handleCopyPin = () => {
    navigator.clipboard.writeText(temporaryPin);
    alert('PIN copied to clipboard!');
  };

  return (
    <div
      className="fixed inset-0 flex items-center backdrop-blur-sm justify-center z-[10003] bg-opacity-50"

    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-2"
          style={{
            background: 'linear-gradient(to right, #C2A68C, #AD7F65, #76462B)'
          }}
        />

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Temporary PIN Generated!
                </h2>
                <p className="text-sm text-gray-600">
                  Employee: <span className="font-semibold">{employeeName}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <FaTimes className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h3 className="text-lg font-bold text-amber-900">
                Temporary PIN
              </h3>
            </div>

            <div className="flex items-center justify-center gap-3 mb-4">
              {temporaryPin.split('').map((digit, index) => (
                <div
                  key={index}
                  className="w-14 h-16 bg-white border-2 border-amber-300 rounded-lg flex items-center justify-center text-3xl font-bold text-amber-900 shadow-md"
                >
                  {digit}
                </div>
              ))}
            </div>

            <button
              onClick={handleCopyPin}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all font-medium"
            >
              <FaCopy className="w-4 h-4" />
              Copy PIN to Clipboard
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">Important:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>This is a temporary PIN for the employee's first login</li>
                  <li>The employee will be required to change this PIN on first login</li>
                  <li>Please share this PIN securely with the employee</li>
                  <li>This PIN will not be shown again</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full px-6 py-3 rounded-lg text-white font-medium transition-all"
            style={{
              background: 'linear-gradient(to right, #C2A68C, #AD7F65, #76462B)'
            }}
          >
            I've Saved the PIN
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemporaryPinModal;
