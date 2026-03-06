import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const SuccessModal = ({ isOpen, onClose }) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 font-poppins p-4"
    >
      <div className={`rounded-2xl w-full max-w-sm relative shadow-2xl ${theme === 'dark' ? 'bg-[#1E1B18]' : 'bg-white'}`}>
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 transition-colors z-10 ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <FaTimes className="w-5 h-5" />
        </button>

        <div className="p-8 text-center">
          <div className="flex justify-center mb-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: '#B8E7D3'
              }}
            >
              <svg
                className="w-12 h-12 text-green-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                viewBox="0 0 24 24"
                style={{
                  animation: 'checkmark 0.6s ease-out'
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                  style={{
                    strokeDasharray: '22',
                    strokeDashoffset: '22',
                    animation: 'checkmark-draw 0.4s ease-out 0.2s forwards'
                  }}
                />
              </svg>
              <style>{`
                @keyframes checkmark {
                  0% {
                    transform: scale(0) rotate(-45deg);
                    opacity: 0;
                  }
                  50% {
                    transform: scale(1.2) rotate(10deg);
                    opacity: 1;
                  }
                  100% {
                    transform: scale(1) rotate(0deg);
                    opacity: 1;
                  }
                }
                @keyframes checkmark-draw {
                  to {
                    stroke-dashoffset: 0;
                  }
                }
              `}</style>
            </div>
          </div>

          <h3 className={`text-2xl font-bold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
            Success!
          </h3>

          <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            The transaction was successful.
          </p>

          <button
            onClick={onClose}
            className="px-8 py-3 rounded-lg font-semibold text-white transition-all"
            style={{
              backgroundColor: '#8B7355'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#6d5a43'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#8B7355'}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessModal;
