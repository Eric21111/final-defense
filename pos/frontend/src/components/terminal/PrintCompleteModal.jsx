import React from 'react';
import { FaCheckCircle, FaQuestionCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const PrintCompleteModal = ({ isOpen, onConfirm, onRetry, error }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4"
    >
      <div className={`rounded-2xl p-6 shadow-2xl max-w-sm w-full ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
        <div className="flex flex-col items-center">
          {error ? (
            <>
              <FaExclamationTriangle
                className="text-6xl text-red-500 mb-4"
                style={{
                  animation: 'pulseWarning 1s ease-in-out infinite'
                }}
              />
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                Print Failed
              </h3>
              <p className={`text-center mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                {error}
              </p>
              <p className={`text-center text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                The transaction was saved. You can retry printing or continue with the next sale.
              </p>
              <style>{`
                @keyframes pulseWarning {
                  0% { transform: scale(1); opacity: 1; }
                  50% { transform: scale(1.1); opacity: 0.8; }
                  100% { transform: scale(1); opacity: 1; }
                }
              `}</style>
            </>
          ) : (
            <>
              <FaQuestionCircle className="text-6xl text-amber-500 mb-4" />
              <h3 className={`text-xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                Print Complete?
              </h3>
              <p className={`text-center mb-6 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                Did the receipt print successfully?
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onConfirm}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                >
                  <FaCheckCircle />
                  Yes
                </button>
                <button
                  onClick={onRetry}
                  className="flex-1 py-2 px-4 rounded-lg font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-all"
                >
                  Print Again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintCompleteModal;
